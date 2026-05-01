// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Route guards for access control.
// Location: apps/frontend/src/app/core/auth/auth.guard.ts
//
// Per 06_Authentication_Flow.md §8.
//   - authGuard: blocks unauthenticated users
//   - roleGuard(...roles): blocks users without any of the required roles
//   - permissionGuard(permission): blocks users without the specified permission
// ─────────────────────────────────────────────────────────────────────────────

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// ── authGuard — requires authentication ────────────────────────────────────
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  // Preserve the original destination so post-login can return here
  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};

// ── roleGuard — requires at least one of the given roles ───────────────────
export const roleGuard = (...allowedRoles: string[]): CanActivateFn =>
  (_route, _state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    if (auth.hasAnyRole(...allowedRoles)) return true;

    // User is authenticated but lacks required role — send to their default landing
    router.navigate(['/']);
    return false;
  };

// ── permissionGuard — requires a specific permission ───────────────────────
export const permissionGuard = (permission: string): CanActivateFn =>
  (_route, _state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    if (auth.hasPermission(permission)) return true;

    router.navigate(['/']);
    return false;
  };
