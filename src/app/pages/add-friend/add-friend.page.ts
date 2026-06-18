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

  // Usuarios que aún no son mis amigos, filtrados por búsqueda.
  get resultados(): User[] {
    if (!this.auth.userId) return [];
    const term = this.q.trim().toLowerCase();
    return this.data
      .getNonFriends(this.auth.userId)
      .filter((u) => !term || u.alias.toLowerCase().includes(term) || u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }

  async agregar(u: User) {
    if (!this.auth.userId) return;
    this.data.addFriend(this.auth.userId, u.id);
    const t = await this.toast.create({ message: `${u.alias} ahora es tu amigo 🎉`, duration: 1600, color: 'success', position: 'top' });
    await t.present();
  }
}
