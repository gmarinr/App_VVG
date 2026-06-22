import { Injectable, signal } from '@angular/core';
import { AuthError } from '@supabase/supabase-js';
import { User } from '../models/models';
import { SupabaseService } from './supabase.service';

interface ProfileRow {
  id: string;
  email: string;
  nombre: string;
  alias: string;
  descripcion: string | null;
  avatar_color: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserId = signal<string | null>(null);
  readonly currentUser = signal<User | null>(null);
  private readonly sessionReady: Promise<void>;

  constructor(private supabase: SupabaseService) {
    this.sessionReady = this.restoreSession();

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user;
      if (!authUser) {
        this.clearSession();
        return;
      }

      setTimeout(() => {
        void this.loadProfile(authUser.id, authUser.email ?? '', authUser.user_metadata);
      }, 0);
    });
  }

  get userId(): string | null {
    return this.currentUserId();
  }

  isLoggedIn(): boolean {
    return this.currentUserId() != null;
  }

  async ensureSessionLoaded(): Promise<boolean> {
    await this.sessionReady;
    return this.isLoggedIn();
  }

  async login(email: string, password: string): Promise<string | null> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) return this.authErrorMessage(error);
    if (!data.user) return 'No se pudo iniciar sesion.';

    await this.loadProfile(data.user.id, data.user.email ?? email.trim(), data.user.user_metadata);
    return null;
  }

  async register(data: { email: string; password: string; nombre: string; alias: string }): Promise<string | null> {
    const { data: result, error } = await this.supabase.client.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        data: {
          nombre: data.nombre.trim(),
          alias: data.alias.trim(),
        },
      },
    });

    if (error) return this.authErrorMessage(error);

    if (!result.session || !result.user) {
      this.clearSession();
      return 'Cuenta creada. Revisa tu correo para confirmar la cuenta antes de iniciar sesion.';
    }

    await this.loadProfile(result.user.id, result.user.email ?? data.email.trim(), result.user.user_metadata);
    return null;
  }

  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.clearSession();
  }

  private async restoreSession(): Promise<void> {
    const { data, error } = await this.supabase.client.auth.getSession();
    if (error || !data.session?.user) {
      this.clearSession();
      return;
    }

    const authUser = data.session.user;
    await this.loadProfile(authUser.id, authUser.email ?? '', authUser.user_metadata);
  }

  private async loadProfile(userId: string, email: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id,email,nombre,alias,descripcion,avatar_color')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();

    if (error || !data) {
      this.setCurrentUser(this.fallbackUser(userId, email, metadata));
      return;
    }

    this.setCurrentUser({
      id: data.id,
      email: data.email,
      password: '',
      nombre: data.nombre,
      alias: data.alias,
      descripcion: data.descripcion ?? '',
      avatarColor: data.avatar_color,
      friendIds: [],
    });
  }

  private setCurrentUser(user: User): void {
    this.currentUserId.set(user.id);
    this.currentUser.set(user);
  }

  private clearSession(): void {
    this.currentUserId.set(null);
    this.currentUser.set(null);
  }

  private fallbackUser(userId: string, email: string, metadata: Record<string, unknown>): User {
    const fallbackAlias = email.split('@')[0] || 'Usuario';
    const nombre = this.metadataText(metadata, 'nombre') || this.metadataText(metadata, 'name') || fallbackAlias;
    const alias = this.metadataText(metadata, 'alias') || fallbackAlias;

    return {
      id: userId,
      email,
      password: '',
      nombre,
      alias,
      descripcion: '',
      avatarColor: '#5b5fc7',
      friendIds: [],
    };
  }

  private metadataText(metadata: Record<string, unknown>, key: string): string {
    const value = metadata[key];
    return typeof value === 'string' ? value : '';
  }

  private authErrorMessage(error: AuthError): string {
    if (error.message.toLowerCase().includes('invalid login credentials')) {
      return 'Correo o contrasena incorrectos.';
    }
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return 'Debes confirmar tu correo antes de iniciar sesion.';
    }
    return error.message;
  }
}
