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

  get porPersona(): number {
    return this.expense ? this.balance.shareForExpense(this.expense) : 0;
  }

  // Para cada participante: cuánto le corresponde y si es quien pagó.
  get reparto(): { user: User; debe: number; pago: boolean }[] {
    const e = this.expense;
    if (!e) return [];
    return e.participantes
      .map((id) => this.data.getUser(id))
      .filter((u): u is User => !!u)
      .map((u) => ({ user: u, debe: this.porPersona, pago: u.id === e.pagadoPor }));
  }

  fechaLarga(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  async eliminar() {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar gasto',
      message: '¿Seguro que quieres eliminar este gasto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            this.data.deleteExpense(this.expenseId);
            const t = await this.toast.create({ message: 'Gasto eliminado.', duration: 1500, color: 'medium', position: 'top' });
            await t.present();
            this.router.navigate(['/viaje', this.tripId]);
          },
        },
      ],
    });
    await alert.present();
  }
}
