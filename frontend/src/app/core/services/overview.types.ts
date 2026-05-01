// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/overview.types.ts
// Covers: MyDashboard, ExecutiveSummary, TenantHealth

import type { KpiMetric, AgentNarrative, DeltaDirection } from '@shared/types/common.types';

// ═══════════════════════════════════════════════════════════════════════════
// MY DASHBOARD  (personalised — all roles)
// ═══════════════════════════════════════════════════════════════════════════

export interface MyDashboardKpis {
  monthToDateSpend:   KpiMetric & { currency: string };
  pendingApprovals:   KpiMetric;
  activeAnomalies:    KpiMetric;
  budgetStatus:       KpiMetric; // % consumed of personal BU budget
}

export interface SpendPoint { period: string; actual: number; budget?: number; forecast?: number; }

export interface QuickLink  { label: string; route: string; icon: string; badge?: number; }

export interface AlertItem {
  id:        string;
  type:      'anomaly' | 'budget' | 'approval' | 'governance';
  severity:  'Critical' | 'High' | 'Medium' | 'Low';
  message:   string;
  createdAt: string;
  route:     string;
}

export interface MyDashboardData {
  userDisplayName:  string;
  userRole:         string;
  kpis:             MyDashboardKpis;
  spendTrend:       SpendPoint[];
  alerts:           AlertItem[];
  quickLinks:       QuickLink[];
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTIVE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

export interface ExecutiveKpis {
  totalSpend:         KpiMetric & { currency: string };
  momChangePct:       KpiMetric;
  budgetUtilization:  KpiMetric;
  forecastAccuracy:   KpiMetric;
  optimizationSavings:KpiMetric & { currency: string };
  finOpsMaturityScore:KpiMetric;
}

export interface ProviderSpendItem { provider: string; amount: number; pct: number; }

export interface CostMover {
  name:      string;
  provider:  string;
  domain:    string;
  changePct: number;
  changeAmt: number;
  currency:  string;
  direction: 'increase' | 'decrease';
  sparkline: number[];
}

export interface ExecutiveDashboardData {
  kpis:           ExecutiveKpis;
  spendTrend:     SpendPoint[];
  providerSpend:  ProviderSpendItem[];
  topMovers:      CostMover[];
  narrative:      AgentNarrative;
}

// ═══════════════════════════════════════════════════════════════════════════
// TENANT HEALTH
// ═══════════════════════════════════════════════════════════════════════════

export interface TenantHealthKpis {
  maturityScore:    KpiMetric;
  agentsHealthy:    KpiMetric;
  governancePosture:KpiMetric;
  pendingSavings:   KpiMetric & { currency: string };
}

export interface AgentHealthSummaryItem { tier: string; healthy: number; degraded: number; failed: number; total: number; }
export interface RadarPoint             { capability: string; score: number; }

export interface TenantHealthData {
  kpis:             TenantHealthKpis;
  agentsByTier:     AgentHealthSummaryItem[];
  radarData:        RadarPoint[];
  narrative:        AgentNarrative;
}
