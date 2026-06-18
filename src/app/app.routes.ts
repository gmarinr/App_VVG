import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // --- Autenticación ---
  { path: 'login', loadComponent: () => import('./pages/auth/login.page').then((m) => m.LoginPage) },
  { path: 'register', loadComponent: () => import('./pages/auth/register.page').then((m) => m.RegisterPage) },

  // --- Shell con tabs (privado) ---
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'historial', loadComponent: () => import('./pages/history/history.page').then((m) => m.HistoryPage) },
      { path: 'crear', loadComponent: () => import('./pages/create-trip/create-trip.page').then((m) => m.CreateTripPage) },
      { path: 'mensajes', loadComponent: () => import('./pages/messages/messages.page').then((m) => m.MessagesPage) },
      { path: 'cuenta', loadComponent: () => import('./pages/account/account.page').then((m) => m.AccountPage) },
    ],
  },

  // --- Detalle (privado) ---
  { path: 'viaje/:id', canActivate: [authGuard], loadComponent: () => import('./pages/trip-detail/trip-detail.page').then((m) => m.TripDetailPage) },
  { path: 'viaje/:id/agregar-gasto', canActivate: [authGuard], loadComponent: () => import('./pages/add-expense/add-expense.page').then((m) => m.AddExpensePage) },
  { path: 'viaje/:id/gasto/:expenseId', canActivate: [authGuard], loadComponent: () => import('./pages/expense-detail/expense-detail.page').then((m) => m.ExpenseDetailPage) },
  { path: 'chat/:id', canActivate: [authGuard], loadComponent: () => import('./pages/chat/chat.page').then((m) => m.ChatPage) },
  { path: 'chat-nuevo', canActivate: [authGuard], loadComponent: () => import('./pages/new-chat/new-chat.page').then((m) => m.NewChatPage) },
  { path: 'amigos/agregar', canActivate: [authGuard], loadComponent: () => import('./pages/add-friend/add-friend.page').then((m) => m.AddFriendPage) },
  { path: 'perfil/:id', canActivate: [authGuard], loadComponent: () => import('./pages/user-profile/user-profile.page').then((m) => m.UserProfilePage) },

  { path: '**', redirectTo: 'login' },
];
