import { Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';
import {
  ActivityType,
  Chat,
  Expense,
  Message,
  Photo,
  Trip,
  User,
} from '../models/models';

// Genera ids cortos únicos (suficiente para un MVP local).
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const AVATAR_COLORS = ['#5b5fc7', '#e8505b', '#2ec4b6', '#ff9f1c', '#9b5de5', '#3a86ff', '#06d6a0', '#f15bb5'];
const colorFor = (seed: string) => AVATAR_COLORS[Math.abs([...seed].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];

@Injectable({ providedIn: 'root' })
export class DataService {
  // Estado reactivo en memoria, espejado a localStorage.
  readonly users = signal<User[]>([]);
  readonly trips = signal<Trip[]>([]);
  readonly expenses = signal<Expense[]>([]);
  readonly photos = signal<Photo[]>([]);
  readonly chats = signal<Chat[]>([]);
  readonly messages = signal<Message[]>([]);

  constructor(private storage: StorageService) {
    this.load();
    if (this.users().length === 0) {
      this.seed();
    }
  }

  // ---------- Persistencia ----------
  private load() {
    this.users.set(this.storage.get<User[]>('users', []));
    this.trips.set(this.storage.get<Trip[]>('trips', []));
    this.expenses.set(this.storage.get<Expense[]>('expenses', []));
    this.photos.set(this.storage.get<Photo[]>('photos', []));
    this.chats.set(this.storage.get<Chat[]>('chats', []));
    this.messages.set(this.storage.get<Message[]>('messages', []));
  }

  private persist() {
    this.storage.set('users', this.users());
    this.storage.set('trips', this.trips());
    this.storage.set('expenses', this.expenses());
    this.storage.set('photos', this.photos());
    this.storage.set('chats', this.chats());
    this.storage.set('messages', this.messages());
  }

  // ---------- Usuarios / amigos ----------
  getUser(id: string): User | undefined {
    return this.users().find((u) => u.id === id);
  }

  getFriends(userId: string): User[] {
    const u = this.getUser(userId);
    if (!u) return [];
    return u.friendIds.map((id) => this.getUser(id)).filter((x): x is User => !!x);
  }

  // Amigos potenciales = usuarios que aún no son amigos ni yo mismo.
  getNonFriends(userId: string): User[] {
    const u = this.getUser(userId);
    if (!u) return [];
    return this.users().filter((x) => x.id !== userId && !u.friendIds.includes(x.id));
  }

  createUser(data: { email: string; password: string; nombre: string; alias: string }): User {
    const user: User = {
      id: uid(),
      email: data.email,
      password: data.password,
      nombre: data.nombre,
      alias: data.alias,
      descripcion: '',
      avatarColor: colorFor(data.alias || data.email),
      friendIds: [],
    };
    this.users.update((arr) => [...arr, user]);
    this.persist();
    return user;
  }

  updateUser(userId: string, patch: Partial<User>) {
    this.users.update((arr) => arr.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
    this.persist();
  }

  addFriend(userId: string, friendId: string) {
    if (userId === friendId) return;
    // Amistad bidireccional.
    this.users.update((arr) =>
      arr.map((u) => {
        if (u.id === userId && !u.friendIds.includes(friendId)) return { ...u, friendIds: [...u.friendIds, friendId] };
        if (u.id === friendId && !u.friendIds.includes(userId)) return { ...u, friendIds: [...u.friendIds, userId] };
        return u;
      })
    );
    this.persist();
  }

  // ---------- Viajes / salidas ----------
  getTrip(id: string): Trip | undefined {
    return this.trips().find((t) => t.id === id);
  }

  // Viajes en los que participa el usuario (es miembro u owner).
  tripsForUser(userId: string): Trip[] {
    return this.trips()
      .filter((t) => t.memberIds.includes(userId))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  // Viaje "actual": el más reciente no finalizado del usuario.
  currentTrip(userId: string): Trip | undefined {
    return this.tripsForUser(userId).find((t) => !t.finalizado);
  }

  createTrip(data: {
    nombre: string;
    descripcion: string;
    tipo: ActivityType;
    fechaInicio: string;
    fechaFin?: string;
    ownerId: string;
    memberIds: string[];
  }): Trip {
    const members = Array.from(new Set([data.ownerId, ...data.memberIds]));
    const trip: Trip = {
      id: uid(),
      nombre: data.nombre,
      descripcion: data.descripcion,
      tipo: data.tipo,
      fechaInicio: data.fechaInicio,
      fechaFin: data.fechaFin,
      ownerId: data.ownerId,
      memberIds: members,
      finalizado: false,
      createdAt: new Date().toISOString(),
    };
    this.trips.update((arr) => [...arr, trip]);
    // Chat de grupo automático para el viaje.
    this.chats.update((arr) => [
      ...arr,
      { id: uid(), tipo: 'grupo', nombre: trip.nombre, memberIds: members, tripId: trip.id },
    ]);
    this.persist();
    return trip;
  }

  updateTrip(tripId: string, patch: Partial<Trip>) {
    this.trips.update((arr) => arr.map((t) => (t.id === tripId ? { ...t, ...patch } : t)));
    // Mantener el nombre del chat de grupo sincronizado.
    if (patch.nombre) {
      this.chats.update((arr) => arr.map((c) => (c.tripId === tripId ? { ...c, nombre: patch.nombre } : c)));
    }
    this.persist();
  }

  addMember(tripId: string, userId: string) {
    this.trips.update((arr) =>
      arr.map((t) => (t.id === tripId && !t.memberIds.includes(userId) ? { ...t, memberIds: [...t.memberIds, userId] } : t))
    );
    this.chats.update((arr) =>
      arr.map((c) => (c.tripId === tripId && !c.memberIds.includes(userId) ? { ...c, memberIds: [...c.memberIds, userId] } : c))
    );
    this.persist();
  }

  // Solo se puede quitar a alguien sin gastos asociados.
  canRemoveMember(tripId: string, userId: string): boolean {
    const trip = this.getTrip(tripId);
    if (!trip || trip.ownerId === userId) return false;
    return !this.tripExpenses(tripId).some((e) => e.pagadoPor === userId || e.participantes.includes(userId));
  }

  removeMember(tripId: string, userId: string): boolean {
    if (!this.canRemoveMember(tripId, userId)) return false;
    this.trips.update((arr) => arr.map((t) => (t.id === tripId ? { ...t, memberIds: t.memberIds.filter((id) => id !== userId) } : t)));
    this.chats.update((arr) => arr.map((c) => (c.tripId === tripId ? { ...c, memberIds: c.memberIds.filter((id) => id !== userId) } : c)));
    this.persist();
    return true;
  }

  finalizeTrip(tripId: string) {
    this.updateTrip(tripId, { finalizado: true, fechaFin: this.getTrip(tripId)?.fechaFin ?? new Date().toISOString() });
  }

  // ---------- Gastos ----------
  tripExpenses(tripId: string): Expense[] {
    return this.expenses()
      .filter((e) => e.tripId === tripId)
      .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
  }

  getExpense(id: string): Expense | undefined {
    return this.expenses().find((e) => e.id === id);
  }

  addExpense(data: {
    tripId: string;
    titulo: string;
    monto: number;
    pagadoPor: string;
    participantes: string[];
    fecha: string;
  }): Expense {
    const expense: Expense = {
      id: uid(),
      tripId: data.tripId,
      titulo: data.titulo,
      monto: data.monto,
      pagadoPor: data.pagadoPor,
      participantes: data.participantes.length ? data.participantes : [data.pagadoPor],
      fecha: data.fecha,
      createdAt: new Date().toISOString(),
    };
    this.expenses.update((arr) => [...arr, expense]);
    this.persist();
    return expense;
  }

  deleteExpense(id: string) {
    this.expenses.update((arr) => arr.filter((e) => e.id !== id));
    this.persist();
  }

  // ---------- Fotos ----------
  tripPhotos(tripId: string): Photo[] {
    return this.photos()
      .filter((p) => p.tripId === tripId)
      .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
  }

  addPhoto(tripId: string, dataUrl: string, uploadedBy: string) {
    const photo: Photo = { id: uid(), tripId, dataUrl, uploadedBy, fecha: new Date().toISOString() };
    this.photos.update((arr) => [...arr, photo]);
    this.persist();
  }

  // ---------- Chats / mensajes ----------
  chatsForUser(userId: string): Chat[] {
    return this.chats().filter((c) => c.memberIds.includes(userId));
  }

  getChat(id: string): Chat | undefined {
    return this.chats().find((c) => c.id === id);
  }

  // Devuelve (creando si hace falta) el DM entre dos usuarios.
  getOrCreateDm(userA: string, userB: string): Chat {
    const existing = this.chats().find(
      (c) => c.tipo === 'dm' && c.memberIds.length === 2 && c.memberIds.includes(userA) && c.memberIds.includes(userB)
    );
    if (existing) return existing;
    const chat: Chat = { id: uid(), tipo: 'dm', memberIds: [userA, userB] };
    this.chats.update((arr) => [...arr, chat]);
    this.persist();
    return chat;
  }

  chatMessages(chatId: string): Message[] {
    return this.messages()
      .filter((m) => m.chatId === chatId)
      .sort((a, b) => +new Date(a.fecha) - +new Date(b.fecha));
  }

  lastMessage(chatId: string): Message | undefined {
    const msgs = this.chatMessages(chatId);
    return msgs[msgs.length - 1];
  }

  sendMessage(chatId: string, senderId: string, texto: string) {
    const msg: Message = { id: uid(), chatId, senderId, texto, fecha: new Date().toISOString() };
    this.messages.update((arr) => [...arr, msg]);
    this.persist();
  }

  // ---------- Datos semilla ----------
  private seed() {
    const mk = (email: string, alias: string, nombre: string, desc = ''): User => ({
      id: uid(),
      email,
      password: '1234',
      nombre,
      alias,
      descripcion: desc,
      avatarColor: colorFor(alias),
      friendIds: [],
    });

    const yo = mk('demo@vvg.app', 'Tú', 'Usuario Demo', 'Cuenta de demostración de VVG.');
    const ana = mk('ana@vvg.app', 'Ana', 'Ana Pérez', 'Me encanta viajar.');
    const luis = mk('luis@vvg.app', 'Luis', 'Luis Gómez');
    const sofi = mk('sofi@vvg.app', 'Sofi', 'Sofía Ríos', 'Foodie de bares.');
    const dani = mk('dani@vvg.app', 'Dani', 'Daniel Soto');

    // Amistades de la cuenta demo.
    yo.friendIds = [ana.id, luis.id, sofi.id];
    ana.friendIds = [yo.id, luis.id];
    luis.friendIds = [yo.id, ana.id, sofi.id];
    sofi.friendIds = [yo.id, luis.id];
    dani.friendIds = [];

    const users = [yo, ana, luis, sofi, dani];
    this.users.set(users);

    const now = new Date();
    const iso = (d: Date) => d.toISOString();
    const daysAgo = (n: number) => iso(new Date(now.getTime() - n * 86400000));

    // Viaje actual (en curso).
    const viaje: Trip = {
      id: uid(),
      nombre: 'Fin de semana en la playa',
      descripcion: 'Escapada de 3 días con amigos.',
      tipo: 'viaje',
      fechaInicio: daysAgo(2),
      ownerId: yo.id,
      memberIds: [yo.id, ana.id, luis.id],
      finalizado: false,
      createdAt: daysAgo(2),
    };
    // Salida pasada finalizada.
    const salida: Trip = {
      id: uid(),
      nombre: 'Bar con el equipo',
      descripcion: 'Cervezas del viernes.',
      tipo: 'salida',
      fechaInicio: daysAgo(10),
      fechaFin: daysAgo(10),
      ownerId: sofi.id,
      memberIds: [yo.id, sofi.id, luis.id],
      finalizado: true,
      createdAt: daysAgo(10),
    };
    this.trips.set([viaje, salida]);

    const exp = (tripId: string, titulo: string, monto: number, pagadoPor: string, participantes: string[], fecha: string): Expense => ({
      id: uid(),
      tripId,
      titulo,
      monto,
      pagadoPor,
      participantes,
      fecha,
      createdAt: fecha,
    });

    this.expenses.set([
      exp(viaje.id, 'Alojamiento (Airbnb)', 150000, yo.id, [yo.id, ana.id, luis.id], daysAgo(2)),
      exp(viaje.id, 'Supermercado', 45000, ana.id, [yo.id, ana.id, luis.id], daysAgo(2)),
      exp(viaje.id, 'Gasolina', 30000, luis.id, [yo.id, luis.id], daysAgo(1)),
      exp(viaje.id, 'Cena restaurante', 60000, yo.id, [yo.id, ana.id, luis.id], daysAgo(1)),
      exp(salida.id, 'Ronda de cervezas', 24000, sofi.id, [yo.id, sofi.id, luis.id], daysAgo(10)),
      exp(salida.id, 'Picada', 18000, luis.id, [yo.id, sofi.id, luis.id], daysAgo(10)),
    ]);

    // Chats de grupo para cada viaje + un DM con Ana.
    const chatViaje: Chat = { id: uid(), tipo: 'grupo', nombre: viaje.nombre, memberIds: viaje.memberIds, tripId: viaje.id };
    const chatSalida: Chat = { id: uid(), tipo: 'grupo', nombre: salida.nombre, memberIds: salida.memberIds, tripId: salida.id };
    const dmAna: Chat = { id: uid(), tipo: 'dm', memberIds: [yo.id, ana.id] };
    this.chats.set([chatViaje, chatSalida, dmAna]);

    this.messages.set([
      { id: uid(), chatId: chatViaje.id, senderId: ana.id, texto: '¡Llegué al Airbnb! 🏖️', fecha: daysAgo(2) },
      { id: uid(), chatId: chatViaje.id, senderId: yo.id, texto: 'Voy en camino', fecha: daysAgo(2) },
      { id: uid(), chatId: dmAna.id, senderId: ana.id, texto: 'Oye, ¿pagaste la cena?', fecha: daysAgo(1) },
      { id: uid(), chatId: dmAna.id, senderId: yo.id, texto: 'Sí, ya la registré en la app 😉', fecha: daysAgo(1) },
    ]);

    this.persist();
  }

  // Reinicia todo a los datos semilla (útil en demo).
  resetDemo() {
    ['users', 'trips', 'expenses', 'photos', 'chats', 'messages'].forEach((k) => this.storage.remove(k));
    this.users.set([]);
    this.trips.set([]);
    this.expenses.set([]);
    this.photos.set([]);
    this.chats.set([]);
    this.messages.set([]);
    this.seed();
  }
}
