import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonSearchbar, IonIcon,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { User } from '../../models/models';

@Component({
  selector: 'app-new-chat',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle,
    IonButtons, IonBackButton, IonSearchbar, IonIcon, AvatarComponent,
  ],
  templateUrl: './new-chat.page.html',
  styleUrls: ['./new-chat.page.scss'],
})
export class NewChatPage {
  q = '';

  constructor(private auth: AuthService, private data: DataService, private router: Router) {}

  get amigos(): User[] {
    if (!this.auth.userId) return [];
    const term = this.q.trim().toLowerCase();
    return this.data
      .getFriends(this.auth.userId)
      .filter((f) => !term || f.alias.toLowerCase().includes(term) || f.nombre.toLowerCase().includes(term));
  }

  iniciar(f: User) {
    if (!this.auth.userId) return;
    const chat = this.data.getOrCreateDm(this.auth.userId, f.id);
    this.router.navigate(['/chat', chat.id]);
  }
}
