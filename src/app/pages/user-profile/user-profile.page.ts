import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonButton, IonIcon, ToastController,
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
  ) {
    this.userId = this.route.snapshot.paramMap.get('id')!;
  }

  get user(): User | undefined {
    return this.data.getUser(this.userId);
  }

  get esAmigo(): boolean {
    const me = this.auth.currentUser();
    return !!me && me.friendIds.includes(this.userId);
  }

  get amigos(): User[] {
    return this.data.getFriends(this.userId);
  }

  async agregar() {
    if (!this.auth.userId) return;
    this.data.addFriend(this.auth.userId, this.userId);
    const t = await this.toast.create({ message: `${this.user?.alias} ahora es tu amigo 🎉`, duration: 1500, color: 'success', position: 'top' });
    await t.present();
  }

  mensaje() {
    if (!this.auth.userId) return;
    const chat = this.data.getOrCreateDm(this.auth.userId, this.userId);
    this.router.navigate(['/chat', chat.id]);
  }
}
