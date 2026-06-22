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
    const authUser = this.auth.currentUser();
    return authUser ? this.data.getUser(authUser.id) ?? authUser : null;
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
        {
          text: 'Guardar',
          handler: async (d) => {
            if (!this.me) return;
            try {
              await this.data.updateUser(this.me.id, { descripcion: (d.v ?? '').trim() });
              await this.show('Perfil actualizado.', 'success');
            } catch (error) {
              console.error(error);
              await this.show('No se pudo actualizar el perfil.', 'danger');
            }
          },
        },
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
        {
          text: 'Guardar',
          handler: async (d) => {
            if (!d.v?.trim() || !this.me) return;
            try {
              await this.data.updateUser(this.me.id, { alias: d.v.trim() });
              await this.show('Alias actualizado.', 'success');
            } catch (error) {
              console.error(error);
              await this.show('No se pudo actualizar el alias.', 'danger');
            }
          },
        },
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

  async eliminarAmigo(u: User, ev?: Event) {
    ev?.stopPropagation();
    if (!this.me) return;

    const alert = await this.alertCtrl.create({
      header: 'Eliminar amigo',
      message: `Quieres eliminar a ${u.alias} de tus amigos?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.data.removeFriend(this.me!.id, u.id);
              await this.show('Amigo eliminado.', 'medium');
            } catch (error) {
              console.error(error);
              await this.show('No se pudo eliminar el amigo.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
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
            await this.auth.logout();
            const t = await this.toast.create({ message: 'Datos reiniciados.', duration: 1500, color: 'medium', position: 'top' });
            await t.present();
            this.router.navigateByUrl('/login');
          },
        },
      ],
    });
    await alert.present();
  }

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  private async show(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1700, color, position: 'top' });
    await t.present();
  }
}
