import { Injectable } from '@angular/core';

// Envoltorio simple sobre localStorage. Centraliza la persistencia para que,
// al conectar Supabase, solo haya que reemplazar este servicio (y data.service).
@Injectable({ providedIn: 'root' })
export class StorageService {
  private prefix = 'vvg.';

  get<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(this.prefix + key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  remove(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }
}
