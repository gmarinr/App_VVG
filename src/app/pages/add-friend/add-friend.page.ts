import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonSearchbar, IonButton, IonIcon, ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { User } from '../../models/models';

@Component({
  selector: 'app-add-friend',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle,
    IonButtons, IonBackButton, IonSearchbar, IonButton, IonIcon, AvatarComponent,
  ],
  templateUrl: './add-friend.page.html',
  styleUrls: ['./add-friend.page.scss'],
})
export class AddFriendPage {
  q = '';

  constructor(private auth: AuthService, private data: DataService, private toast: ToastController) {}

  async ionViewWillEnter() {
    try {
      await this.data.refreshAll();
    } catch (error) {
      console.error(error);
      await this.show('No se pudieron cargar los perfiles.', 'danger');
    }
  }

  get resultados(): User[] {
    if (!this.auth.userId) return [];
    const term = this.q.trim().toLowerCase();
    return this.data
      .getNonFriends(this.auth.userId)
      .filter((u) => !term || u.alias.toLowerCase().includes(term) || u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }

  async agregar(u: User) {
    if (!this.auth.userId) return;
    try {
      await this.data.addFriend(this.auth.userId, u.id);
      await this.show(`${u.alias} ahora es tu amigo.`, 'success');
    } catch (error) {
      console.error(error);
      await this.show('No se pudo agregar el amigo. Revisa profiles y RLS.', 'danger');
    }
  }

  private async show(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    await t.present();
  }
}
