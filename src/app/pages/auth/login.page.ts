import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonInput, IonButton, IonItem, IonIcon, IonText, ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, IonInput, IonButton, IonItem, IonIcon, IonText],
  template: `
    <ion-content [fullscreen]="true" class="ion-padding">
      <div class="auth-wrap">
        <div class="logo">
          <div class="logo-badge">VVG</div>
          <h1>Bienvenido</h1>
          <p class="vvg-muted">Organiza los gastos de tus viajes y salidas.</p>
        </div>

        <div class="vvg-card form">
          <ion-item lines="none" class="field">
            <ion-icon name="person-outline" slot="start"></ion-icon>
            <ion-input label="Correo" labelPlacement="stacked" type="email" placeholder="demo@vvg.app" [(ngModel)]="email"></ion-input>
          </ion-item>
          <ion-item lines="none" class="field">
            <ion-icon name="wallet-outline" slot="start"></ion-icon>
            <ion-input label="Contraseña" labelPlacement="stacked" type="password" placeholder="••••" [(ngModel)]="password"></ion-input>
          </ion-item>

          <ion-button expand="block" (click)="login()" class="ion-margin-top">Iniciar sesión</ion-button>

          <ion-text color="medium" class="hint">
            <small>Demo: <b>demo&#64;vvg.app</b> / <b>1234</b></small>
          </ion-text>
        </div>

        <div class="signup">
          <span class="vvg-muted">¿No tienes cuenta?</span>
          <ion-button fill="clear" size="small" routerLink="/register">Regístrate</ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .auth-wrap { max-width: 440px; margin: 0 auto; padding-top: 8vh; }
      .logo { text-align: center; margin-bottom: 28px; }
      .logo-badge {
        width: 84px; height: 84px; border-radius: 24px; margin: 0 auto 16px;
        background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-secondary));
        color: #fff; font-weight: 800; font-size: 1.8rem; letter-spacing: 1px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: var(--vvg-shadow);
      }
      .logo h1 { margin: 0; font-weight: 800; }
      .form .field { --background: #f4f5fa; border-radius: 12px; margin-bottom: 12px; }
      .form ion-icon { color: var(--ion-color-primary); }
      .hint { display: block; text-align: center; margin-top: 14px; }
      .signup { text-align: center; margin-top: 18px; }
    `,
  ],
})
export class LoginPage {
  email = 'demo@vvg.app';
  password = '1234';

  constructor(private auth: AuthService, private router: Router, private toast: ToastController) {}

  async login() {
    const err = await this.auth.login(this.email, this.password);
    if (err) {
      const t = await this.toast.create({ message: err, duration: 2000, color: 'danger', position: 'top' });
      await t.present();
      return;
    }
    this.router.navigateByUrl('/tabs/inicio');
  }
}
