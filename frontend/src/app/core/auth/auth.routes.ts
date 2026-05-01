// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Auth feature routes.
// Location: apps/frontend/src/app/features/auth/auth.routes.ts
//
// Registered in the top-level app.routes.ts as:
//   { path: '', loadChildren: () => import('./features/auth/auth.routes').then(r => r.authRoutes) }
//
// These routes are PUBLIC (no authGuard). Everything else in the app is guarded.
// ─────────────────────────────────────────────────────────────────────────────

import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'mfa',
    loadComponent: () =>
      import('./mfa/mfa.component').then(m => m.MfaComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  // Future: password reset confirmation (after clicking email link)
  // {
  //   path: 'reset-password',
  //   loadComponent: () => import('./reset-password/reset-password.component')
  //     .then(m => m.ResetPasswordComponent),
  // },
];
