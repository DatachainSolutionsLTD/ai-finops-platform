// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// AuthInterceptor — attaches bearer token, handles 401 with refresh-then-retry.
// Location: apps/frontend/src/app/core/auth/auth.interceptor.ts
//
// Per 06_Authentication_Flow.md §5.2. Critical behaviors:
//   - Attach Authorization: Bearer {accessToken} to every outgoing request
//   - Attach X-Correlation-Id for request tracing (per 05 §7.1)
//   - On 401: trigger AuthService.refresh(), then retry the original request once
//   - Deduplication: multiple concurrent 401s share ONE refresh call
//   - Skip auth handling for requests marked with SKIP_AUTH context (login/refresh/logout)
// ─────────────────────────────────────────────────────────────────────────────

import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError, switchMap } from 'rxjs';

import { AuthService, SKIP_AUTH } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Skip auth handling entirely for requests flagged with SKIP_AUTH
  // (login, refresh, logout — all with their own auth semantics)
  if (req.context.get(SKIP_AUTH)) {
    return next(addCorrelationId(req));
  }

  const token = auth.accessToken();
  const authed = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          'X-Correlation-Id': generateCorrelationId(),
        },
      })
    : addCorrelationId(req);

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      // Only handle 401s that aren't on auth endpoints (belt-and-braces — the
      // SKIP_AUTH check above already handles that, but this protects against
      // consumer error).
      if (err.status !== 401 || isAuthEndpoint(req)) {
        return throwError(() => err);
      }

      // Attempt refresh-then-retry. AuthService.refresh() dedupes concurrent calls.
      return auth.refresh().pipe(
        switchMap(() => {
          const fresh = auth.accessToken();
          if (!fresh) return throwError(() => err);
          const retried = req.clone({
            setHeaders: {
              Authorization: `Bearer ${fresh}`,
              'X-Correlation-Id': generateCorrelationId(),
            },
          });
          return next(retried);
        }),
        catchError((refreshErr) => {
          // Refresh failed — AuthService has already cleared the session and
          // navigated to /login. Propagate the original error to the caller
          // so their error handler can clean up view state.
          return throwError(() => err);
        }),
      );
    }),
  );
};

function addCorrelationId(req: HttpRequest<unknown>): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { 'X-Correlation-Id': generateCorrelationId() },
  });
}

function isAuthEndpoint(req: HttpRequest<unknown>): boolean {
  return req.url.includes('/auth/');
}

function generateCorrelationId(): string {
  // RFC 4122 v4 UUID via crypto.randomUUID (available in modern browsers and Node)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older environments (shouldn't be hit in practice)
  return 'cid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
