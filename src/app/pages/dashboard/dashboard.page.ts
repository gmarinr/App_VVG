import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { BalanceService } from '../../services/balance.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { BarChartComponent, BarDatum } from '../../shared/bar-chart.component';
import { AmountCardComponent } from '../../shared/amount-card.component';
import { Trip, User } from '../../models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonIcon,
    IonRefresher, IonRefresherContent, MoneyPipe, BarChartComponent,
    AmountCardComponent,
  ],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  constructor(
    private auth: AuthService,
    public data: DataService,
    private balance: BalanceService,
    private router: Router,
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

  get chartData(): BarDatum[] {
    if (!this.me) return [];
    return this.balance.spendingByDate(this.me.id).map((d) => ({ label: this.shortDate(d.fecha), value: d.total }));
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

  refresh(ev: CustomEvent) {
    (ev.target as HTMLIonRefresherElement).complete();
  }
}
