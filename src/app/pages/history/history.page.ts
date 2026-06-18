import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton,
  IonLabel, IonIcon,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { BalanceService } from '../../services/balance.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { ActivityType, Trip, User } from '../../models/models';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonSegment,
    IonSegmentButton, IonLabel, IonIcon, MoneyPipe,
  ],
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage {
  filtro: ActivityType = 'viaje';

  constructor(
    private auth: AuthService,
    private data: DataService,
    private balance: BalanceService,
    private router: Router,
  ) {}

  get me(): User | null {
    return this.auth.currentUser();
  }

  get items(): Trip[] {
    if (!this.me) return [];
    return this.data.tripsForUser(this.me.id).filter((t) => t.tipo === this.filtro);
  }

  total(trip: Trip): number {
    return this.balance.tripTotal(trip.id);
  }

  tuParte(trip: Trip): number {
    return this.me ? this.balance.userTotalShare(trip.id, this.me.id) : 0;
  }

  onFiltro(ev: CustomEvent) {
    this.filtro = (ev.detail as { value: ActivityType }).value;
  }

  open(trip: Trip) {
    this.router.navigate(['/viaje', trip.id]);
  }
}
