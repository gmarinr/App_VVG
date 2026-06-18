import { Injectable, signal, computed } from '@angular/core';
import { DataService } from './data.service';
import { StorageService } from './storage.service';
import { User } from '../models/models';

// Autenticación local para el MVP. Reemplazar por Supabase Auth al conectar.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserId = signal<string | null>(null);

  // Usuario actualmente logueado (reactivo).
  readonly currentUser = computed<User | null>(() => {
    const id = this.currentUserId();
    return id ? this.data.getUser(id) ?? null : null;
  });

  constructor(private data: DataService, private storage: StorageService) {
    this.currentUserId.set(this.storage.get<string | null>('session', null));
  }

  get userId(): string | null {
    return this.currentUserId();
  }

  isLoggedIn(): boolean {
    return this.currentUserId() != null && !!this.currentUser();
  }

  // Devuelve null si las credenciales son correctas; un mensaje de error si no.
  login(email: string, password: string): string | null {
    const user = this.data.users().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) return 'No existe una cuenta con ese correo.';
    if (user.password !== password) return 'Contraseña incorrecta.';
    this.setSession(user.id);
    return null;
  }

  // Crea la cuenta y deja la sesión iniciada. Devuelve mensaje de error o null.
  register(data: { email: string; password: string; nombre: string; alias: string }): string | null {
    const exists = this.data.users().some((u) => u.email.toLowerCase() === data.email.trim().toLowerCase());
    if (exists) return 'Ya existe una cuenta con ese correo.';
    const user = this.data.createUser({ ...data, email: data.email.trim() });
    this.setSession(user.id);
    return null;
  }

  logout() {
    this.currentUserId.set(null);
    this.storage.remove('session');
  }

  private setSession(userId: string) {
    this.currentUserId.set(userId);
    this.storage.set('session', userId);
  }
}
