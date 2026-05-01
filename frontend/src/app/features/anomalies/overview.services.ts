// FinOps Platform Design System v1.1 — Updated v2
// Uses shared mock-data utilities: mockList, mockSummary, mockMutation, sparks, DEFAULT_CURRENCY
// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Consolidated services for Batch 10 — Overview.

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { sparks, CUR } from '@lib/utils/mock-data.utils';
import type { MyDashboardData, ExecutiveDashboardData, TenantHealthData } from '@shared/types/overview.types';
import { environment } from '@env/environment';

// ─────────────────────────────────────────────────────────────────────────────
// My Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const MY_DASH_MOCK: MyDashboardData = {
  userDisplayName: 'Ahmed Hassan',
  userRole: 'Tenant_Admin',
  kpis: {
    monthToDateSpend:  { value: 148_420, currency: CUR, deltaPercent: 8.4, deltaDirection: 'up',     sparkline: sparks(140_000) },
    pendingApprovals:  { value: 6,                      deltaPercent: 20,  deltaDirection: 'up',     sparkline: sparks(5) },
    activeAnomalies:   { value: 3,                      deltaPercent: -25, deltaDirection: 'down',   sparkline: sparks(4) },
    budgetStatus:      { value: 82,                     deltaPercent: 6.2, deltaDirection: 'up',     sparkline: sparks(77) },
  },
  spendTrend: [
    { period: 'Oct 25', actual: 86_400,  budget: 100_000 },
    { period: 'Nov 25', actual: 92_800,  budget: 100_000 },
    { period: 'Dec 25', actual: 104_200, budget: 110_000 },
    { period: 'Jan 26', actual: 118_400, budget: 130_000 },
    { period: 'Feb 26', actual: 136_800, budget: 140_000 },
    { period: 'Mar 26', actual: 136_800, budget: 140_000 },
    { period: 'Apr 26', actual: 148_420, budget: 160_000, forecast: 172_000 },
  ],
  alerts: [
    { id: 'al-001', type: 'approval',    severity: 'Critical', message: 'AWS Savings Plan commitment requires approval — AED 23,667/mo savings at risk', createdAt: '2026-04-13T08:00:00Z', route: '/coordinate/approvals' },
    { id: 'al-002', type: 'anomaly',     severity: 'High',     message: 'AI Research spend +40% in last 24h — AED 48,420 above 7-day average',           createdAt: '2026-04-12T11:00:00Z', route: '/anomalies' },
    { id: 'al-003', type: 'budget',      severity: 'High',     message: 'AI Research BU at 82% of annual budget — 18 days remaining in fiscal year',      createdAt: '2026-04-13T06:00:00Z', route: '/budgets' },
    { id: 'al-004', type: 'governance',  severity: 'Medium',   message: '142 untagged production resources — AED 284,600 unattributed cost',              createdAt: '2026-04-13T07:00:00Z', route: '/manage/tagging' },
  ],
  quickLinks: [
    { label: 'Approvals queue',   route: '/coordinate/approvals',  icon: 'checkmark-circle-outline', badge: 6 },
    { label: 'Cost Explorer',     route: '/cost/explorer',         icon: 'bar-chart-outline' },
    { label: 'Active anomalies',  route: '/anomalies',             icon: 'warning-outline',          badge: 3 },
    { label: 'Budget overview',   route: '/budgets',               icon: 'wallet-outline' },
    { label: 'Tag hygiene',       route: '/manage/tagging',        icon: 'pricetag-outline' },
    { label: 'Support center',    route: '/admin/support',         icon: 'chatbox-outline' },
  ],
};

@Injectable({ providedIn: 'root' })
export class MyDashboardService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<MyDashboardData>(`${environment.apiUrl}/overview/my-dashboard`)
  getDashboard(): Observable<MyDashboardData> { return of(MY_DASH_MOCK).pipe(delay(600)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Executive Summary
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS = ['Oct 25','Nov 25','Dec 25','Jan 26','Feb 26','Mar 26'];
const EXEC_MOCK: ExecutiveDashboardData = {
  kpis: {
    totalSpend:          { value: 4_218_420, currency: CUR, deltaPercent: 8.4,  deltaDirection: 'up',      sparkline: sparks(3_900_000) },
    momChangePct:        { value: 8.4,                      deltaPercent: 2.1,  deltaDirection: 'up',      sparkline: sparks(6) },
    budgetUtilization:   { value: 74,                       deltaPercent: 4.2,  deltaDirection: 'up',      sparkline: sparks(70) },
    forecastAccuracy:    { value: 94.2,                     deltaPercent: 1.8,  deltaDirection: 'up',      sparkline: sparks(92) },
    optimizationSavings: { value: 1_284_600, currency: CUR, deltaPercent: 22.4, deltaDirection: 'up',      sparkline: sparks(1_050_000) },
    finOpsMaturityScore: { value: 58,                       deltaPercent: 8.4,  deltaDirection: 'up',      sparkline: sparks(54) },
  },
  spendTrend: [
    { period: 'Oct 25', actual: 3_142_400, budget: 3_600_000, forecast: undefined },
    { period: 'Nov 25', actual: 3_484_200, budget: 3_800_000, forecast: undefined },
    { period: 'Dec 25', actual: 3_812_800, budget: 4_000_000, forecast: undefined },
    { period: 'Jan 26', actual: 3_924_400, budget: 4_200_000, forecast: undefined },
    { period: 'Feb 26', actual: 3_890_200, budget: 4_200_000, forecast: undefined },
    { period: 'Mar 26', actual: 3_893_000, budget: 4_200_000, forecast: undefined },
    { period: 'Apr 26', actual: 4_218_420, budget: 5_000_000, forecast: 4_820_000 },
    { period: 'May 26', actual: undefined as unknown as number, budget: 5_000_000, forecast: 5_120_000 },
    { period: 'Jun 26', actual: undefined as unknown as number, budget: 5_000_000, forecast: 5_340_000 },
  ],
  providerSpend: [
    { provider: 'AWS',   amount: 2_124_840, pct: 50.4 },
    { provider: 'Azure', amount: 1_264_200, pct: 30.0 },
    { provider: 'GCP',   amount: 624_600,   pct: 14.8 },
    { provider: 'On-Prem',amount: 204_780,  pct: 4.8 },
  ],
  topMovers: [
    { name:'GPU Cluster (AI Research)',  provider:'AWS',   domain:'AI Research',     changePct:+42.8, changeAmt:+48_420, currency:CUR, direction:'increase', sparkline:sparks(100_000) },
    { name:'Azure D-Series (Digital)',   provider:'Azure', domain:'Digital Products', changePct:+28.4, changeAmt:+32_400, currency:CUR, direction:'increase', sparkline:sparks(115_000) },
    { name:'Snowflake Enterprise',       provider:'GCP',   domain:'Data Platform',   changePct:+18.2, changeAmt:+24_800, currency:CUR, direction:'increase', sparkline:sparks(136_000) },
    { name:'K8s Savings Plan (realized)',provider:'AWS',   domain:'Platform',        changePct:-24.6, changeAmt:-28_600, currency:CUR, direction:'decrease', sparkline:sparks(92_000) },
    { name:'Dev Env Right-sizing',       provider:'Azure', domain:'Engineering',     changePct:-18.4, changeAmt:-12_840, currency:CUR, direction:'decrease', sparkline:sparks(70_000) },
  ],
  narrative: {
    summary: 'Total platform spend in April reached AED 4.22M (+8.4% MoM), primarily driven by AI Research GPU workloads (+42.8%) and Digital Products Azure growth (+28.4%). Optimization savings of AED 1.28M have been realized YTD, representing 30.4% of the identified opportunity. FinOps maturity improved to 58/100 (+8.4%). Two KPIs require executive attention: AI Research budget utilization (82%) and 6 pending savings approvals with AED 284K monthly impact.',
    agentId: 'A04', agentName: 'Reporting & Analytics Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      'Total April spend AED 4.22M (+8.4%) — AI Research GPU growth primary driver',
      'AED 1.28M optimization savings realized YTD (+22.4%) — accelerating savings capture',
      'FinOps maturity 58/100 (+8.4%) — on track for Walk→Run transition Q3 2026',
      '6 pending approvals with AED 284K/mo savings impact awaiting decision',
      'Forecast accuracy 94.2% (+1.8pp) — forecasting model improving',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class ExecutiveSummaryService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<ExecutiveDashboardData>(`${environment.apiUrl}/overview/executive`)
  getDashboard(): Observable<ExecutiveDashboardData> { return of(EXEC_MOCK).pipe(delay(700)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant Health
// ─────────────────────────────────────────────────────────────────────────────
const TENANT_HEALTH_MOCK: TenantHealthData = {
  kpis: {
    maturityScore:    { value: 58,         deltaPercent: 8.4, deltaDirection: 'up',  sparkline: sparks(54) },
    agentsHealthy:    { value: 28,         deltaPercent: 0,   deltaDirection: 'neutral', sparkline: sparks(28) },
    governancePosture:{ value: 74,         deltaPercent: 2.8, deltaDirection: 'up',  sparkline: sparks(72) },
    pendingSavings:   { value: 978_400, currency: CUR, deltaPercent: 14.2, deltaDirection: 'up', sparkline: sparks(857_000) },
  },
  agentsByTier: [
    { tier: 'Understand',   healthy: 4, degraded: 0, failed: 0, total: 5 },
    { tier: 'Quantify',     healthy: 4, degraded: 0, failed: 0, total: 4 },
    { tier: 'Optimize',     healthy: 7, degraded: 2, failed: 0, total: 9 },
    { tier: 'Manage',       healthy: 6, degraded: 0, failed: 0, total: 6 },
    { tier: 'Coordinate',   healthy: 5, degraded: 0, failed: 0, total: 5 },
    { tier: 'Orchestration',healthy: 2, degraded: 1, failed: 0, total: 3 },
  ],
  radarData: [
    { capability: 'Data Ingestion',     score: 82 }, { capability: 'Cost Normalisation', score: 79 },
    { capability: 'Allocation',         score: 74 }, { capability: 'Reporting',          score: 68 },
    { capability: 'Anomaly Detection',  score: 72 }, { capability: 'Forecasting',        score: 64 },
    { capability: 'Budget Management',  score: 56 }, { capability: 'Benchmarking',       score: 48 },
    { capability: 'Unit Economics',     score: 42 }, { capability: 'Workload Optim.',    score: 61 },
    { capability: 'Rate Optimisation',  score: 55 }, { capability: 'Governance',         score: 52 },
  ],
  narrative: {
    summary: 'Platform health is Good. 28 of 32 agents are healthy; GPU Optimizer (A16) is degraded and under investigation. Governance posture is 74% (+2.8pp). AED 978K in pending optimization savings across 6 pending approvals. FinOps maturity 58/100 — Walk tier. No critical agent failures or SLA violations active.',
    agentId: 'A27', agentName: 'Orchestrator Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      '28 / 32 agents healthy — A16 GPU Optimizer degraded, investigation in progress',
      'Governance posture 74% (+2.8pp) — improving compliance across all dimensions',
      'AED 978K pending optimization savings — 6 approvals required',
      'Tag compliance 78.4% (+2.8pp) — auto-tagging reducing unattributed cost',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class TenantHealthService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<TenantHealthData>(`${environment.apiUrl}/overview/tenant-health`)
  getDashboard(): Observable<TenantHealthData> { return of(TENANT_HEALTH_MOCK).pipe(delay(600)); }
}
