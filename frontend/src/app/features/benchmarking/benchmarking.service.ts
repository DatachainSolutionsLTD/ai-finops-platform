// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/quantify/benchmarking/benchmarking.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type BenchmarkingDashboardData, type BenchmarkTimeRange } from '@shared/types/quantify-dashboards.types';
import { environment } from '@env/environment';

function sparks(base: number): number[] { return Array.from({ length: 8 }, () => base + Math.round((Math.random() - 0.5) * base * 0.2)); }
const CUR = 'AED';

const MOCK: BenchmarkingDashboardData = {
  kpis: {
    aboveBenchmarkDimensions: { value: 8,           deltaPercent: -20,  deltaDirection: 'down', sparkline: sparks(10) },
    avgDeviationPct:          { value: 22.4,        deltaPercent: -8.1, deltaDirection: 'down', sparkline: sparks(24) },
    optimizationOpportunity:  { value: 840_000, currency: CUR, deltaPercent: 12.5, deltaDirection: 'up', sparkline: sparks(750_000) },
    improvementVelocity:      { value: 3.2,         deltaPercent: 0.4,  deltaDirection: 'up',  sparkline: sparks(3) },
  },
  efficiencyRatios: [
    { metric: 'Cost / vCPU-hour',     actual: 0.18, benchmark: 0.14, unit: '/vCPU-hr', currency: CUR, deviationPct: 28.6, severity: 'Warning' },
    { metric: 'Cost / GB-month',      actual: 0.042, benchmark: 0.038, unit: '/GB-mo', currency: CUR, deviationPct: 10.5, severity: 'Advisory' },
    { metric: 'Cost / GPU-hour',      actual: 14.20, benchmark: 12.50, unit: '/GPU-hr', currency: CUR, deviationPct: 13.6, severity: 'Advisory' },
    { metric: 'Cost / Transaction',   actual: 0.0031, benchmark: 0.0022, unit: '/txn', currency: CUR, deviationPct: 40.9, severity: 'Critical' },
    { metric: 'Cost / GB egress',     actual: 0.085, benchmark: 0.080, unit: '/GB', currency: CUR, deviationPct: 6.25, severity: 'On_Target' },
    { metric: 'Cost / API call',      actual: 0.00018, benchmark: 0.00016, unit: '/call', currency: CUR, deviationPct: 12.5, severity: 'Advisory' },
  ],
  trendPoints: Array.from({ length: 12 }, (_, i) => ({
    period: new Date(2025, i, 1).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }),
    avgDeviation: Math.round(32 - i * 0.8 + (Math.random() - 0.5) * 2),
  })),
  aboveBenchmark: [
    { dimension:'AI Research',     dimensionType:'Business Unit', metric:'Cost / Transaction',   actualValue:0.0031, benchmarkValue:0.0022, currency:CUR, deviationPct:40.9, severity:'Critical', estSavings:312_400, linkedActions:3 },
    { dimension:'AWS EC2',         dimensionType:'Service',       metric:'Cost / vCPU-hour',     actualValue:0.18,   benchmarkValue:0.14,   currency:CUR, deviationPct:28.6, severity:'Warning',  estSavings:228_600, linkedActions:2 },
    { dimension:'Digital Products',dimensionType:'Business Unit', metric:'Cost / vCPU-hour',     actualValue:0.17,   benchmarkValue:0.14,   currency:CUR, deviationPct:21.4, severity:'Warning',  estSavings:184_200, linkedActions:2 },
    { dimension:'GCP',             dimensionType:'Provider',      metric:'Cost / Transaction',   actualValue:0.0028, benchmarkValue:0.0022, currency:CUR, deviationPct:27.3, severity:'Warning',  estSavings:98_400,  linkedActions:1 },
    { dimension:'Azure VMSS',      dimensionType:'Service',       metric:'Cost / vCPU-hour',     actualValue:0.165,  benchmarkValue:0.14,   currency:CUR, deviationPct:17.9, severity:'Advisory', estSavings:76_300,  linkedActions:1 },
    { dimension:'Core Banking',    dimensionType:'Business Unit', metric:'Cost / API call',      actualValue:0.00018,benchmarkValue:0.00016,currency:CUR, deviationPct:12.5, severity:'Advisory', estSavings:42_100,  linkedActions:1 },
  ],
  narrative: {
    summary: 'Benchmarking shows 8 above-benchmark dimensions (down from 10 last period — 20% improvement). The most significant deviation is Cost-per-Transaction in AI Research at 40.9% above target, driven by GPU workload inefficiency. Estimated optimization opportunity is AED 840K. Average benchmark deviation is 22.4%, improving at 3.2% per month.',
    agentId:     'A08',
    agentName:   'Benchmarking Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      '8 above-benchmark dimensions — 20% improvement from last period (10 → 8)',
      'AI Research Cost/Transaction +40.9% above benchmark — AED 312K opportunity',
      'AWS EC2 Cost/vCPU-hour +28.6% — largest infrastructure efficiency gap',
      'Improvement velocity: 3.2% per month — on track to close gaps within 7 months',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class BenchmarkingService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<BenchmarkingDashboardData>(`${environment.apiUrl}/quantify/benchmarking/dashboard`, { params: { range } })
  getDashboard(range: BenchmarkTimeRange): Observable<BenchmarkingDashboardData> {
    return of(MOCK).pipe(delay(700));
  }
}
