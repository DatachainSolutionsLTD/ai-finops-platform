// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Application configuration — wires providers, interceptors, and bootstrap.
// Location: apps/frontend/src/app/app.config.ts
//
// This is the central wiring point for the Angular 17 standalone bootstrap.
// It registers the HTTP client with the auth interceptor, providers for the
// Ionic standalone components, routing, and an APP_INITIALIZER that calls
// AuthService.bootstrap() to restore the session from the refresh cookie.
// ─────────────────────────────────────────────────────────────────────────────

import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { AuthService } from '@core/auth/auth.service';

// ── Bootstrap factory — restores session from refresh cookie on page load ───
export function initializeAuth() {
  const auth = inject(AuthService);
  return () => firstValueFrom(auth.bootstrap()).catch(() => false);
}

// ── Application config ──────────────────────────────────────────────────────
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideIonicAngular({
      mode: 'md',               // Material mode — consistent across iOS/Android/Web
      animated: true,
    }),

    // APP_INITIALIZER runs before the app renders — so by the time the first
    // route activates, AuthService.accessToken() is either set (logged in) or
    // null (needs login). Either way, guards work correctly.
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      multi: true,
    },
  ],
};
