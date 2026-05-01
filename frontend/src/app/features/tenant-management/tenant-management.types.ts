// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Shared DTOs for Tenant Management.
// Location: libs/shared/src/lib/types/tenant-management.types.ts
// ─────────────────────────────────────────────────────────────────────────────

import { Money } from './envelope.types';

export type TenantStatus =
  | 'Active'
  | 'Onboarding'
  | 'Suspended'
  | 'Degraded'
  | 'Offboarding'
  | 'Archived';

export type TenantTierCode = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'PLATFORM';

export interface TenantListRow {
  tenantId: string;
  tenantCode: string;
  legalName: string;
  displayName: string;
  tierCode: TenantTierCode;
  tierName: string;
  status: TenantStatus;
  primaryCurrencyCode: string;         // ISO 4217
  primaryLocale: string;                // BCP 47
  primaryTimezone: string;              // IANA
  region: string;                       // e.g., "UAE", "Saudi Arabia", "Global"

  // Operational metrics for the list view
  userCount: number;
  agentCount: number;
  integrationCount: number;
  fpConsumedThisMonth: number;
  fpQuotaMonthly: number;
  fpQuotaPercent: number;               // 0-100, pre-computed
  spendThisMonth: Money;
  activeAlerts: number;
  criticalAlerts: number;

  // Lifecycle timestamps
  onboardedAt: string;                  // ISO 8601 UTC
  lastActivityAt: string;               // ISO 8601 UTC
  subscriptionRenewsAt: string | null;  // ISO 8601 UTC or null

  // Billing state
  billingStatus: 'Current' | 'Overdue' | 'Grace_Period' | 'Pre_Paid' | 'Trial';
}

// Filter state (persisted in URL query params per 05 API conventions)
export interface TenantListFilters {
  status?: TenantStatus[];
  tierCode?: TenantTierCode[];
  region?: string[];
  billingStatus?: string[];
  search?: string;
}

// Sort state
export interface TenantListSort {
  field: keyof TenantListRow;
  direction: 'asc' | 'desc';
}

// List query params (for service)
export interface TenantListQuery {
  limit: number;
  offset: number;
  filters?: TenantListFilters;
  sort?: TenantListSort;
}

// Summary stats shown above the grid (consistent pattern across List screens)
export interface TenantListSummary {
  totalTenants: number;
  activeTenants: number;
  onboardingTenants: number;
  degradedOrSuspended: number;
  totalMonthlyFp: number;
  totalMonthlySpend: Money;
}

// Bulk action request
export type TenantBulkAction = 'Suspend' | 'Reactivate' | 'Archive' | 'Export';

export interface TenantBulkActionRequest {
  tenantIds: string[];
  action: TenantBulkAction;
  reason?: string;                      // required for Suspend
}
