// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/quantify/forecasts/forecasts.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type ForecastsDashboardData, type ForecastHorizon, type ForecastDimension } from '@shared/types/forecasts.types';
import { environment } from '@env/environment';

const CUR = 'AED';

// Build 90-day series: 60 days historical + 30 days forecast
const TODAY_IDX = 59;
const TREND_POINTS = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(2026, 0, 1 + i);
  const label = d.toLocaleDateString('en-AE', { day: '2-digit', month: 'short' });
  const base = 155_000 + i * 800 + Math.sin(i / 7) * 12_000;
  const isActual = i <= TODAY_IDX;
  return {
    date: label,
    actual:         isActual ? Math.round(base + Math.random() * 8_000) : null,
    forecast:       Math.round(base),
    confidenceLow:  Math.round(base * 0.88),
    confidenceHigh: Math.round(base * 1.12),
  };
});

const MOCK: ForecastsDashboardData = {
  kpis: {
    forecastedSpend:  { value: 5_640_000, currency: CUR, deltaPercent: 10.8, deltaDirection: 'up',   sparkline: [5_000_000, 5_100_000, 5_200_000, 5_350_000, 5_420_000, 5_510_000, 5_580_000, 5_640_000] },
    forecastAccuracy: { value: 94.2,                     deltaPercent: 0.8,  deltaDirection: 'up',   sparkline: [91, 92, 92.5, 93, 93.8, 94, 94.1, 94.2] },
    earlyWarnings:    { value: 3,                        deltaPercent: 50,   deltaDirection: 'up',   sparkline: [1, 2, 1, 2, 2, 3, 3, 3] },
    budgetExhaustion: { value: 18,                       deltaPercent: -25,  deltaDirection: 'down',  sparkline: [28, 26, 24, 22, 22, 20, 19, 18] },
  },
  trendPoints: TREND_POINTS,
  byDimension: [
    { label: 'AWS',              forecastAmount: 2_420_000, currency: CUR, budgetAmount: 2_200_000, variancePct: 10.0 },
    { label: 'Azure',            forecastAmount: 1_680_000, currency: CUR, budgetAmount: 1_800_000, variancePct: -6.7 },
    { label: 'GCP',              forecastAmount: 920_000,   currency: CUR, budgetAmount: 900_000,   variancePct: 2.2 },
    { label: 'On-Premises',      forecastAmount: 620_000,   currency: CUR, budgetAmount: 700_000,   variancePct: -11.4 },
  ],
  earlyWarnings: [
    { warningId:'ew-001', dimension:'AI Research',     dimensionType:'Business Unit', budgetAmount:3_200_000, projectedSpend:3_712_000, currency:CUR, variancePct:16.0, exhaustionDate:'2026-05-18', severity:'Critical',      status:'Active',      updatedAt:'2026-04-12T10:00:00Z' },
    { warningId:'ew-002', dimension:'AWS',              dimensionType:'Provider',      budgetAmount:2_200_000, projectedSpend:2_420_000, currency:CUR, variancePct:10.0, exhaustionDate:'2026-05-27', severity:'Warning',       status:'Acknowledged', updatedAt:'2026-04-11T14:00:00Z' },
    { warningId:'ew-003', dimension:'Digital Products', dimensionType:'Business Unit', budgetAmount:1_800_000, projectedSpend:2_020_000, currency:CUR, variancePct:12.2, exhaustionDate:'2026-06-04', severity:'Warning',       status:'Active',      updatedAt:'2026-04-13T08:00:00Z' },
    { warningId:'ew-004', dimension:'GCP',              dimensionType:'Provider',      budgetAmount:900_000,   projectedSpend:920_000,   currency:CUR, variancePct:2.2,  exhaustionDate:null,         severity:'Informational', status:'Active',      updatedAt:'2026-04-13T08:00:00Z' },
  ],
  narrative: {
    summary: 'Total spend is forecast at AED 5.64M for the next 30 days, representing a 10.8% increase vs. the prior period. Three early warning alerts are active: AI Research BU is projected to exhaust its budget 18 days before period end. Forecast model MAPE is 5.8% (94.2% accuracy), above the 90% SLA target. Azure and on-premises workloads are tracking below budget, partially offsetting the AWS and AI Research overruns.',
    agentId:     'A06',
    agentName:   'Forecasting Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      'Total forecast: AED 5.64M (+10.8%) — driven by GPU workload growth in AI Research',
      'AI Research BU budget exhaustion projected in 18 days — immediate attention required',
      'Forecast accuracy 94.2% — above 90% SLA target (+0.8pp MoM)',
      'Azure and on-premises forecast below budget — partial offset available',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class ForecastsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: return this.#http.get<ForecastsDashboardData>(`${environment.apiUrl}/quantify/forecasts/dashboard`, { params: { horizon, dimension } })
  getDashboard(horizon: ForecastHorizon, dimension: ForecastDimension): Observable<ForecastsDashboardData> {
    return of(MOCK).pipe(delay(700));
  }
}
