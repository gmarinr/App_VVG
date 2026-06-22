import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonInput, IonButton, IonItem, IonSelect, IonSelectOption, IonIcon,
  ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { AvatarComponent } from '../../shared/avatar.component';
import { ExpenseParticipantShare, ExpenseSplitMethod, Trip, User } from '../../models/models';

@Component({
  selector: 'app-add-expense',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonInput, IonButton, IonItem, IonSelect, IonSelectOption,
    IonIcon, MoneyPipe, AvatarComponent,
  ],
  templateUrl: './add-expense.page.html',
  styleUrls: ['./add-expense.page.scss'],
})
export class AddExpensePage {
  tripId!: string;
  titulo = '';
  monto: number | null = null;
  pagadoPor = '';
  fecha = new Date().toISOString().slice(0, 10);
  participantes = new Set<string>();
  metodoReparto: ExpenseSplitMethod = 'equal';
  splitValues: Record<string, number> = {};
  private defaultParticipantsLoaded = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private data: DataService,
    private toast: ToastController,
  ) {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    this.pagadoPor = this.auth.userId ?? '';
  }

  get trip(): Trip | undefined {
    return this.data.getTrip(this.tripId);
  }

  get miembros(): User[] {
    const miembros = (this.trip?.memberIds ?? []).map((id) => this.data.getUser(id)).filter((u): u is User => !!u);
    if (!this.defaultParticipantsLoaded && miembros.length) {
      miembros.forEach((m) => {
        this.participantes.add(m.id);
        this.ensureDefaultSplitValue(m.id);
      });
      this.defaultParticipantsLoaded = true;
    }
    return miembros;
  }

  get participantesSeleccionados(): User[] {
    return this.miembros.filter((m) => this.participantes.has(m.id));
  }

  get porPersona(): number {
    const n = this.participantes.size;
    if (!n || !this.monto) return 0;
    return this.round(this.monto / n);
  }

  get exactTotal(): number {
    return this.round(this.participantesSeleccionados.reduce((sum, u) => sum + this.valueFor(u.id), 0));
  }

  get percentageTotal(): number {
    return this.round(this.participantesSeleccionados.reduce((sum, u) => sum + this.valueFor(u.id), 0));
  }

  get weightTotal(): number {
    return this.round(this.participantesSeleccionados.reduce((sum, u) => sum + this.valueFor(u.id), 0));
  }

  get repartoResumen(): { user: User; amount: number }[] {
    return this.participantesSeleccionados.map((user) => ({ user, amount: this.shareFor(user.id) }));
  }

  toggle(id: string) {
    if (this.participantes.has(id)) {
      this.participantes.delete(id);
      return;
    }
    this.participantes.add(id);
    this.ensureDefaultSplitValue(id);
  }

  onMetodo(ev: CustomEvent) {
    this.metodoReparto = (ev.detail as { value: ExpenseSplitMethod }).value;
    this.resetSplitValuesForSelected();
  }

  shareFor(userId: string): number {
    if (!this.monto || !this.participantes.has(userId)) return 0;
    switch (this.metodoReparto) {
      case 'exact':
        return this.round(this.valueFor(userId));
      case 'percentage':
        return this.round(this.monto * (this.valueFor(userId) / 100));
      case 'weighted':
        return this.weightTotal > 0 ? this.round(this.monto * (this.valueFor(userId) / this.weightTotal)) : 0;
      case 'equal':
      default:
        return this.porPersona;
    }
  }

  metodoLabel(): string {
    switch (this.metodoReparto) {
      case 'exact': return 'montos exactos';
      case 'percentage': return 'porcentajes';
      case 'weighted': return 'ponderaciones';
      case 'equal':
      default: return 'partes iguales';
    }
  }

  async guardar() {
    if (!this.titulo.trim()) return this.show('Ponle un titulo al gasto.', 'warning');
    if (!this.monto || this.monto <= 0) return this.show('Ingresa un monto valido.', 'warning');
    if (!this.participantes.size) return this.show('Selecciona al menos un participante.', 'warning');
    const validation = this.validateSplit();
    if (validation) return this.show(validation, 'warning');

    try {
      await this.data.addExpense({
        tripId: this.tripId,
        titulo: this.titulo.trim(),
        monto: this.monto,
        pagadoPor: this.pagadoPor,
        participantes: [...this.participantes],
        metodoReparto: this.metodoReparto,
        participantShares: this.buildParticipantShares(),
        fecha: new Date(this.fecha).toISOString(),
      });
      await this.show('Gasto agregado.', 'success');
      this.router.navigate(['/viaje', this.tripId]);
    } catch (error) {
      console.error(error);
      await this.show('No se pudo agregar el gasto.', 'danger');
    }
  }

  private ensureDefaultSplitValue(userId: string): void {
    if (this.splitValues[userId] != null) return;
    this.splitValues[userId] = this.defaultSplitValue();
  }

  private valueFor(userId: string): number {
    return Number(this.splitValues[userId] ?? this.defaultSplitValue());
  }

  private resetSplitValuesForSelected(): void {
    const ids = [...this.participantes];
    if (!ids.length) return;

    if (this.metodoReparto === 'exact') {
      this.assignEvenValues(ids, this.monto ?? 0);
      return;
    }

    if (this.metodoReparto === 'percentage') {
      this.assignEvenValues(ids, 100);
      return;
    }

    for (const id of ids) this.splitValues[id] = 1;
  }

  private assignEvenValues(userIds: string[], total: number): void {
    if (!userIds.length) return;
    const base = Math.floor((total / userIds.length) * 100) / 100;
    let assigned = 0;
    userIds.forEach((id, index) => {
      const value = index === userIds.length - 1 ? this.round(total - assigned) : base;
      this.splitValues[id] = value;
      assigned = this.round(assigned + value);
    });
  }

  private defaultSplitValue(): number {
    const count = Math.max(this.participantes.size, 1);
    if (this.metodoReparto === 'exact') return this.round((this.monto ?? 0) / count);
    if (this.metodoReparto === 'percentage') return this.round(100 / count);
    return 1;
  }

  private buildParticipantShares(): ExpenseParticipantShare[] {
    return [...this.participantes].map((userId) => ({
      userId,
      weight: this.metodoReparto === 'weighted' ? this.valueFor(userId) : 1,
      shareAmount: this.metodoReparto === 'exact' ? this.valueFor(userId) : undefined,
      sharePercentage: this.metodoReparto === 'percentage' ? this.valueFor(userId) : undefined,
    }));
  }

  private validateSplit(): string | null {
    if (this.metodoReparto === 'exact' && Math.abs(this.exactTotal - (this.monto ?? 0)) > 0.01) {
      return 'Los montos exactos deben sumar el total del gasto.';
    }
    if (this.metodoReparto === 'percentage' && Math.abs(this.percentageTotal - 100) > 0.01) {
      return 'Los porcentajes deben sumar 100%.';
    }
    if (this.metodoReparto === 'weighted' && this.participantesSeleccionados.some((u) => this.valueFor(u.id) <= 0)) {
      return 'Cada ponderacion debe ser mayor a cero.';
    }
    return null;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private async show(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1700, color, position: 'top' });
    await t.present();
  }
}
