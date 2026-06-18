import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonButton, IonButtons,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { User } from '../../models/models';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonIcon,
    IonButton, IonButtons, AvatarComponent,
  ],
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage {
  constructor(
    private auth: AuthService,
    private data: DataService,
    private router: Router,
    private alertCtrl: AlertController,
    private toast: ToastController,
  ) {}

  get me(): User | null {
    return this.auth.currentUser();
  }

  get amigos(): User[] {
    return this.me ? this.data.getFriends(this.me.id) : [];
  }

  async editarDescripcion() {
    const alert = await this.alertCtrl.create({
      header: 'Sobre ti',
      inputs: [{ name: 'v', type: 'textarea', value: this.me?.descripcion, placeholder: 'Cuéntanos algo de ti...' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (d) => { if (this.me) this.data.updateUser(this.me.id, { descripcion: (d.v ?? '').trim() }); } },
      ],
    });
    await alert.present();
  }

  async editarAlias() {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar alias',
      inputs: [{ name: 'v', value: this.me?.alias, placeholder: 'Alias' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (d) => { if (d.v?.trim() && this.me) this.data.updateUser(this.me.id, { alias: d.v.trim() }); } },
      ],
    });
    await alert.present();
  }

  agregarAmigo() {
    this.router.navigate(['/amigos/agregar']);
  }

  verPerfil(u: User) {
    this.router.navigate(['/perfil', u.id]);
  }

  async resetDemo() {
    const alert = await this.alertCtrl.create({
      header: 'Reiniciar demo',
      message: 'Restaura los datos de ejemplo originales. Útil para volver a probar.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Reiniciar',
          handler: async () => {
            this.data.resetDemo();
            this.auth.logout();
            const t = await this.toast.create({ message: 'Datos reiniciados.', duration: 1500, color: 'medium', position: 'top' });
            await t.present();
            this.router.navigateByUrl('/login');
          },
        },
      ],
    });
    await alert.present();
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
