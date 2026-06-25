import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonSegment, IonSegmentButton, IonLabel, IonIcon, IonButton, IonFab, IonFabButton,
  IonItem, IonList, IonBadge, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { BalanceService } from '../../services/balance.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { AvatarComponent } from '../../shared/avatar.component';
import { Expense, Payment, SettlementStatus, Trip, User, UserBalance } from '../../models/models';

type Seg = 'detalles' | 'balance' | 'fotos' | 'ajustes';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonSegment, IonSegmentButton, IonLabel, IonIcon, IonButton, IonFab,
    IonFabButton, IonItem, IonList, IonBadge, MoneyPipe, AvatarComponent,
  ],
  templateUrl: './trip-detail.page.html',
  styleUrls: ['./trip-detail.page.scss'],
})
export class TripDetailPage {
  tripId!: string;
  seg: Seg = 'detalles';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    public data: DataService,
    private balance: BalanceService,
    private alertCtrl: AlertController,
    private toast: ToastController,
  ) {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
  }

  get me(): User | null {
    return this.auth.currentUser();
  }

  get trip(): Trip | undefined {
    return this.data.getTrip(this.tripId);
  }

  get isOwner(): boolean {
    return !!this.me && !!this.trip && this.trip.ownerId === this.me.id;
  }

  onSeg(ev: CustomEvent) {
    this.seg = (ev.detail as { value: Seg }).value;
  }

  // ---------- Detalles ----------
  get total(): number {
    return this.balance.tripTotal(this.tripId);
  }

  get tuParte(): number {
    return this.me ? this.balance.userTotalShare(this.tripId, this.me.id) : 0;
  }

  // Gastos agrupados por fecha (clave = YYYY-MM-DD).
  get gastosPorFecha(): { fecha: string; gastos: Expense[] }[] {
    const groups = new Map<string, Expense[]>();
    for (const e of this.data.tripExpenses(this.tripId)) {
      const dia = e.fecha.slice(0, 10);
      if (!groups.has(dia)) groups.set(dia, []);
      groups.get(dia)!.push(e);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([fecha, gastos]) => ({ fecha, gastos }));
  }

  pagador(e: Expense): User | undefined {
    return this.data.getUser(e.pagadoPor);
  }

  miParteEn(e: Expense): number {
    return this.me ? this.balance.userShareInExpense(e, this.me.id) : 0;
  }

  // Si el usuario pagó este gasto, cuánto le deben los demás (monto - su parte).
  teDebenEn(e: Expense): number {
    if (!this.me || e.pagadoPor !== this.me.id) return 0;
    return e.monto - this.miParteEn(e);
  }

  pagueYo(e: Expense): boolean {
    return !!this.me && e.pagadoPor === this.me.id;
  }

  // ---------- Balance ----------
  get balances(): UserBalance[] {
    return this.balance.tripBalances(this.tripId);
  }

  // Liquidaciones con estado (no desaparecen al saldarse: muestran pendiente/parcial/saldada).
  get settlements(): SettlementStatus[] {
    return this.balance.tripSettlementStatuses(this.tripId);
  }

  // Pagos confirmados del viaje (historial que no se borra).
  get pagosRealizados(): Payment[] {
    return this.data.tripPayments(this.tripId);
  }

  user(id: string): User | undefined {
    return this.data.getUser(id);
  }

  // ---------- Pagos del viaje (saldar liquidaciones) ----------
  private get pendingPayments(): Payment[] {
    return this.data.tripPendingPayments(this.tripId);
  }

  debeYo(s: SettlementStatus): boolean {
    return !!this.me && s.fromUserId === this.me.id;
  }

  meDeben(s: SettlementStatus): boolean {
    return !!this.me && s.toUserId === this.me.id;
  }

  // Cuánto puedo reportar todavía en esta liquidación (pendiente menos pagos ya reportados sin confirmar).
  reportablePagar(s: SettlementStatus): number {
    if (!this.me) return 0;
    const ya = this.pendingPayments
      .filter((p) => p.fromUserId === this.me!.id && p.toUserId === s.toUserId)
      .reduce((sum, p) => sum + p.monto, 0);
    return Math.max(0, this.round(s.pendiente - ya));
  }

  estadoLabel(s: SettlementStatus): string {
    return s.estado === 'saldada' ? 'Saldada' : s.estado === 'parcial' ? 'Parcial' : 'Pendiente';
  }

  // Pagos que yo reporté y esperan confirmación del acreedor.
  pagosEnEspera(s: SettlementStatus): Payment[] {
    if (!this.me) return [];
    return this.pendingPayments.filter((p) => p.fromUserId === this.me!.id && p.toUserId === s.toUserId);
  }

  // Pagos que el deudor reportó y yo (acreedor) debo confirmar.
  pagosPorConfirmar(s: SettlementStatus): Payment[] {
    if (!this.me) return [];
    return this.pendingPayments.filter((p) => p.toUserId === this.me!.id && p.fromUserId === s.fromUserId);
  }

  async registrarPago(s: SettlementStatus) {
    if (!this.me) return;
    const restante = this.reportablePagar(s);
    if (restante <= 0) {
      await this.notify('No hay nada por reportar en esta liquidacion.', 'warning');
      return;
    }
    const acreedor = this.user(s.toUserId)?.alias ?? 'la otra persona';
    const alert = await this.alertCtrl.create({
      header: 'Registrar pago',
      message: `Le pagas a ${acreedor}. Pendiente ${this.formatMoney(restante)}.`,
      inputs: [{ name: 'monto', type: 'number', value: restante, min: 0, attributes: { inputmode: 'decimal' } }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Registrar',
          handler: async (d) => {
            const monto = this.round(Number(d.monto));
            if (!Number.isFinite(monto) || monto <= 0) {
              await this.notify('Ingresa un monto mayor que cero.', 'warning');
              return false;
            }
            if (monto - restante > 0.01) {
              await this.notify('El monto no puede superar lo pendiente.', 'warning');
              return false;
            }
            try {
              await this.data.addPayment({ tripId: this.tripId, fromUserId: this.me!.id, toUserId: s.toUserId, monto });
              await this.notify('Pago reportado. Esperando confirmacion.');
              return true;
            } catch (error) {
              console.error(error);
              await this.notify('No se pudo reportar el pago.', 'danger');
              return false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmarPago(p: Payment) {
    try {
      await this.data.confirmPayment(p.id);
      await this.notify('Pago confirmado.');
    } catch (error) {
      console.error(error);
      await this.notify('No se pudo confirmar el pago.', 'danger');
    }
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
  }

  get miembros(): User[] {
    return (this.trip?.memberIds ?? []).map((id) => this.data.getUser(id)).filter((u): u is User => !!u);
  }

  // ---------- Fotos ----------
  get fotosPorFecha(): { fecha: string; fotos: { dataUrl: string }[] }[] {
    const groups = new Map<string, { dataUrl: string }[]>();
    for (const p of this.data.tripPhotos(this.tripId)) {
      const dia = p.fecha.slice(0, 10);
      if (!groups.has(dia)) groups.set(dia, []);
      groups.get(dia)!.push({ dataUrl: p.dataUrl });
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([fecha, fotos]) => ({ fecha, fotos }));
  }

  onPickPhoto(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = input.files;
    if (!files || !this.me) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => this.data.addPhoto(this.tripId, reader.result as string, this.me!.id);
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  // ---------- Ajustes ----------
  amigosParaAgregar(): User[] {
    if (!this.me || !this.trip) return [];
    return this.data.getFriends(this.me.id).filter((f) => !this.trip!.memberIds.includes(f.id));
  }

  async agregarMiembro(u: User) {
    if (this.trip?.finalizado) return this.notify('No se puede modificar un viaje finalizado.', 'warning');
    await this.data.addMember(this.tripId, u.id);
    this.notify(`${u.alias} agregado.`);
  }

  async quitarMiembro(u: User) {
    if (this.trip?.finalizado) return this.notify('No se puede modificar un viaje finalizado.', 'warning');
    if (!this.data.canRemoveMember(this.tripId, u.id)) {
      return this.notify('No se puede quitar: tiene gastos asociados.', 'warning');
    }
    await this.data.removeMember(this.tripId, u.id);
    this.notify(`${u.alias} eliminado del ${this.trip?.tipo}.`);
  }

  async editarNombre() {
    if (this.trip?.finalizado) return this.notify('No se puede cambiar el nombre de un viaje finalizado.', 'warning');
    const alert = await this.alertCtrl.create({
      header: 'Cambiar nombre',
      inputs: [{ name: 'v', value: this.trip?.nombre, placeholder: 'Nombre' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: async (d) => { if (d.v?.trim()) await this.data.updateTrip(this.tripId, { nombre: d.v.trim() }); } },
      ],
    });
    await alert.present();
  }

  async editarDescripcion() {
    if (this.trip?.finalizado) return this.notify('No se puede cambiar la descripcion de un viaje finalizado.', 'warning');
    const alert = await this.alertCtrl.create({
      header: 'Cambiar descripción',
      inputs: [{ name: 'v', type: 'textarea', value: this.trip?.descripcion, placeholder: 'Descripción' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: async (d) => { await this.data.updateTrip(this.tripId, { descripcion: (d.v ?? '').trim() }); } },
      ],
    });
    await alert.present();
  }

  async editarFechas() {
    const trip = this.trip;
    if (!trip) return;
    if (trip.finalizado) return this.notify('No se pueden cambiar las fechas de un viaje finalizado.', 'warning');

    const alert = await this.alertCtrl.create({
      header: 'Cambiar fechas',
      inputs: [
        { name: 'inicio', type: 'date', value: this.dateInputValue(trip.fechaInicio), placeholder: 'Fecha de inicio' },
        { name: 'fin', type: 'date', value: trip.fechaFin ? this.dateInputValue(trip.fechaFin) : '', placeholder: 'Fecha de termino' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (d) => {
            const inicio = typeof d.inicio === 'string' ? d.inicio : '';
            const fin = typeof d.fin === 'string' ? d.fin : '';
            if (!inicio) {
              await this.notify('Selecciona una fecha de inicio.', 'warning');
              return false;
            }
            if (fin && fin < inicio) {
              await this.notify('La fecha de termino no puede ser anterior al inicio.', 'warning');
              return false;
            }

            try {
              await this.data.updateTrip(this.tripId, {
                fechaInicio: this.isoFromDateInput(inicio),
                fechaFin: fin ? this.isoFromDateInput(fin) : '',
              });
              await this.notify('Fechas actualizadas.');
              return true;
            } catch (error) {
              console.error(error);
              await this.notify('No se pudieron actualizar las fechas.', 'danger');
              return false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async finalizar() {
    if (!this.isOwner) {
      await this.notify(`Solo el organizador puede finalizar este ${this.trip?.tipo ?? 'viaje'}.`, 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: `Finalizar ${this.trip?.tipo}`,
      message: 'Se marcará como terminado. Los balances quedan registrados.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Finalizar',
          handler: async () => {
            try {
              await this.data.finalizeTrip(this.tripId);
              await this.notify('Marcado como finalizado.');
            } catch (error) {
              console.error(error);
              await this.notify('No se pudo finalizar. Revisa permisos o conexion.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  agregarGasto() {
    if (this.trip?.finalizado) {
      this.notify('No se pueden agregar gastos a un viaje finalizado.', 'warning');
      return;
    }
    this.router.navigate(['/viaje', this.tripId, 'agregar-gasto']);
  }

  abrirGasto(e: Expense) {
    this.router.navigate(['/viaje', this.tripId, 'gasto', e.id]);
  }

  abrirChatGrupo() {
    const chat = this.data.chats().find((c) => c.tripId === this.tripId);
    if (chat) this.router.navigate(['/chat', chat.id]);
  }

  fechaLarga(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  fechaCorta(iso: string | undefined): string {
    if (!iso) return 'Sin fecha';
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private dateInputValue(iso: string): string {
    return iso.slice(0, 10);
  }

  private isoFromDateInput(value: string): string {
    return new Date(`${value}T00:00:00`).toISOString();
  }

  private async notify(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1600, color, position: 'top' });
    await t.present();
  }
}
