import { Injectable, signal } from '@angular/core';
import {
  ActivityType,
  Chat,
  Expense,
  ExpenseParticipantShare,
  ExpenseSplitMethod,
  Message,
  Payment,
  PaymentStatus,
  Photo,
  Trip,
  User,
} from '../models/models';
import { SupabaseService } from './supabase.service';

type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
type ChatType = 'dm' | 'grupo';

interface ProfileRow {
  id: string;
  email: string;
  nombre: string;
  alias: string;
  descripcion: string | null;
  avatar_color: string;
}

interface FriendshipRow {
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
}

interface TripRow {
  id: string;
  owner_id: string;
  nombre: string;
  descripcion: string;
  tipo: ActivityType;
  fecha_inicio: string;
  fecha_fin: string | null;
  finalizado: boolean;
  created_at: string;
}

interface TripMemberRow {
  trip_id: string;
  user_id: string;
}

interface ExpenseRow {
  id: string;
  trip_id: string;
  titulo: string;
  monto: number | string;
  pagado_por: string;
  metodo_reparto: ExpenseSplitMethod;
  fecha: string;
  created_at: string;
}

interface ExpenseParticipantRow {
  expense_id: string;
  user_id: string;
  weight: number | string;
  share_amount: number | string | null;
  share_percentage: number | string | null;
}

interface PhotoRow {
  id: string;
  trip_id: string;
  storage_path: string;
  uploaded_by: string;
  fecha: string;
}

interface PaymentRow {
  id: string;
  trip_id: string;
  from_user_id: string;
  to_user_id: string;
  monto: number | string;
  status: PaymentStatus;
  created_by: string;
  paid_at: string | null;
  created_at: string;
}

interface ChatRow {
  id: string;
  tipo: ChatType;
  nombre: string | null;
  trip_id: string | null;
}

interface ChatMemberRow {
  chat_id: string;
  user_id: string;
  last_read_at: string | null;
}

interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  texto: string;
  fecha: string;
}

@Injectable({ providedIn: 'root' })
export class DataService {
  readonly users = signal<User[]>([]);
  readonly trips = signal<Trip[]>([]);
  readonly expenses = signal<Expense[]>([]);
  readonly photos = signal<Photo[]>([]);
  readonly payments = signal<Payment[]>([]);
  readonly chats = signal<Chat[]>([]);
  readonly messages = signal<Message[]>([]);

  constructor(private supabase: SupabaseService) {
    void this.initialize();
  }

  async refreshAll(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    if (!data.session?.user) {
      this.clear();
      return;
    }

    await this.ensureCurrentProfile();
    await this.loadUsers();
    await Promise.all([
      this.loadTrips(),
      this.loadExpenses(),
      this.loadPhotos(),
      this.loadPayments(),
      this.loadChatsAndMessages(),
    ]);
  }

  getUser(id: string): User | undefined {
    return this.users().find((u) => u.id === id);
  }

  getFriends(userId: string): User[] {
    const u = this.getUser(userId);
    if (!u) return [];
    return u.friendIds.map((id) => this.getUser(id)).filter((x): x is User => !!x);
  }

  getNonFriends(userId: string): User[] {
    const u = this.getUser(userId);
    const friendIds = new Set(u?.friendIds ?? []);
    return this.users().filter((x) => x.id !== userId && !friendIds.has(x.id));
  }

  createUser(data: { email: string; password: string; nombre: string; alias: string }): User {
    const user: User = {
      id: this.uuid(),
      email: data.email,
      password: '',
      nombre: data.nombre,
      alias: data.alias,
      descripcion: '',
      avatarColor: '#5b5fc7',
      friendIds: [],
    };
    this.users.update((arr) => [...arr, user]);
    return user;
  }

  async updateUser(userId: string, patch: Partial<User>): Promise<void> {
    const row = await this.buildProfileUpsertRow(userId, patch);
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    if (sessionData.session?.user.id !== userId) {
      throw new Error('Solo puedes actualizar tu propio perfil.');
    }

    const { id, ...profileUpdate } = row;
    const { data, error } = await this.supabase.client
      .from('profiles')
      .update(profileUpdate)
      .eq('id', id)
      .select('id,email,nombre,alias,descripcion,avatar_color')
      .maybeSingle<ProfileRow>();
    this.throwIfError(error);

    if (!data) {
      const { error: insertError } = await this.supabase.client.from('profiles').insert(row);
      this.throwIfError(insertError);
    }

    await this.loadUsers();
  }

  async addFriend(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) return;
    const friend = this.getUser(friendId);
    if (!friend) throw new Error('Ese perfil no existe en la tabla profiles.');

    const [a, b] = [userId, friendId].sort();

    const { error } = await this.supabase.client.from('friendships').upsert(
      {
        user_id: a,
        friend_id: b,
        requested_by: userId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,friend_id' }
    );
    this.throwIfError(error);
    await this.loadUsers();
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) return;
    const [a, b] = [userId, friendId].sort();

    const { error } = await this.supabase.client
      .from('friendships')
      .delete()
      .eq('user_id', a)
      .eq('friend_id', b);
    this.throwIfError(error);
    await this.loadUsers();
  }

  getTrip(id: string): Trip | undefined {
    return this.trips().find((t) => t.id === id);
  }

  tripsForUser(userId: string): Trip[] {
    return this.trips()
      .filter((t) => t.memberIds.includes(userId))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  currentTrip(userId: string): Trip | undefined {
    return this.tripsForUser(userId).find((t) => !t.finalizado);
  }

  async createTrip(data: {
    nombre: string;
    descripcion: string;
    tipo: ActivityType;
    fechaInicio: string;
    fechaFin?: string;
    ownerId: string;
    memberIds: string[];
  }): Promise<Trip> {
    const members = Array.from(new Set([data.ownerId, ...data.memberIds]));
    const { data: tripRow, error } = await this.supabase.client
      .from('trips')
      .insert({
        owner_id: data.ownerId,
        nombre: data.nombre,
        descripcion: data.descripcion,
        tipo: data.tipo,
        fecha_inicio: this.toDateOnly(data.fechaInicio),
        fecha_fin: data.fechaFin ? this.toDateOnly(data.fechaFin) : null,
        finalizado: false,
      })
      .select('id,owner_id,nombre,descripcion,tipo,fecha_inicio,fecha_fin,finalizado,created_at')
      .single<TripRow>();
    this.throwIfError(error);

    if (!tripRow) throw new Error('No se pudo crear el viaje.');

    const { error: membersError } = await this.supabase.client.from('trip_members').insert(
      members.map((userId) => ({
        trip_id: tripRow.id,
        user_id: userId,
        role: userId === data.ownerId ? 'owner' : 'member',
        added_by: data.ownerId,
      }))
    );
    this.throwIfError(membersError);

    const { data: chatRow, error: chatError } = await this.supabase.client
      .from('chats')
      .insert({
        tipo: 'grupo',
        nombre: tripRow.nombre,
        trip_id: tripRow.id,
        created_by: data.ownerId,
      })
      .select('id,tipo,nombre,trip_id')
      .single<ChatRow>();
    this.throwIfError(chatError);

    if (chatRow) {
      const { error: chatMembersError } = await this.supabase.client.from('chat_members').insert(
        members.map((userId) => ({
          chat_id: chatRow.id,
          user_id: userId,
          role: userId === data.ownerId ? 'admin' : 'member',
        }))
      );
      this.throwIfError(chatMembersError);
    }

    await this.refreshAll();
    return this.mapTrip(tripRow, members);
  }

  async updateTrip(tripId: string, patch: Partial<Trip>): Promise<void> {
    const trip = this.getTrip(tripId);
    const protectedFields = patch.nombre !== undefined
      || patch.descripcion !== undefined
      || patch.tipo !== undefined
      || patch.fechaInicio !== undefined
      || patch.fechaFin !== undefined;
    if (trip?.finalizado && protectedFields) {
      throw new Error('No se puede editar un viaje finalizado.');
    }

    const update: Partial<TripRow> = {};
    if (patch.nombre !== undefined) update.nombre = patch.nombre;
    if (patch.descripcion !== undefined) update.descripcion = patch.descripcion;
    if (patch.tipo !== undefined) update.tipo = patch.tipo;
    if (patch.fechaInicio !== undefined) update.fecha_inicio = this.toDateOnly(patch.fechaInicio);
    if (patch.fechaFin !== undefined) update.fecha_fin = patch.fechaFin ? this.toDateOnly(patch.fechaFin) : null;
    if (patch.finalizado !== undefined) update.finalizado = patch.finalizado;

    if (Object.keys(update).length) {
      const { data, error } = await this.supabase.client
        .from('trips')
        .update(update)
        .eq('id', tripId)
        .select('id,owner_id,nombre,descripcion,tipo,fecha_inicio,fecha_fin,finalizado,created_at')
        .maybeSingle<TripRow>();
      this.throwIfError(error);
      if (!data) {
        throw new Error('No se pudo actualizar el viaje. Solo el organizador puede modificarlo.');
      }
    }

    if (patch.nombre) {
      const { error } = await this.supabase.client.from('chats').update({ nombre: patch.nombre }).eq('trip_id', tripId);
      this.throwIfError(error);
    }

    await this.refreshAll();
  }

  async addMember(tripId: string, userId: string): Promise<void> {
    if (this.getTrip(tripId)?.finalizado) {
      throw new Error('No se puede modificar un viaje finalizado.');
    }
    const { data } = await this.supabase.client.auth.getSession();
    const addedBy = data.session?.user.id ?? null;

    const { error } = await this.supabase.client.from('trip_members').insert({
      trip_id: tripId,
      user_id: userId,
      role: 'member',
      added_by: addedBy,
    });
    this.throwIfError(error);

    const groupChat = this.chats().find((c) => c.tripId === tripId);
    if (groupChat) {
      const { error: chatError } = await this.supabase.client.from('chat_members').insert({
        chat_id: groupChat.id,
        user_id: userId,
        role: 'member',
      });
      this.throwIfError(chatError);
    }

    await this.refreshAll();
  }

  canRemoveMember(tripId: string, userId: string): boolean {
    const trip = this.getTrip(tripId);
    if (!trip || trip.finalizado || trip.ownerId === userId) return false;
    return !this.tripExpenses(tripId).some((e) => e.pagadoPor === userId || e.participantes.includes(userId));
  }

  async removeMember(tripId: string, userId: string): Promise<boolean> {
    if (this.getTrip(tripId)?.finalizado) return false;
    if (!this.canRemoveMember(tripId, userId)) return false;

    const groupChat = this.chats().find((c) => c.tripId === tripId);
    if (groupChat) {
      const { error: chatError } = await this.supabase.client
        .from('chat_members')
        .delete()
        .eq('chat_id', groupChat.id)
        .eq('user_id', userId);
      this.throwIfError(chatError);
    }

    const { error } = await this.supabase.client
      .from('trip_members')
      .delete()
      .eq('trip_id', tripId)
      .eq('user_id', userId);
    this.throwIfError(error);

    await this.refreshAll();
    return true;
  }

  async finalizeTrip(tripId: string): Promise<void> {
    const trip = this.getTrip(tripId);
    await this.updateTrip(tripId, {
      finalizado: true,
      fechaFin: trip?.fechaFin ?? this.validFinishDate(trip),
    });
  }

  tripExpenses(tripId: string): Expense[] {
    return this.expenses()
      .filter((e) => e.tripId === tripId)
      .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
  }

  getExpense(id: string): Expense | undefined {
    return this.expenses().find((e) => e.id === id);
  }

  async addExpense(data: {
    tripId: string;
    titulo: string;
    monto: number;
    pagadoPor: string;
    participantes: string[];
    metodoReparto?: ExpenseSplitMethod;
    participantShares?: ExpenseParticipantShare[];
    fecha: string;
  }): Promise<Expense> {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const createdBy = sessionData.session?.user.id;
    if (!createdBy) throw new Error('No hay sesion activa.');
    if (this.getTrip(data.tripId)?.finalizado) {
      throw new Error('No se pueden agregar gastos a un viaje finalizado.');
    }

    const participantes = data.participantes.length ? data.participantes : [data.pagadoPor];
    const metodoReparto = data.metodoReparto ?? 'equal';
    const participantShares = this.normalizeExpenseShares(participantes, metodoReparto, data.participantShares);
    const { data: expenseRow, error } = await this.supabase.client
      .from('expenses')
      .insert({
        trip_id: data.tripId,
        titulo: data.titulo,
        monto: data.monto,
        moneda: 'CLP',
        pagado_por: data.pagadoPor,
        fecha: this.toDateOnly(data.fecha),
        metodo_reparto: metodoReparto,
        created_by: createdBy,
      })
      .select('id,trip_id,titulo,monto,pagado_por,metodo_reparto,fecha,created_at')
      .single<ExpenseRow>();
    this.throwIfError(error);

    if (!expenseRow) throw new Error('No se pudo crear el gasto.');

    const { error: participantsError } = await this.supabase.client.from('expense_participants').insert(
      participantShares.map((share) => ({
        expense_id: expenseRow.id,
        user_id: share.userId,
        weight: share.weight,
        share_amount: share.shareAmount ?? null,
        share_percentage: share.sharePercentage ?? null,
      }))
    );
    this.throwIfError(participantsError);

    await this.loadExpenses();
    return this.mapExpense(expenseRow, participantShares);
  }

  async deleteExpense(id: string): Promise<void> {
    const expense = this.getExpense(id);
    if (expense && this.getTrip(expense.tripId)?.finalizado) {
      throw new Error('No se pueden eliminar gastos de un viaje finalizado.');
    }

    const { error } = await this.supabase.client.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    this.throwIfError(error);
    await this.loadExpenses();
  }

  tripPhotos(tripId: string): Photo[] {
    return this.photos()
      .filter((p) => p.tripId === tripId)
      .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
  }

  tripPayments(tripId: string): Payment[] {
    return this.payments()
      .filter((p) => p.tripId === tripId && p.status === 'paid')
      .sort((a, b) => +new Date(b.paidAt ?? b.createdAt) - +new Date(a.paidAt ?? a.createdAt));
  }

  tripPendingPayments(tripId: string): Payment[] {
    return this.payments()
      .filter((p) => p.tripId === tripId && p.status === 'pending')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  async addPayment(data: {
    tripId: string;
    fromUserId: string;
    toUserId: string;
    monto: number;
  }): Promise<Payment> {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const createdBy = sessionData.session?.user.id;
    if (!createdBy) throw new Error('No hay sesion activa.');
    if (data.fromUserId === data.toUserId) throw new Error('El pago necesita dos usuarios distintos.');
    if (!Number.isFinite(data.monto) || data.monto <= 0) throw new Error('El monto pagado debe ser mayor que cero.');

    const { data: row, error } = await this.supabase.client
      .from('payments')
      .insert({
        trip_id: data.tripId,
        from_user_id: data.fromUserId,
        to_user_id: data.toUserId,
        monto: data.monto,
        status: 'pending',
        created_by: createdBy,
        paid_at: null,
      })
      .select('id,trip_id,from_user_id,to_user_id,monto,status,created_by,paid_at,created_at')
      .single<PaymentRow>();
    this.throwIfError(error);

    if (!row) throw new Error('No se pudo registrar el pago.');

    await this.loadPayments();
    return this.mapPayment(row);
  }

  async confirmPayment(paymentId: string): Promise<Payment> {
    const paidAt = new Date().toISOString();
    const { data: row, error } = await this.supabase.client
      .from('payments')
      .update({
        status: 'paid',
        paid_at: paidAt,
      })
      .eq('id', paymentId)
      .select('id,trip_id,from_user_id,to_user_id,monto,status,created_by,paid_at,created_at')
      .maybeSingle<PaymentRow>();
    this.throwIfError(error);

    if (!row) throw new Error('No se pudo confirmar el pago.');

    await this.loadPayments();
    return this.mapPayment(row);
  }

  // Reporta varios pagos pendientes de una vez (deudor -> acreedor) y recarga una sola vez.
  // Se usa al saldar desde el menu, donde un pago se reparte entre varios viajes.
  async reportPayments(items: { tripId: string; fromUserId: string; toUserId: string; monto: number }[]): Promise<void> {
    if (!items.length) return;
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const createdBy = sessionData.session?.user.id;
    if (!createdBy) throw new Error('No hay sesion activa.');

    const rows = items.map((it) => {
      if (it.fromUserId === it.toUserId) throw new Error('El pago necesita dos usuarios distintos.');
      if (!Number.isFinite(it.monto) || it.monto <= 0) throw new Error('El monto pagado debe ser mayor que cero.');
      return {
        trip_id: it.tripId,
        from_user_id: it.fromUserId,
        to_user_id: it.toUserId,
        monto: it.monto,
        status: 'pending' as PaymentStatus,
        created_by: createdBy,
        paid_at: null,
      };
    });

    const { error } = await this.supabase.client.from('payments').insert(rows);
    this.throwIfError(error);
    await this.loadPayments();
  }

  // Confirma varios pagos pendientes (acreedor) de una vez y recarga una sola vez.
  async confirmPayments(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await this.supabase.client
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .in('id', ids);
    this.throwIfError(error);
    await this.loadPayments();
  }

  async addPhoto(tripId: string, dataUrl: string, uploadedBy: string): Promise<void> {
    const id = this.uuid();
    const { blob, extension, contentType } = this.dataUrlToBlob(dataUrl);
    const storagePath = `${tripId}/${id}.${extension}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from('trip-photos')
      .upload(storagePath, blob, { contentType, upsert: false });
    this.throwIfError(uploadError);

    const { error } = await this.supabase.client.from('trip_photos').insert({
      id,
      trip_id: tripId,
      storage_path: storagePath,
      uploaded_by: uploadedBy,
      fecha: new Date().toISOString(),
    });
    this.throwIfError(error);

    this.photos.update((arr) => [...arr, { id, tripId, dataUrl, uploadedBy, fecha: new Date().toISOString() }]);
    await this.loadPhotos();
  }

  chatsForUser(userId: string): Chat[] {
    return this.chats().filter((c) => c.memberIds.includes(userId));
  }

  getChat(id: string): Chat | undefined {
    return this.chats().find((c) => c.id === id);
  }

  async getOrCreateDm(userA: string, userB: string): Promise<Chat> {
    const existing = this.chats().find(
      (c) => c.tipo === 'dm' && c.memberIds.length === 2 && c.memberIds.includes(userA) && c.memberIds.includes(userB)
    );
    if (existing) return existing;

    const { data: chatRow, error } = await this.supabase.client
      .from('chats')
      .insert({ tipo: 'dm', created_by: userA })
      .select('id,tipo,nombre,trip_id')
      .single<ChatRow>();
    this.throwIfError(error);

    if (!chatRow) throw new Error('No se pudo crear el chat.');

    const { error: membersError } = await this.supabase.client.from('chat_members').insert([
      { chat_id: chatRow.id, user_id: userA, role: 'member' },
      { chat_id: chatRow.id, user_id: userB, role: 'member' },
    ]);
    this.throwIfError(membersError);

    await this.loadChatsAndMessages();
    return this.mapChat(chatRow, [userA, userB]);
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

  chatHasUnread(chatId: string, userId: string): boolean {
    const chat = this.getChat(chatId);
    const lastReadAt = chat?.memberLastReadAt?.[userId] ?? null;
    const lastReadTime = lastReadAt ? +new Date(lastReadAt) : 0;
    return this.chatMessages(chatId).some((m) => m.senderId !== userId && +new Date(m.fecha) > lastReadTime);
  }

  unreadChatCount(userId: string): number {
    return this.chatsForUser(userId).filter((chat) => this.chatHasUnread(chat.id, userId)).length;
  }

  async markChatRead(chatId: string, userId: string): Promise<void> {
    const readAt = new Date().toISOString();
    const { error } = await this.supabase.client
      .from('chat_members')
      .update({ last_read_at: readAt })
      .eq('chat_id', chatId)
      .eq('user_id', userId);
    this.throwIfError(error);

    this.chats.update((arr) =>
      arr.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              memberLastReadAt: {
                ...chat.memberLastReadAt,
                [userId]: readAt,
              },
            }
          : chat
      )
    );
  }

  async sendMessage(chatId: string, senderId: string, texto: string): Promise<void> {
    const { data: row, error } = await this.supabase.client
      .from('messages')
      .insert({ chat_id: chatId, sender_id: senderId, texto })
      .select('id,chat_id,sender_id,texto,fecha')
      .single<MessageRow>();
    this.throwIfError(error);

    if (row) {
      this.messages.update((arr) => [...arr, this.mapMessage(row)]);
    }
  }

  resetDemo(): void {
    this.clear();
  }

  private async initialize(): Promise<void> {
    try {
      await this.refreshAll();
    } catch (error) {
      console.error('No se pudieron cargar los datos desde Supabase.', error);
      this.clear();
    }

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        this.clear();
        return;
      }

      setTimeout(() => {
        void this.refreshAll();
      }, 0);
    });
  }

  private async ensureCurrentProfile(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    const authUser = data.session?.user;
    if (!authUser) return;

    const { data: existing, error: existingError } = await this.supabase.client
      .from('profiles')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle<{ id: string }>();
    this.throwIfError(existingError);
    if (existing) return;

    const row = await this.buildProfileUpsertRow(authUser.id, {
      email: authUser.email ?? '',
      nombre: this.metadataText(authUser.user_metadata, 'nombre') || this.metadataText(authUser.user_metadata, 'name') || undefined,
      alias: this.metadataText(authUser.user_metadata, 'alias') || undefined,
    });

    const { error } = await this.supabase.client.from('profiles').insert(row);
    this.throwIfError(error);
  }

  private async buildProfileUpsertRow(userId: string, patch: Partial<User>): Promise<ProfileRow & { id: string }> {
    const existing = this.getUser(userId);
    const { data } = await this.supabase.client.auth.getSession();
    const authUser = data.session?.user?.id === userId ? data.session.user : null;
    const email = patch.email ?? existing?.email ?? authUser?.email ?? '';
    const fallbackAlias = email.split('@')[0] || 'Usuario';
    const metadataNombre = this.metadataText(authUser?.user_metadata, 'nombre');
    const metadataName = this.metadataText(authUser?.user_metadata, 'name');
    const metadataAlias = this.metadataText(authUser?.user_metadata, 'alias');

    return {
      id: userId,
      email,
      nombre: (patch.nombre ?? existing?.nombre ?? metadataNombre) || metadataName || fallbackAlias,
      alias: (patch.alias ?? existing?.alias ?? metadataAlias) || fallbackAlias,
      descripcion: patch.descripcion ?? existing?.descripcion ?? '',
      avatar_color: patch.avatarColor ?? existing?.avatarColor ?? '#5b5fc7',
    };
  }

  private metadataText(metadata: Record<string, unknown> | undefined, key: string): string {
    const value = metadata?.[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  private async loadUsers(): Promise<void> {
    const { data: profileRows, error: profilesError } = await this.supabase.client
      .from('profiles')
      .select('id,email,nombre,alias,descripcion,avatar_color')
      .returns<ProfileRow[]>();
    this.throwIfError(profilesError);

    const { data: friendshipRows, error: friendshipsError } = await this.supabase.client
      .from('friendships')
      .select('user_id,friend_id,status')
      .eq('status', 'accepted')
      .returns<FriendshipRow[]>();
    this.throwIfError(friendshipsError);

    const friendMap = new Map<string, string[]>();
    for (const friendship of friendshipRows ?? []) {
      this.pushMap(friendMap, friendship.user_id, friendship.friend_id);
      this.pushMap(friendMap, friendship.friend_id, friendship.user_id);
    }

    this.users.set(
      (profileRows ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        password: '',
        nombre: row.nombre,
        alias: row.alias,
        descripcion: row.descripcion ?? '',
        avatarColor: row.avatar_color,
        friendIds: friendMap.get(row.id) ?? [],
      }))
    );
  }

  private async loadTrips(): Promise<void> {
    const { data: tripRows, error: tripsError } = await this.supabase.client
      .from('trips')
      .select('id,owner_id,nombre,descripcion,tipo,fecha_inicio,fecha_fin,finalizado,created_at')
      .order('created_at', { ascending: false })
      .returns<TripRow[]>();
    this.throwIfError(tripsError);

    const { data: memberRows, error: membersError } = await this.supabase.client
      .from('trip_members')
      .select('trip_id,user_id')
      .is('left_at', null)
      .returns<TripMemberRow[]>();
    this.throwIfError(membersError);

    const membersByTrip = this.groupIds(memberRows ?? [], 'trip_id', 'user_id');
    this.trips.set((tripRows ?? []).map((row) => this.mapTrip(row, membersByTrip.get(row.id) ?? [])));
  }

  private async loadExpenses(): Promise<void> {
    const { data: expenseRows, error: expensesError } = await this.supabase.client
      .from('expenses')
      .select('id,trip_id,titulo,monto,pagado_por,metodo_reparto,fecha,created_at')
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .returns<ExpenseRow[]>();
    this.throwIfError(expensesError);

    const { data: participantRows, error: participantsError } = await this.supabase.client
      .from('expense_participants')
      .select('expense_id,user_id,weight,share_amount,share_percentage')
      .returns<ExpenseParticipantRow[]>();
    this.throwIfError(participantsError);

    const participantsByExpense = this.groupShares(participantRows ?? []);
    this.expenses.set(
      (expenseRows ?? []).map((row) => this.mapExpense(row, participantsByExpense.get(row.id) ?? []))
    );
  }

  private async loadPhotos(): Promise<void> {
    const { data: rows, error } = await this.supabase.client
      .from('trip_photos')
      .select('id,trip_id,storage_path,uploaded_by,fecha')
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .returns<PhotoRow[]>();
    this.throwIfError(error);

    const photos = await Promise.all(
      (rows ?? []).map(async (row) => {
        const { data } = await this.supabase.client.storage.from('trip-photos').createSignedUrl(row.storage_path, 60 * 60);
        return this.mapPhoto(row, data?.signedUrl ?? '');
      })
    );

    this.photos.set(photos);
  }

  private async loadPayments(): Promise<void> {
    const { data: rows, error } = await this.supabase.client
      .from('payments')
      .select('id,trip_id,from_user_id,to_user_id,monto,status,created_by,paid_at,created_at')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .returns<PaymentRow[]>();
    this.throwIfError(error);

    this.payments.set((rows ?? []).map((row) => this.mapPayment(row)));
  }

  private async loadChatsAndMessages(): Promise<void> {
    const { data: chatRows, error: chatsError } = await this.supabase.client
      .from('chats')
      .select('id,tipo,nombre,trip_id')
      .order('created_at', { ascending: false })
      .returns<ChatRow[]>();
    this.throwIfError(chatsError);

    const { data: memberRows, error: membersError } = await this.supabase.client
      .from('chat_members')
      .select('chat_id,user_id,last_read_at')
      .returns<ChatMemberRow[]>();
    this.throwIfError(membersError);

    const { data: messageRows, error: messagesError } = await this.supabase.client
      .from('messages')
      .select('id,chat_id,sender_id,texto,fecha')
      .is('deleted_at', null)
      .order('fecha', { ascending: true })
      .returns<MessageRow[]>();
    this.throwIfError(messagesError);

    const membersByChat = this.groupIds(memberRows ?? [], 'chat_id', 'user_id');
    const readsByChat = this.groupChatReads(memberRows ?? []);
    this.chats.set((chatRows ?? []).map((row) => this.mapChat(row, membersByChat.get(row.id) ?? [], readsByChat.get(row.id) ?? {})));
    this.messages.set((messageRows ?? []).map((row) => this.mapMessage(row)));
  }

  private mapTrip(row: TripRow, memberIds: string[]): Trip {
    return {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      tipo: row.tipo,
      fechaInicio: this.toIso(row.fecha_inicio),
      fechaFin: row.fecha_fin ? this.toIso(row.fecha_fin) : undefined,
      ownerId: row.owner_id,
      memberIds,
      finalizado: row.finalizado,
      createdAt: row.created_at,
    };
  }

  private mapExpense(row: ExpenseRow, participantShares: ExpenseParticipantShare[]): Expense {
    const shares = this.normalizeExpenseShares(
      participantShares.map((share) => share.userId),
      row.metodo_reparto ?? 'equal',
      participantShares
    );

    return {
      id: row.id,
      tripId: row.trip_id,
      titulo: row.titulo,
      monto: Number(row.monto),
      pagadoPor: row.pagado_por,
      participantes: shares.map((share) => share.userId),
      metodoReparto: row.metodo_reparto ?? 'equal',
      participantShares: shares,
      fecha: this.toIso(row.fecha),
      createdAt: row.created_at,
    };
  }

  private mapPhoto(row: PhotoRow, dataUrl: string): Photo {
    return {
      id: row.id,
      tripId: row.trip_id,
      dataUrl,
      uploadedBy: row.uploaded_by,
      fecha: row.fecha,
    };
  }

  private mapPayment(row: PaymentRow): Payment {
    return {
      id: row.id,
      tripId: row.trip_id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      monto: Number(row.monto),
      status: row.status,
      createdBy: row.created_by,
      paidAt: row.paid_at ?? undefined,
      createdAt: row.created_at,
    };
  }

  private mapChat(row: ChatRow, memberIds: string[], memberLastReadAt: Record<string, string | null> = {}): Chat {
    return {
      id: row.id,
      tipo: row.tipo,
      nombre: row.nombre ?? undefined,
      memberIds,
      memberLastReadAt,
      tripId: row.trip_id ?? undefined,
    };
  }

  private mapMessage(row: MessageRow): Message {
    return {
      id: row.id,
      chatId: row.chat_id,
      senderId: row.sender_id,
      texto: row.texto,
      fecha: row.fecha,
    };
  }

  private clear(): void {
    this.users.set([]);
    this.trips.set([]);
    this.expenses.set([]);
    this.photos.set([]);
    this.payments.set([]);
    this.chats.set([]);
    this.messages.set([]);
  }

  private pushMap(map: Map<string, string[]>, key: string, value: string): void {
    const values = map.get(key) ?? [];
    if (!values.includes(value)) values.push(value);
    map.set(key, values);
  }

  private groupIds<T extends Record<K, string> & Record<V, string>, K extends keyof T, V extends keyof T>(
    rows: T[],
    groupKey: K,
    valueKey: V
  ): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const row of rows) {
      this.pushMap(map, row[groupKey], row[valueKey]);
    }
    return map;
  }

  private groupShares(rows: ExpenseParticipantRow[]): Map<string, ExpenseParticipantShare[]> {
    const map = new Map<string, ExpenseParticipantShare[]>();
    for (const row of rows) {
      const values = map.get(row.expense_id) ?? [];
      values.push({
        userId: row.user_id,
        weight: Number(row.weight ?? 1),
        shareAmount: row.share_amount == null ? undefined : Number(row.share_amount),
        sharePercentage: row.share_percentage == null ? undefined : Number(row.share_percentage),
      });
      map.set(row.expense_id, values);
    }
    return map;
  }

  private groupChatReads(rows: ChatMemberRow[]): Map<string, Record<string, string | null>> {
    const map = new Map<string, Record<string, string | null>>();
    for (const row of rows) {
      const values = map.get(row.chat_id) ?? {};
      values[row.user_id] = row.last_read_at;
      map.set(row.chat_id, values);
    }
    return map;
  }

  private normalizeExpenseShares(
    participantes: string[],
    metodoReparto: ExpenseSplitMethod,
    shares: ExpenseParticipantShare[] = []
  ): ExpenseParticipantShare[] {
    const map = new Map(shares.map((share) => [share.userId, share]));
    return participantes.map((userId) => {
      const existing = map.get(userId);
      return {
        userId,
        weight: metodoReparto === 'weighted' ? Number(existing?.weight ?? 1) : Number(existing?.weight ?? 1),
        shareAmount: metodoReparto === 'exact' ? Number(existing?.shareAmount ?? 0) : undefined,
        sharePercentage: metodoReparto === 'percentage' ? Number(existing?.sharePercentage ?? 0) : undefined,
      };
    });
  }

  private toDateOnly(value: string): string {
    return new Date(value).toISOString().slice(0, 10);
  }

  private toIso(value: string): string {
    return value.includes('T') ? value : `${value}T00:00:00.000Z`;
  }

  private validFinishDate(trip: Trip | undefined): string {
    const today = this.toDateOnly(new Date().toISOString());
    const start = trip?.fechaInicio ? this.toDateOnly(trip.fechaInicio) : today;
    return today >= start ? today : start;
  }

  private uuid(): string {
    if ('randomUUID' in crypto) return crypto.randomUUID();
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  private dataUrlToBlob(dataUrl: string): { blob: Blob; extension: string; contentType: string } {
    const [header, base64] = dataUrl.split(',');
    const contentType = header.match(/data:(.*?);base64/)?.[1] ?? 'image/jpeg';
    const extension = contentType.split('/')[1] || 'jpg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return { blob: new Blob([bytes], { type: contentType }), extension, contentType };
  }

  private throwIfError(error: { message: string } | null): void {
    if (error) throw new Error(error.message);
  }
}
