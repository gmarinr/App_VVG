import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonSegment, IonSegmentButton, IonLabel, IonIcon, IonButton, IonFab, IonFabButton,
  IonItem, IonList, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { BalanceService } from '../../services/balance.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { AvatarComponent } from '../../shared/avatar.component';
import { Expense, Settlement, Trip, User, UserBalance } from '../../models/models';

type Seg = 'detalles' | 'balance' | 'fotos' | 'ajustes';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonSegment, IonSegmentButton, IonLabel, IonIcon, IonButton, IonFab,
    IonFabButton, IonItem, IonList, MoneyPipe, AvatarComponent,
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

  get settlements(): Settlement[] {
    return this.balance.tripSettlements(this.tripId);
  }

  user(id: string): User | undefined {
    return this.data.getUser(id);
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

  agregarMiembro(u: User) {
    this.data.addMember(this.tripId, u.id);
    this.notify(`${u.alias} agregado.`);
  }

  async quitarMiembro(u: User) {
    if (!this.data.canRemoveMember(this.tripId, u.id)) {
      return this.notify('No se puede quitar: tiene gastos asociados.', 'warning');
    }
    this.data.removeMember(this.tripId, u.id);
    this.notify(`${u.alias} eliminado del ${this.trip?.tipo}.`);
  }

  async editarNombre() {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar nombre',
      inputs: [{ name: 'v', value: this.trip?.nombre, placeholder: 'Nombre' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (d) => { if (d.v?.trim()) this.data.updateTrip(this.tripId, { nombre: d.v.trim() }); } },
      ],
    });
    await alert.present();
  }

  async editarDescripcion() {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar descripción',
      inputs: [{ name: 'v', type: 'textarea', value: this.trip?.descripcion, placeholder: 'Descripción' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (d) => { this.data.updateTrip(this.tripId, { descripcion: (d.v ?? '').trim() }); } },
      ],
    });
    await alert.present();
  }

  async finalizar() {
    const alert = await this.alertCtrl.create({
      header: `Finalizar ${this.trip?.tipo}`,
      message: 'Se marcará como terminado. Los balances quedan registrados.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Finalizar', handler: () => { this.data.finalizeTrip(this.tripId); this.notify('Marcado como finalizado.'); } },
      ],
    });
    await alert.present();
  }

  agregarGasto() {
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

  private async notify(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1600, color, position: 'top' });
    await t.present();
  }
}
