import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonInput, IonButton, IonItem, ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle,
    IonButtons, IonBackButton, IonInput, IonButton, IonItem,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/login"></ion-back-button></ion-buttons>
        <ion-title>Crear cuenta</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true" class="ion-padding">
      <div class="auth-wrap">
        <div class="vvg-card form">
          <ion-item lines="none" class="field">
            <ion-input label="Correo" labelPlacement="stacked" type="email" placeholder="tu@correo.com" [(ngModel)]="email"></ion-input>
          </ion-item>
          <ion-item lines="none" class="field">
            <ion-input label="Contraseña" labelPlacement="stacked" type="password" placeholder="••••" [(ngModel)]="password"></ion-input>
          </ion-item>
          <ion-item lines="none" class="field">
            <ion-input label="Nombre" labelPlacement="stacked" placeholder="Tu nombre" [(ngModel)]="nombre"></ion-input>
          </ion-item>
          <ion-item lines="none" class="field">
            <ion-input label="Alias" labelPlacement="stacked" placeholder="Cómo te ven tus amigos" [(ngModel)]="alias"></ion-input>
          </ion-item>

          <ion-button expand="block" (click)="register()" class="ion-margin-top">Registrarme</ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .auth-wrap { max-width: 440px; margin: 0 auto; padding-top: 12px; }
      .form .field { --background: #f4f5fa; border-radius: 12px; margin-bottom: 12px; }
    `,
  ],
})
export class RegisterPage {
  email = '';
  password = '';
  nombre = '';
  alias = '';

  constructor(private auth: AuthService, private router: Router, private toast: ToastController) {}

  async register() {
    if (!this.email.trim() || !this.password || !this.nombre.trim() || !this.alias.trim()) {
      return this.show('Completa todos los campos.', 'warning');
    }
    const err = await this.auth.register({ email: this.email, password: this.password, nombre: this.nombre, alias: this.alias });
    if (err) {
      await this.show(err, err.startsWith('Cuenta creada') ? 'success' : 'danger');
      if (err.startsWith('Cuenta creada')) this.router.navigateByUrl('/login');
      return;
    }
    this.router.navigateByUrl('/tabs/inicio');
  }

  private async show(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 2000, color, position: 'top' });
    await t.present();
  }
}
