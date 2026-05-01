// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Shared DTOs for Platform Health Dashboard.
// Location: libs/shared/src/lib/types/platform-health.types.ts
// Used by both frontend PlatformHealthService and backend routes.
// ─────────────────────────────────────────────────────────────────────────────

import { Money } from './envelope.types';

// ── Time range filter ───────────────────────────────────────────────────────
export type TimeRange = '24h' | '7d' | '30d' | '90d' | 'QTD' | 'YTD';

// ── Platform Health Overview — the single response powering the dashboard ──
export interface PlatformHealthOverview {
  generatedAt: string;                      // ISO 8601 UTC
  timeRange: TimeRange;
  kpis: PlatformHealthKpis;
  narrative: PlatformHealthNarrative | null;
  fpTrend: FpTrendPoint[];
  fpByAgentCategory: AgentCategoryBreakdown[];
  tenantTierDistribution: TenantTierSlice[];
  sloSummary: PlatformSloSummary;
}

export interface PlatformHealthKpis {
  activeTenants: MetricWithDelta<number>;
  fpProcessedToday: MetricWithDelta<number>;
  platformSloPercent: MetricWithDelta<number>;
  criticalAlertsOpen: MetricWithDelta<number>;
}

export interface MetricWithDelta<T> {
  value: T;
  deltaPercent: number | null;              // null if no prior-period comparison available
  deltaDirection: 'up' | 'down' | 'flat';
  sparkline?: number[];                     // optional mini-trend for the KPI card
}

export interface PlatformHealthNarrative {
  content: string;                          // the narrative text
  sourceAgentCode: string;                  // e.g., "A29"
  sourceAgentName: string;                  // e.g., "Explainability Agent"
  generatedAt: string;                      // ISO 8601 UTC
}

export interface FpTrendPoint {
  periodStart: string;                      // ISO 8601 UTC — aligns to time range bucketing
  fpProcessed: number;
  fpBilled: number;
}

export interface AgentCategoryBreakdown {
  category: 'Understand' | 'Quantify' | 'Optimize' | 'Manage' | 'Coordinate' | 'Foundation';
  fpProcessed: number;
  agentCount: number;
}

export interface TenantTierSlice {
  tierCode: string;                         // STARTER, PROFESSIONAL, ENTERPRISE, PLATFORM
  tierName: string;
  tenantCount: number;
}

export interface PlatformSloSummary {
  overallPercent: number;                   // 0-100
  targetPercent: number;                    // e.g., 99.9
  ingestionPercent: number;
  apiPercent: number;
  agentExecutionPercent: number;
}

// ── Active Tenant row (drill-down grid) ─────────────────────────────────────
export interface ActiveTenantRow {
  tenantId: string;
  tenantCode: string;
  displayName: string;
  tierCode: string;
  tierName: string;
  status: 'Active' | 'Suspended' | 'Onboarding' | 'Offboarding' | 'Degraded';
  fpProcessedToday: number;
  fpQuotaPercent: number;                   // 0-100, consumption vs monthly quota
  spendThisPeriod: Money;
  activeAlerts: number;
  criticalAlerts: number;
  lastActivityAt: string;                   // ISO 8601 UTC
}
