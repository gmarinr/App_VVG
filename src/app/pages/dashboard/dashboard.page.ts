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
import { Payment, Trip, User } from '../../models/models';

// Saldo agregado con otra persona (sumando todos los viajes).
interface PersonSettlement {
  user: User;
  net: number;              // + me deben, - yo debo
  direction: 'receive' | 'pay';
  monto: number;            // valor absoluto del neto
  reportable: number;       // cuanto puedo reportar aun (solo si yo debo)
  waiting: Payment[];       // pagos pendientes que yo reporte (espera confirmacion del otro)
  toConfirm: Payment[];     // pagos pendientes que el otro reporto (yo confirmo)
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
  private readonly personSettlementsList = computed(() => this.buildPersonSettlements());

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

  get personSettlements(): PersonSettlement[] {
    return this.personSettlementsList();
  }

  get chartData(): BarDatum[] {
    if (!this.me) return [];
    return this.balance.spendingByDate(this.me.id).map((d) => ({ label: this.shortDate(d.fecha), value: d.total }));
  }

  // Saldo agregado por persona, sumando todos los viajes. Para cada persona con la que
  // tengo deuda (o que me debe) reúno el neto, lo que aún puedo reportar y los pagos pendientes.
  private buildPersonSettlements(): PersonSettlement[] {
    if (!this.me) return [];
    const meId = this.me.id;
    const pendientes = this.data.payments().filter((p) => p.status === 'pending');
    const items: PersonSettlement[] = [];

    for (const b of this.balance.globalPersonBalances(meId)) {
      const other = this.data.getUser(b.otherId);
      if (!other) continue;

      const direction = b.monto >= 0 ? 'receive' : 'pay';
      const monto = Math.abs(b.monto);
      const waiting = pendientes.filter((p) => p.fromUserId === meId && p.toUserId === b.otherId);
      const toConfirm = pendientes.filter((p) => p.fromUserId === b.otherId && p.toUserId === meId);
      const yaReportado = waiting.reduce((sum, p) => sum + p.monto, 0);
      const reportable = direction === 'pay' ? Math.max(0, this.roundMoney(monto - yaReportado)) : 0;

      items.push({ user: other, net: b.monto, direction, monto, reportable, waiting, toConfirm });
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

  personTitle(item: PersonSettlement): string {
    return item.direction === 'receive' ? `${item.user.alias} te debe` : `Le debes a ${item.user.alias}`;
  }

  trackPerson(_index: number, item: PersonSettlement): string {
    return item.user.id;
  }

  paymentAmount(userId: string): number | '' {
    return this.paymentAmounts[userId] ?? '';
  }

  reportedMessage(item: PersonSettlement, payment: Payment): string {
    return `${item.user.alias} reportó un pago de ${this.formatAmount(payment.monto)}.`;
  }

  waitingMessage(item: PersonSettlement, payment: Payment): string {
    return `Esperando que ${item.user.alias} confirme ${this.formatAmount(payment.monto)}.`;
  }

  setPaymentAmount(userId: string, value: number | string | null | undefined) {
    const amount = Number(value);
    this.paymentAmounts[userId] = Number.isFinite(amount) && amount > 0 ? amount : undefined;
  }

  setFullPayment(item: PersonSettlement) {
    this.paymentAmounts[item.user.id] = item.reportable;
  }

  // Reporta un pago contra el total con una persona, repartido del viaje más antiguo al más nuevo.
  async settlePerson(item: PersonSettlement) {
    if (!this.me) return;
    const amount = this.roundMoney(this.paymentAmounts[item.user.id] ?? 0);
    if (amount <= 0) {
      await this.show('Ingresa un monto pagado mayor que cero.', 'warning');
      return;
    }
    if (amount - item.reportable > 0.01) {
      await this.show('El monto no puede superar lo pendiente por reportar.', 'warning');
      return;
    }

    const allocation = this.balance.allocateOldestFirst(this.me.id, item.user.id, amount);
    if (!allocation.length) {
      await this.show('No hay deudas por saldar con esta persona.', 'warning');
      return;
    }

    this.savingPaymentId = item.user.id;
    try {
      await this.data.reportPayments(
        allocation.map((a) => ({ tripId: a.tripId, fromUserId: this.me!.id, toUserId: item.user.id, monto: a.monto }))
      );
      delete this.paymentAmounts[item.user.id];
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

  // Confirma de una vez todos los pagos que la otra persona reportó.
  async confirmAll(item: PersonSettlement) {
    if (!item.toConfirm.length) return;
    this.savingPaymentId = item.user.id;
    try {
      await this.data.confirmPayments(item.toConfirm.map((p) => p.id));
      await this.show('Pagos confirmados.', 'success');
    } catch (error) {
      console.error(error);
      await this.show('No se pudieron confirmar los pagos.', 'danger');
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
