// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/quantify/unit-economics/unit-economics.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type UnitEconomicsDashboardData, type UETimeRange } from '@shared/types/quantify-dashboards.types';
import { environment } from '@env/environment';

function sparks(base: number): number[] { return Array.from({ length: 8 }, () => +(base + (Math.random() - 0.5) * base * 0.15).toFixed(4)); }
const CUR = 'AED';

const MOCK: UnitEconomicsDashboardData = {
  kpis: {
    avgCpt:            { value: 0.0024, currency: CUR, deltaPercent: -6.2,  deltaDirection: 'down', sparkline: sparks(0.0026) },
    totalTransactions: { value: 42_180_000,             deltaPercent: 14.8,  deltaDirection: 'up',  sparkline: sparks(38_000_000) },
    avgCes:            { value: 0.82,                   deltaPercent: 3.1,   deltaDirection: 'up',  sparkline: sparks(0.80) },
    criticalApps:      { value: 2,                      deltaPercent: -33,   deltaDirection: 'down', sparkline: [3, 3, 3, 2, 3, 2, 2, 2] },
  },
  cptTrend: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2026, 2, 1 + i).toLocaleDateString('en-AE', { day: '2-digit', month: 'short' }),
    cpt:  +(0.0028 - i * 0.000012 + (Math.random() - 0.5) * 0.0003).toFixed(5),
  })),
  leaderboard: [
    { rank:1, appName:'Payments Gateway',    businessUnit:'Core Banking',     currentCpt:0.00042, currency:CUR, momChange:-8.2,  ces:1.12, rating:'Excellent',      transactions:14_200_000 },
    { rank:2, appName:'Customer Portal',     businessUnit:'Digital Products', currentCpt:0.00118, currency:CUR, momChange:-3.4,  ces:0.94, rating:'Good',           transactions:9_840_000 },
    { rank:3, appName:'Risk Scoring Engine', businessUnit:'Risk Analytics',   currentCpt:0.00284, currency:CUR, momChange:2.1,   ces:0.88, rating:'Good',           transactions:5_210_000 },
    { rank:4, appName:'Fraud Detection API', businessUnit:'Risk Analytics',   currentCpt:0.00412, currency:CUR, momChange:4.8,   ces:0.74, rating:'Needs_Attention', transactions:8_920_000 },
    { rank:5, appName:'ML Inference Svc',    businessUnit:'AI Research',      currentCpt:0.01840, currency:CUR, momChange:12.6,  ces:0.41, rating:'Critical',        transactions:1_480_000 },
    { rank:6, appName:'Report Generator',    businessUnit:'Analytics',        currentCpt:0.00628, currency:CUR, momChange:-1.2,  ces:0.68, rating:'Needs_Attention', transactions:2_530_000 },
    { rank:7, appName:'Notification Svc',    businessUnit:'Digital Products', currentCpt:0.00095, currency:CUR, momChange:-5.6,  ces:0.97, rating:'Good',           transactions:9_120_000 },
    { rank:8, appName:'Data Pipeline',       businessUnit:'Data Platform',    currentCpt:0.02140, currency:CUR, momChange:18.4,  ces:0.32, rating:'Critical',        transactions:880_000 },
  ],
  heatmapData: [
    { rowLabel:'AI Research',      colLabel:'Production',    cpt:0.018, currency:CUR },
    { rowLabel:'AI Research',      colLabel:'Non-Prod',      cpt:0.042, currency:CUR },
    { rowLabel:'Core Banking',     colLabel:'Production',    cpt:0.0004,currency:CUR },
    { rowLabel:'Core Banking',     colLabel:'Non-Prod',      cpt:0.0009,currency:CUR },
    { rowLabel:'Digital Products', colLabel:'Production',    cpt:0.0012,currency:CUR },
    { rowLabel:'Digital Products', colLabel:'Non-Prod',      cpt:0.0028,currency:CUR },
    { rowLabel:'Risk Analytics',   colLabel:'Production',    cpt:0.0041,currency:CUR },
    { rowLabel:'Risk Analytics',   colLabel:'Non-Prod',      cpt:0.0088,currency:CUR },
    { rowLabel:'Data Platform',    colLabel:'Production',    cpt:0.021, currency:CUR },
    { rowLabel:'Data Platform',    colLabel:'Non-Prod',      cpt:0.048, currency:CUR },
  ],
  narrative: {
    summary: 'Average Cost per Transaction has improved 6.2% MoM to AED 0.0024, driven by optimizations in Core Banking and Digital Products. Total transactions processed reached 42.2M (+14.8%). Two applications remain in Critical status: ML Inference Service (+12.6% CPT MoM) and Data Pipeline (+18.4%). Non-production CPT is consistently 2-3× higher than production — idle workload rationalization recommended.',
    agentId:     'A09',
    agentName:   'Unit Economics Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      'Avg CPT AED 0.0024 — improved 6.2% MoM, 42.2M transactions processed',
      'ML Inference CPT rising +12.6% MoM — GPU efficiency intervention recommended',
      'Data Pipeline CPT +18.4% MoM — workload rightsizing opportunity identified',
      'Non-prod CPT 2-3× production across all BUs — idle workload rationalization needed',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class UnitEconomicsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<UnitEconomicsDashboardData>(`${environment.apiUrl}/quantify/unit-economics/dashboard`, { params: { range } })
  getDashboard(range: UETimeRange): Observable<UnitEconomicsDashboardData> {
    return of(MOCK).pipe(delay(700));
  }
}
