import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { Chat, User } from '../../models/models';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonIcon, IonSegment, IonSegmentButton, IonLabel, AvatarComponent,
  ],
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
})
export class MessagesPage {
  tab: 'amigos' | 'grupos' = 'amigos';

  constructor(private auth: AuthService, private data: DataService, private router: Router) {}

  get me(): User | null {
    return this.auth.currentUser();
  }

  get chats(): Chat[] {
    if (!this.me) return [];
    const all = this.data.chatsForUser(this.me.id);
    return all
      .filter((c) => (this.tab === 'amigos' ? c.tipo === 'dm' : c.tipo === 'grupo'))
      .sort((a, b) => {
        const la = this.data.lastMessage(a.id)?.fecha ?? '';
        const lb = this.data.lastMessage(b.id)?.fecha ?? '';
        return lb.localeCompare(la);
      });
  }

  // Nombre a mostrar: alias del otro (DM) o nombre del grupo.
  chatName(c: Chat): string {
    if (c.tipo === 'grupo') return c.nombre ?? 'Grupo';
    const otherId = c.memberIds.find((id) => id !== this.me?.id);
    return this.data.getUser(otherId ?? '')?.alias ?? 'Chat';
  }

  chatUser(c: Chat): User | undefined {
    if (c.tipo !== 'dm') return undefined;
    const otherId = c.memberIds.find((id) => id !== this.me?.id);
    return this.data.getUser(otherId ?? '');
  }

  preview(c: Chat): string {
    const m = this.data.lastMessage(c.id);
    if (!m) return 'Sin mensajes aún';
    const prefix = m.senderId === this.me?.id ? 'Tú: ' : '';
    return prefix + m.texto;
  }

  hora(c: Chat): string {
    const m = this.data.lastMessage(c.id);
    if (!m) return '';
    return new Date(m.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
  }

  onTab(ev: CustomEvent) {
    this.tab = (ev.detail as { value: 'amigos' | 'grupos' }).value;
  }

  open(c: Chat) {
    this.router.navigate(['/chat', c.id]);
  }

  nuevo() {
    this.router.navigate(['/chat-nuevo']);
  }
}
