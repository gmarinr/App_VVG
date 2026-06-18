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
import { Trip, User } from '../../models/models';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private data: DataService,
    private toast: ToastController,
  ) {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    this.pagadoPor = this.auth.userId ?? '';
    // Por defecto, todos los miembros participan.
    (this.trip?.memberIds ?? []).forEach((id) => this.participantes.add(id));
  }

  get trip(): Trip | undefined {
    return this.data.getTrip(this.tripId);
  }

  get miembros(): User[] {
    return (this.trip?.memberIds ?? []).map((id) => this.data.getUser(id)).filter((u): u is User => !!u);
  }

  toggle(id: string) {
    if (this.participantes.has(id)) this.participantes.delete(id);
    else this.participantes.add(id);
  }

  // Cuánto le toca a cada participante (división en partes iguales).
  get porPersona(): number {
    const n = this.participantes.size;
    if (!n || !this.monto) return 0;
    return Math.round((this.monto / n) * 100) / 100;
  }

  async guardar() {
    if (!this.titulo.trim()) return this.show('Ponle un título al gasto.', 'warning');
    if (!this.monto || this.monto <= 0) return this.show('Ingresa un monto válido.', 'warning');
    if (!this.participantes.size) return this.show('Selecciona al menos un participante.', 'warning');

    this.data.addExpense({
      tripId: this.tripId,
      titulo: this.titulo.trim(),
      monto: this.monto,
      pagadoPor: this.pagadoPor,
      participantes: [...this.participantes],
      fecha: new Date(this.fecha).toISOString(),
    });
    await this.show('Gasto agregado.', 'success');
    this.router.navigate(['/viaje', this.tripId]);
  }

  private async show(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1700, color, position: 'top' });
    await t.present();
  }
}
