import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonButton, IonIcon, ToastController, AlertController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { User } from '../../models/models';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonButton, IonIcon, AvatarComponent,
  ],
  templateUrl: './user-profile.page.html',
  styleUrls: ['./user-profile.page.scss'],
})
export class UserProfilePage {
  userId!: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private data: DataService,
    private toast: ToastController,
    private alertCtrl: AlertController,
  ) {
    this.userId = this.route.snapshot.paramMap.get('id')!;
  }

  get user(): User | undefined {
    return this.data.getUser(this.userId);
  }

  get esAmigo(): boolean {
    const me = this.auth.currentUser();
    return !!me && this.data.getFriends(me.id).some((u) => u.id === this.userId);
  }

  get amigos(): User[] {
    return this.data.getFriends(this.userId);
  }

  async agregar() {
    if (!this.auth.userId) return;
    try {
      await this.data.addFriend(this.auth.userId, this.userId);
      await this.show(`${this.user?.alias ?? 'Usuario'} ahora es tu amigo.`, 'success');
    } catch (error) {
      console.error(error);
      await this.show('No se pudo agregar el amigo.', 'danger');
    }
  }

  async eliminarAmigo() {
    if (!this.auth.userId || !this.user) return;

    const alert = await this.alertCtrl.create({
      header: 'Eliminar amigo',
      message: `Quieres eliminar a ${this.user.alias} de tus amigos?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.data.removeFriend(this.auth.userId!, this.userId);
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

  async mensaje() {
    if (!this.auth.userId) return;
    const chat = await this.data.getOrCreateDm(this.auth.userId, this.userId);
    this.router.navigate(['/chat', chat.id]);
  }

  private async show(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1600, color, position: 'top' });
    await t.present();
  }
}
