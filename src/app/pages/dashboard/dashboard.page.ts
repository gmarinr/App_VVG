import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonRefresher, IonRefresherContent,
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonInput,
  IonItem, IonLabel, IonList, IonBadge, IonGrid, IonRow, IonCol, IonNote, ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { BalanceService } from '../../services/balance.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { BarChartComponent, BarDatum } from '../../shared/bar-chart.component';
import { AmountCardComponent } from '../../shared/amount-card.component';
import { Payment, Settlement, Trip, User } from '../../models/models';

interface PendingPaymentItem {
  id: string;
  trip: Trip;
  settlement: Settlement;
  other: User;
  direction: 'receive' | 'pay';
  monto: number;
  confirmations: Payment[];
  waitingConfirmations: Payment[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonIcon,
    IonRefresher, IonRefresherContent, IonButton, IonCard, IonCardContent,
    IonCardHeader, IonCardTitle, IonInput, IonItem, IonLabel, IonList, IonBadge,
    IonGrid, IonRow, IonCol, IonNote,
    MoneyPipe, BarChartComponent,
    AmountCardComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage {
  showPaymentCard = false;
  savingPaymentId: string | null = null;
  private readonly paymentAmounts: Record<string, number | undefined> = {};
  private readonly pendingPayments = computed(() => this.buildPendingPayments());

  constructor(
    private auth: AuthService,
    public data: DataService,
    private balance: BalanceService,
    private router: Router,
    private toast: ToastController,
  ) {}

  get me(): User | null {
    return this.auth.currentUser();
  }

  get current(): Trip | undefined {
    return this.me ? this.data.currentTrip(this.me.id) : undefined;
  }

  // Balance neto del usuario por cada viaje (te deben +, debes -).
  get balancesPorViaje(): { trip: Trip; neto: number }[] {
    if (!this.me) return [];
    return this.data
      .tripsForUser(this.me.id)
      .map((trip) => ({ trip, neto: this.balance.userNetInTrip(trip.id, this.me!.id) }))
      .filter((b) => Math.abs(b.neto) > 0.01);
  }

  // Pagos pendientes agregados por persona (suma de todos los viajes).
  get pagosPorPersona(): { user: User; monto: number }[] {
    if (!this.me) return [];
    return this.balance
      .globalPersonBalances(this.me.id)
      .map((p) => ({ user: this.data.getUser(p.otherId)!, monto: p.monto }))
      .filter((p) => p.user);
  }

  get pagosPendientes(): PendingPaymentItem[] {
    return this.pendingPayments();
  }

  get chartData(): BarDatum[] {
    if (!this.me) return [];
    return this.balance.spendingByDate(this.me.id).map((d) => ({ label: this.shortDate(d.fecha), value: d.total }));
  }

  private buildPendingPayments(): PendingPaymentItem[] {
    if (!this.me) return [];
    const items: PendingPaymentItem[] = [];

    for (const trip of this.data.tripsForUser(this.me.id)) {
      const pendingPayments = this.data.tripPendingPayments(trip.id);

      for (const settlement of this.balance.tripSettlements(trip.id)) {
        if (settlement.fromUserId !== this.me.id && settlement.toUserId !== this.me.id) continue;

        const direction = settlement.toUserId === this.me.id ? 'receive' : 'pay';
        const otherId = direction === 'receive' ? settlement.fromUserId : settlement.toUserId;
        const other = this.data.getUser(otherId);
        if (!other) continue;
        const relatedPendingPayments = pendingPayments.filter(
          (payment) => payment.fromUserId === settlement.fromUserId && payment.toUserId === settlement.toUserId
        );

        items.push({
          id: `${trip.id}:${settlement.fromUserId}:${settlement.toUserId}`,
          trip,
          settlement,
          other,
          direction,
          monto: settlement.monto,
          confirmations: relatedPendingPayments.filter((payment) => payment.createdBy !== this.me!.id),
          waitingConfirmations: relatedPendingPayments.filter((payment) => payment.createdBy === this.me!.id),
        });
      }
    }

    return items.sort((a, b) => b.monto - a.monto);
  }

  // Gráfico mini del viaje actual.
  currentTripChart(trip: Trip): BarDatum[] {
    const map = new Map<string, number>();
    for (const e of this.data.tripExpenses(trip.id)) {
      const dia = e.fecha.slice(0, 10);
      map.set(dia, (map.get(dia) ?? 0) + e.monto);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([f, v]) => ({ label: this.shortDate(f), value: v }));
  }

  tripTotal(trip: Trip): number {
    return this.balance.tripTotal(trip.id);
  }

  shortDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  }

  openTrip(trip: Trip) {
    this.router.navigate(['/viaje', trip.id]);
  }

  verPerfil(user: User) {
    this.router.navigate(['/perfil', user.id]);
  }

  togglePaymentCard() {
    this.showPaymentCard = !this.showPaymentCard;
  }

  paymentTitle(item: PendingPaymentItem): string {
    return item.direction === 'receive' ? `${item.other.alias} te paga` : `Le pagas a ${item.other.alias}`;
  }

  trackPendingPayment(_index: number, item: PendingPaymentItem): string {
    return item.id;
  }

  paymentAmount(item: PendingPaymentItem): number | '' {
    return this.paymentAmounts[item.id] ?? '';
  }

  confirmationMessage(item: PendingPaymentItem, payment: Payment): string {
    const reporter = this.data.getUser(payment.createdBy)?.alias ?? item.other.alias;
    return `${reporter} reporto un pago de ${this.formatAmount(payment.monto)}.`;
  }

  waitingConfirmationMessage(item: PendingPaymentItem, payment: Payment): string {
    return `Esperando confirmacion de ${item.other.alias} por ${this.formatAmount(payment.monto)}.`;
  }

  setPaymentAmount(itemId: string, value: number | string | null | undefined) {
    const amount = Number(value);
    this.paymentAmounts[itemId] = Number.isFinite(amount) && amount > 0 ? amount : undefined;
  }

  setFullPayment(item: PendingPaymentItem) {
    this.paymentAmounts[item.id] = item.monto;
  }

  async confirmPayment(item: PendingPaymentItem) {
    const amount = this.roundMoney(this.paymentAmounts[item.id] ?? 0);
    if (amount <= 0) {
      await this.show('Ingresa un monto pagado mayor que cero.', 'warning');
      return;
    }
    if (amount - item.monto > 0.01) {
      await this.show('El monto pagado no puede superar el pendiente.', 'warning');
      return;
    }

    this.savingPaymentId = item.id;
    try {
      await this.data.addPayment({
        tripId: item.trip.id,
        fromUserId: item.settlement.fromUserId,
        toUserId: item.settlement.toUserId,
        monto: amount,
      });
      delete this.paymentAmounts[item.id];
      await this.show('Pago reportado. Esperando confirmacion de la otra persona.', 'success');
    } catch (error) {
      console.error(error);
      await this.show('No se pudo reportar el pago.', 'danger');
    } finally {
      this.savingPaymentId = null;
    }
  }

  async confirmReportedPayment(payment: Payment) {
    this.savingPaymentId = payment.id;
    try {
      await this.data.confirmPayment(payment.id);
      await this.show('Pago confirmado.', 'success');
    } catch (error) {
      console.error(error);
      await this.show('No se pudo confirmar el pago.', 'danger');
    } finally {
      this.savingPaymentId = null;
    }
  }

  refresh(ev: CustomEvent) {
    (ev.target as HTMLIonRefresherElement).complete();
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatAmount(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private async show(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    await t.present();
  }
}
