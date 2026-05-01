// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// AuthService — the single source of truth for authentication state.
// Location: apps/frontend/src/app/core/auth/auth.service.ts
//
// Per 06_Authentication_Flow.md §7. Exposes reactive signals for accessToken,
// user, tenants, activeTenantId, roles, permissions. Handles login, logout,
// refresh (proactive + reactive, with concurrent-request deduplication),
// tenant switching, and session restoration on page load.
//
// Access tokens are stored in memory only (Angular signal). Refresh tokens
// live in an httpOnly cookie set by the backend and never touch JavaScript.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError, of, EMPTY, Subject, timer } from 'rxjs';
import { tap, catchError, map, finalize, shareReplay, switchMap } from 'rxjs/operators';

import type { SingleResponse } from '@shared/types/envelope.types';
import { environment } from '@env/environment';

// ── HttpContext token to skip auth handling on specific requests ────────────
// Used by the interceptor to avoid recursion on /auth/refresh calls.
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

// ── Types ───────────────────────────────────────────────────────────────────
export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export interface TenantSummary {
  tenantId: string;
  tenantCode: string;
  displayName: string;
  tierCode: string;
  primaryCurrencyCode: string;
  primaryLocale: string;
  primaryTimezone: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;        // ISO 8601 UTC
  user: AuthUser;
  tenants: TenantSummary[];
  defaultTenantId: string;
  roles: string[];
  permissions: string[];
  mfaChallenge?: MfaChallenge;
}

export interface MfaChallenge {
  challengeId: string;
  method: 'TOTP' | 'SMS' | 'Email';
  expiresAt: string;
}

export interface MfaVerifyRequest {
  challengeId: string;
  code: string;
}

export interface RefreshResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
}

// JWT claim decode result (we only need a few fields client-side)
interface JwtClaims {
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  exp: number;                          // unix seconds
  iat: number;
  jti: string;
  impersonating?: { adminUserId: string; targetUserId: string };
}

// Proactive refresh timing — refresh 60s before expiry
const REFRESH_LEAD_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);
  readonly #apiBase = `${environment.apiBaseUrl}/auth`;

  // ── Reactive state signals ──────────────────────────────────────────────
  readonly accessToken = signal<string | null>(null);
  readonly user = signal<AuthUser | null>(null);
  readonly tenants = signal<TenantSummary[]>([]);
  readonly activeTenantId = signal<string | null>(null);
  readonly roles = signal<string[]>([]);
  readonly permissions = signal<string[]>([]);
  readonly impersonating = signal<{ adminUserId: string; targetUserId: string } | null>(null);

  readonly isAuthenticated = computed(() => this.accessToken() !== null);

  readonly activeTenant = computed<TenantSummary | null>(() => {
    const id = this.activeTenantId();
    return id ? this.tenants().find(t => t.tenantId === id) ?? null : null;
  });

  // ── Concurrent refresh deduplication ────────────────────────────────────
  // If multiple requests 401 simultaneously, only ONE refresh call should fire.
  // This observable is shared; subsequent subscribers wait for the same response.
  #refresh$: Observable<void> | null = null;

  // ── Proactive refresh timer ─────────────────────────────────────────────
  #refreshTimerHandle: ReturnType<typeof setTimeout> | null = null;

  // ── Login ────────────────────────────────────────────────────────────────
  login(req: LoginRequest): Observable<LoginResponse> {
    return this.#http.post<SingleResponse<LoginResponse>>(
      `${this.#apiBase}/login`,
      req,
      { withCredentials: true, context: new HttpContext().set(SKIP_AUTH, true) },
    ).pipe(
      map(r => r.data),
      tap(response => {
        if (!response.mfaChallenge) {
          this.#applyAuthentication(response);
        }
      }),
    );
  }

  verifyMfa(req: MfaVerifyRequest): Observable<LoginResponse> {
    return this.#http.post<SingleResponse<LoginResponse>>(
      `${this.#apiBase}/login/mfa`,
      req,
      { withCredentials: true, context: new HttpContext().set(SKIP_AUTH, true) },
    ).pipe(
      map(r => r.data),
      tap(response => this.#applyAuthentication(response)),
    );
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  logout(reason?: 'user' | 'idle' | 'forced'): Observable<void> {
    // Fire-and-forget on the network side; always clear state locally.
    return this.#http.post<void>(
      `${this.#apiBase}/logout`,
      null,
      { withCredentials: true, context: new HttpContext().set(SKIP_AUTH, true) },
    ).pipe(
      catchError(() => of(undefined)),
      finalize(() => {
        this.#clearSession();
        this.#router.navigate(['/login'], {
          queryParams: reason === 'idle' ? { reason: 'idle' } : undefined,
        });
      }),
    );
  }

  // ── Refresh (proactive or reactive from interceptor) ────────────────────
  refresh(): Observable<void> {
    // Concurrent refresh deduplication — if a refresh is already in flight,
    // return the shared observable so all callers wait for the same response.
    if (this.#refresh$) {
      return this.#refresh$;
    }

    this.#refresh$ = this.#http.post<SingleResponse<RefreshResponse>>(
      `${this.#apiBase}/refresh`,
      null,
      { withCredentials: true, context: new HttpContext().set(SKIP_AUTH, true) },
    ).pipe(
      map(r => r.data),
      tap(data => {
        this.accessToken.set(data.accessToken);
        const claims = this.#decodeJwt(data.accessToken);
        if (claims) this.#applyClaims(claims);
        this.#scheduleRefresh(new Date(data.accessTokenExpiresAt));
      }),
      map(() => undefined as void),
      catchError(err => {
        // Refresh failed — session is dead. Clear everything.
        this.#clearSession();
        this.#router.navigate(['/login'], { queryParams: { reason: 'expired' } });
        return throwError(() => err);
      }),
      finalize(() => { this.#refresh$ = null; }),
      shareReplay(1),
    );

    return this.#refresh$;
  }

  // ── Bootstrap on page load ──────────────────────────────────────────────
  // Call this from AppComponent.ngOnInit or via APP_INITIALIZER.
  // Attempts silent refresh from the httpOnly cookie; if successful, the user
  // is still logged in. If it fails, they need to log in again.
  bootstrap(): Observable<boolean> {
    return this.refresh().pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  // ── Tenant switching (multi-tenant users only) ──────────────────────────
  switchTenant(tenantId: string): Observable<void> {
    const hasAccess = this.tenants().some(t => t.tenantId === tenantId);
    if (!hasAccess) {
      return throwError(() => new Error('User does not have access to tenant ' + tenantId));
    }

    return this.#http.post<SingleResponse<RefreshResponse>>(
      `${this.#apiBase}/switch-tenant`,
      { tenantId },
      { withCredentials: true },
    ).pipe(
      map(r => r.data),
      tap(data => {
        this.accessToken.set(data.accessToken);
        const claims = this.#decodeJwt(data.accessToken);
        if (claims) {
          this.#applyClaims(claims);
          this.activeTenantId.set(claims.tenantId);
        }
        this.#scheduleRefresh(new Date(data.accessTokenExpiresAt));
      }),
      map(() => undefined as void),
    );
  }

  // ── Permission checks ──────────────────────────────────────────────────
  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(...candidateRoles: string[]): boolean {
    const own = this.roles();
    return candidateRoles.some(r => own.includes(r));
  }

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  hasAllPermissions(...perms: string[]): boolean {
    const own = this.permissions();
    return perms.every(p => own.includes(p));
  }

  // ── Private helpers ────────────────────────────────────────────────────

  #applyAuthentication(response: LoginResponse): void {
    this.accessToken.set(response.accessToken);
    this.user.set(response.user);
    this.tenants.set(response.tenants);
    this.activeTenantId.set(response.defaultTenantId);
    this.roles.set(response.roles);
    this.permissions.set(response.permissions);

    const claims = this.#decodeJwt(response.accessToken);
    if (claims?.impersonating) {
      this.impersonating.set(claims.impersonating);
    }

    this.#scheduleRefresh(new Date(response.accessTokenExpiresAt));
  }

  #applyClaims(claims: JwtClaims): void {
    // Used during refresh and tenant switch where we only get a new token,
    // not the full LoginResponse.
    this.roles.set(claims.roles);
    this.permissions.set(claims.permissions);
    if (claims.impersonating) {
      this.impersonating.set(claims.impersonating);
    } else {
      this.impersonating.set(null);
    }
  }

  #clearSession(): void {
    this.accessToken.set(null);
    this.user.set(null);
    this.tenants.set([]);
    this.activeTenantId.set(null);
    this.roles.set([]);
    this.permissions.set([]);
    this.impersonating.set(null);

    if (this.#refreshTimerHandle) {
      clearTimeout(this.#refreshTimerHandle);
      this.#refreshTimerHandle = null;
    }
  }

  #scheduleRefresh(expiresAt: Date): void {
    // Clear any previously scheduled refresh
    if (this.#refreshTimerHandle) {
      clearTimeout(this.#refreshTimerHandle);
    }

    const msUntilRefresh = expiresAt.getTime() - Date.now() - REFRESH_LEAD_MS;
    if (msUntilRefresh <= 0) {
      // Token already expired or about to — refresh immediately
      this.refresh().subscribe({ error: () => {} });
      return;
    }

    this.#refreshTimerHandle = setTimeout(() => {
      this.refresh().subscribe({ error: () => {} });
    }, msUntilRefresh);
  }

  #decodeJwt(token: string): JwtClaims | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      // Base64URL decode
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded) as JwtClaims;
    } catch {
      return null;
    }
  }
}
