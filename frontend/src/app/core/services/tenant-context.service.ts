// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// TenantContextService — reactive access to the active tenant's properties.
// Location: apps/frontend/src/app/core/tenant/tenant-context.service.ts
//
// Thin convenience layer over AuthService that exposes tenant-specific fields
// as individual computed signals. Every UI screen that displays currency or
// formats localized values should read from here, not from AuthService directly.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, inject, computed } from '@angular/core';
import { AuthService, type TenantSummary } from '@core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  readonly #auth = inject(AuthService);

  /** The currently active tenant, or null if no session or no tenant context. */
  readonly currentTenant = this.#auth.activeTenant;

  /** All tenants the signed-in user has access to. Multi-tenant users see >1. */
  readonly availableTenants = this.#auth.tenants;

  /** The ISO 4217 currency code for the active tenant. Used by formatCurrency. */
  readonly currencyCode = computed<string>(() =>
    this.currentTenant()?.primaryCurrencyCode ?? 'USD');

  /** The BCP 47 locale for the active tenant. Used by Intl formatters. */
  readonly locale = computed<string>(() =>
    this.currentTenant()?.primaryLocale ?? 'en-US');

  /** The IANA timezone for the active tenant. */
  readonly timezone = computed<string>(() =>
    this.currentTenant()?.primaryTimezone ?? 'UTC');

  /** Short display name for the active tenant (for chrome, e.g., switcher). */
  readonly tenantDisplayName = computed<string>(() =>
    this.currentTenant()?.displayName ?? '');

  /** True when the user has access to multiple tenants (drives tenant switcher visibility). */
  readonly hasMultipleTenants = computed<boolean>(() =>
    this.availableTenants().length > 1);

  /** Switch active tenant — delegates to AuthService which mints a new access token. */
  switchTenant(tenantId: string) {
    return this.#auth.switchTenant(tenantId);
  }
}
