// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Platform feature routes.
// Location: apps/frontend/src/app/features/platform/routes.ts
//
// Registered under `/platform/*` in the top-level route config
// (see 07_Navigation_Structure.md §9). All routes here require Platform_Admin.
// ─────────────────────────────────────────────────────────────────────────────

import type { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { roleGuard } from '@core/auth/role.guard';

export default [
  {
    path: '',
    canActivate: [authGuard, roleGuard('Platform_Admin')],
    children: [
      {
        path: 'health',
        loadComponent: () =>
          import('./health/platform-health-dashboard.component')
            .then(m => m.PlatformHealthDashboardComponent),
        data: { breadcrumb: 'Platform Health' },
      },
      // Future platform admin routes — registered here as they're built:
      // { path: 'tenants',  loadComponent: () => import(...) },
      // { path: 'users',    loadComponent: () => import(...) },
      // { path: 'agents',   loadComponent: () => import(...) },
      // { path: 'metering', loadComponent: () => import(...) },
      // { path: 'pricing',  loadComponent: () => import(...) },
      // { path: 'settings', loadComponent: () => import(...) },
      // { path: 'features', loadComponent: () => import(...) },

      { path: '', redirectTo: 'health', pathMatch: 'full' },
    ],
  },
] satisfies Routes;
