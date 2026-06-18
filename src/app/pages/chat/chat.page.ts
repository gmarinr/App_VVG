import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonFooter, IonToolbar, IonIcon, IonButton, IonInput, IonButtons,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { Chat, Message, User } from '../../models/models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonFooter, IonToolbar, IonIcon,
    IonButton, IonInput, IonButtons, AvatarComponent,
  ],
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage {
  @ViewChild(IonContent) content!: IonContent;
  chatId!: string;
  texto = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private data: DataService,
  ) {
    this.chatId = this.route.snapshot.paramMap.get('id')!;
  }

  get me(): User | null {
    return this.auth.currentUser();
  }

  get chat(): Chat | undefined {
    return this.data.getChat(this.chatId);
  }

  get titulo(): string {
    const c = this.chat;
    if (!c) return '';
    if (c.tipo === 'grupo') return c.nombre ?? 'Grupo';
    return this.otherUser?.alias ?? 'Chat';
  }

  get subtitulo(): string {
    const c = this.chat;
    if (!c) return '';
    if (c.tipo === 'grupo') return `${c.memberIds.length} participantes`;
    return 'En línea';
  }

  get otherUser(): User | undefined {
    const c = this.chat;
    if (!c || c.tipo !== 'dm') return undefined;
    return this.data.getUser(c.memberIds.find((id) => id !== this.me?.id) ?? '');
  }

  // Mensajes agrupados por día.
  get gruposPorFecha(): { fecha: string; mensajes: Message[] }[] {
    const groups = new Map<string, Message[]>();
    for (const m of this.data.chatMessages(this.chatId)) {
      const dia = m.fecha.slice(0, 10);
      if (!groups.has(dia)) groups.set(dia, []);
      groups.get(dia)!.push(m);
    }
    return [...groups.entries()].map(([fecha, mensajes]) => ({ fecha, mensajes }));
  }

  esMio(m: Message): boolean {
    return m.senderId === this.me?.id;
  }

  remitente(m: Message): User | undefined {
    return this.data.getUser(m.senderId);
  }

  hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }

  fechaSeparador(iso: string): string {
    const hoy = new Date().toISOString().slice(0, 10);
    if (iso === hoy) return 'Hoy';
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  }

  enviar() {
    const t = this.texto.trim();
    if (!t || !this.me) return;
    this.data.sendMessage(this.chatId, this.me.id, t);
    this.texto = '';
    setTimeout(() => this.content?.scrollToBottom(200), 50);
  }

  volver() {
    this.router.navigate(['/tabs/mensajes']);
  }

  verPerfil() {
    if (this.otherUser) this.router.navigate(['/perfil', this.otherUser.id]);
  }

  ionViewDidEnter() {
    setTimeout(() => this.content?.scrollToBottom(0), 50);
  }
}
