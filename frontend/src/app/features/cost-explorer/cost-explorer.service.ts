// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/understand/cost/cost-explorer.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type CostExplorerQuery, type CostExplorerDashboardData } from '@shared/types/cost-explorer.types';
import { environment } from '@env/environment';

// ── Mock helpers ─────────────────────────────────────────────────────────────
function sparks(base: number, len = 8): number[] {
  return Array.from({ length: len }, () => base + Math.round((Math.random() - 0.5) * base * 0.25));
}
const CUR = 'AED';
const DATES = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 2, i + 1);
  return d.toLocaleDateString('en-AE', { day: '2-digit', month: 'short' });
});

const MOCK: CostExplorerDashboardData = {
  kpis: {
    totalSpend:          { value: 4_820_340, currency: CUR, deltaPercent: 8.4,   deltaDirection: 'up',      sparkline: sparks(4_500_000) },
    forecastedSpend:     { value: 5_340_000, currency: CUR, deltaPercent: 10.8,  deltaDirection: 'up',      sparkline: sparks(5_000_000) },
    budgetUtilization:   { value: 78.2,                     deltaPercent: 4.1,   deltaDirection: 'up',      sparkline: sparks(75) },
    optimizationSavings: { value: 612_400,   currency: CUR, deltaPercent: 22.3,  deltaDirection: 'up',      sparkline: sparks(500_000) },
  },
  trendDates: DATES,
  trendSeries: [
    { name: 'AWS',       data: Array.from({ length: 30 }, () => Math.round(70_000 + Math.random() * 20_000)) },
    { name: 'Azure',     data: Array.from({ length: 30 }, () => Math.round(50_000 + Math.random() * 15_000)) },
    { name: 'GCP',       data: Array.from({ length: 30 }, () => Math.round(28_000 + Math.random() * 10_000)) },
    { name: 'On-Prem',   data: Array.from({ length: 30 }, () => Math.round(12_000 + Math.random() * 5_000)) },
  ],
  byProvider: [
    { label: 'AWS',     amount: 2_142_600, currency: CUR, pct: 44.5 },
    { label: 'Azure',   amount: 1_544_200, currency: CUR, pct: 32.0 },
    { label: 'GCP',     amount:   819_050, currency: CUR, pct: 17.0 },
    { label: 'On-Prem', amount:   314_490, currency: CUR, pct:  6.5 },
  ],
  byService: [
    { label: 'Compute – VM',      amount: 1_832_440, currency: CUR, pct: 38.0 },
    { label: 'GPU – Accelerated', amount:   964_070, currency: CUR, pct: 20.0 },
    { label: 'Storage',           amount:   626_640, currency: CUR, pct: 13.0 },
    { label: 'Managed Database',  amount:   482_030, currency: CUR, pct: 10.0 },
    { label: 'Networking',        amount:   337_420, currency: CUR, pct:  7.0 },
    { label: 'Other',             amount:   577_740, currency: CUR, pct: 12.0 },
  ],
  topDrivers: [
    { resourceId: 'i-0a1b2c3d',    serviceName: 'EC2 p4d.24xlarge',  provider: 'AWS',   region: 'me-central-1', businessUnit: 'AI Research',     amount: 384_200, currency: CUR, mom: 12.4 },
    { resourceId: 'vm-gpu-01',      serviceName: 'Azure NDv4 A100',   provider: 'Azure', region: 'me-central-1', businessUnit: 'Data Platform',    amount: 298_400, currency: CUR, mom:  8.1 },
    { resourceId: 'gke-prod-np-01', serviceName: 'GKE Node Pool',     provider: 'GCP',   region: 'me-central-1', businessUnit: 'Digital Products', amount: 212_100, currency: CUR, mom: -3.2 },
    { resourceId: 'rds-prod-01',    serviceName: 'RDS Aurora',        provider: 'AWS',   region: 'me-central-1', businessUnit: 'Core Banking',     amount: 187_600, currency: CUR, mom:  5.6 },
    { resourceId: 'i-0e5f6a7b',    serviceName: 'EC2 r6i.32xlarge',  provider: 'AWS',   region: 'me-central-1', businessUnit: 'Risk Analytics',   amount: 164_300, currency: CUR, mom:  1.2 },
    { resourceId: 'az-blob-hot',    serviceName: 'Azure Blob Storage', provider: 'Azure', region: 'me-central-1', businessUnit: 'Data Platform',   amount: 143_800, currency: CUR, mom: 19.8 },
    { resourceId: 'bq-prod-01',     serviceName: 'BigQuery Compute',  provider: 'GCP',   region: 'me-central-1', businessUnit: 'Analytics',        amount: 128_900, currency: CUR, mom: -1.4 },
    { resourceId: 'eks-prod-ng',    serviceName: 'EKS Node Group',    provider: 'AWS',   region: 'me-central-1', businessUnit: 'Digital Products', amount: 118_400, currency: CUR, mom:  7.3 },
  ],
  narrative: {
    summary: 'Total spend this period is AED 4.82M, up 8.4% from the prior period. GPU-accelerated workloads remain the fastest-growing cost category (+20% MoM). AWS EC2 p4d.24xlarge instances in the AI Research BU are the single largest cost driver. AED 612K in optimization savings have been captured, primarily through right-sizing and reserved instance conversions.',
    agentId:     'A04',
    agentName:   'Reporting & Analytics Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      'Total spend AED 4.82M — up 8.4% from prior period',
      'GPU workloads fastest-growing (+20% MoM) — review AI Research BU allocation',
      'Azure Blob Storage rising sharply (+19.8%) — investigate data egress patterns',
      'AED 612K optimization savings captured this period (+22.3% vs prior)',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class CostExplorerService {
  readonly #http = inject(HttpClient);

  // SWAP TO REAL: return this.#http.get<CostExplorerDashboardData>(`${environment.apiUrl}/understand/cost/dashboard`, { params })
  getDashboard(query: CostExplorerQuery): Observable<CostExplorerDashboardData> {
    return of(MOCK).pipe(delay(800));
  }
}
