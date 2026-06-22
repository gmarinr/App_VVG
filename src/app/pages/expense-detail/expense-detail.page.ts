import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonIcon, IonButton, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { DataService } from '../../services/data.service';
import { BalanceService } from '../../services/balance.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { AvatarComponent } from '../../shared/avatar.component';
import { Expense, User } from '../../models/models';

@Component({
  selector: 'app-expense-detail',
  standalone: true,
  imports: [
    CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonIcon, IonButton, MoneyPipe, AvatarComponent,
  ],
  templateUrl: './expense-detail.page.html',
  styleUrls: ['./expense-detail.page.scss'],
})
export class ExpenseDetailPage {
  tripId!: string;
  expenseId!: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private data: DataService,
    private balance: BalanceService,
    private alertCtrl: AlertController,
    private toast: ToastController,
  ) {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    this.expenseId = this.route.snapshot.paramMap.get('expenseId')!;
  }

  get expense(): Expense | undefined {
    return this.data.getExpense(this.expenseId);
  }

  get pagador(): User | undefined {
    return this.expense ? this.data.getUser(this.expense.pagadoPor) : undefined;
  }

  get splitLabel(): string {
    const e = this.expense;
    if (!e) return '';
    switch (e.metodoReparto) {
      case 'exact': return 'Monto exacto por persona';
      case 'percentage': return 'Porcentaje por persona';
      case 'weighted': return 'Reparto ponderado';
      case 'equal':
      default: return 'Partes iguales';
    }
  }

  get reparto(): { user: User; debe: number; pago: boolean; meta: string }[] {
    const e = this.expense;
    if (!e) return [];
    return e.participantes
      .map((id) => this.data.getUser(id))
      .filter((u): u is User => !!u)
      .map((u) => ({
        user: u,
        debe: this.balance.userShareInExpense(e, u.id),
        pago: u.id === e.pagadoPor,
        meta: this.shareMeta(e, u.id),
      }));
  }

  fechaLarga(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  async eliminar() {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar gasto',
      message: 'Seguro que quieres eliminar este gasto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.data.deleteExpense(this.expenseId);
            const t = await this.toast.create({ message: 'Gasto eliminado.', duration: 1500, color: 'medium', position: 'top' });
            await t.present();
            this.router.navigate(['/viaje', this.tripId]);
          },
        },
      ],
    });
    await alert.present();
  }

  private shareMeta(e: Expense, userId: string): string {
    const share = e.participantShares.find((x) => x.userId === userId);
    if (e.metodoReparto === 'percentage') return `${share?.sharePercentage ?? 0}%`;
    if (e.metodoReparto === 'weighted') return `Peso ${share?.weight ?? 1}`;
    return '';
  }
}
