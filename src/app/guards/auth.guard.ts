import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Bloquea rutas privadas si no hay sesión iniciada.
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await auth.ensureSessionLoaded()) return true;
  return router.createUrlTree(['/login']);
};
