import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton,
  IonLabel, IonIcon, IonInput, IonTextarea, IonButton, IonItem, ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { ActivityType, User } from '../../models/models';

@Component({
  selector: 'app-create-trip',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle,
    IonSegment, IonSegmentButton, IonLabel, IonIcon, IonInput, IonTextarea,
    IonButton, IonItem, AvatarComponent,
  ],
  templateUrl: './create-trip.page.html',
  styleUrls: ['./create-trip.page.scss'],
})
export class CreateTripPage {
  nombre = '';
  tipo: ActivityType = 'viaje';
  fechaInicio = new Date().toISOString().slice(0, 10);
  fechaFin = '';
  descripcion = '';
  seleccionados = new Set<string>();
  inviteLink = '';

  constructor(
    private auth: AuthService,
    private data: DataService,
    private router: Router,
    private toast: ToastController,
  ) {}

  get amigos(): User[] {
    return this.auth.userId ? this.data.getFriends(this.auth.userId) : [];
  }

  toggle(id: string) {
    if (this.seleccionados.has(id)) this.seleccionados.delete(id);
    else this.seleccionados.add(id);
  }

  generarLink() {
    this.inviteLink = `https://vvg.app/invitar/${Math.random().toString(36).slice(2, 10)}`;
    this.show('Enlace de invitación generado y copiado.', 'success');
  }

  onTipo(ev: CustomEvent) {
    this.tipo = (ev.detail as { value: ActivityType }).value;
  }

  async confirmar() {
    if (!this.nombre.trim()) return this.show('Ponle un nombre al ' + this.tipo + '.', 'warning');
    if (!this.auth.userId) return;

    try {
      const trip = await this.data.createTrip({
        nombre: this.nombre.trim(),
        descripcion: this.descripcion.trim(),
        tipo: this.tipo,
        fechaInicio: new Date(this.fechaInicio).toISOString(),
        fechaFin: this.fechaFin ? new Date(this.fechaFin).toISOString() : undefined,
        ownerId: this.auth.userId,
        memberIds: [...this.seleccionados],
      });

      this.reset();
      await this.show('Creado correctamente.', 'success');
      this.router.navigate(['/viaje', trip.id]);
    } catch (error) {
      console.error(error);
      await this.show('No se pudo crear. Revisa la conexion o permisos.', 'danger');
    }
  }

  private reset() {
    this.nombre = '';
    this.descripcion = '';
    this.fechaFin = '';
    this.seleccionados.clear();
    this.inviteLink = '';
  }

  private async show(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    await t.present();
  }
}
