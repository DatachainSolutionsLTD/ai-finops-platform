// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/platform/metering/metering-engine.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type MeteringDashboardData, type MeteringTimeRange } from '@shared/types/metering-engine.types';
import { environment } from '@env/environment';
const CUR = 'USD';

function sparks(base: number, len = 8): number[] {
  return Array.from({ length: len }, (_, i) => base + Math.round((Math.random() - 0.5) * base * 0.3 + i * (base * 0.02)));
}

const MOCK: MeteringDashboardData = {
  kpis: {
    eventsProcessed24h: { value: 4_820_310, deltaPercent: 12.4, deltaDirection: 'up',      sparkline: sparks(4_500_000) },
    eventsPending:      { value: 1_842,     deltaPercent: -8.2,  deltaDirection: 'down',    sparkline: sparks(2000) },
    processingLagSec:   { value: 3.8,       deltaPercent: -5.1,  deltaDirection: 'down',    sparkline: sparks(4) },
    failureRate24hPct:  { value: 0.12,      deltaPercent: 0.03,  deltaDirection: 'neutral', sparkline: sparks(0.1) },
  },
  throughputSeries: {
    timestamps: Array.from({ length: 24 }, (_, i) => {
      const d = new Date(Date.now() - (23 - i) * 3_600_000);
      return `${d.getHours().toString().padStart(2, '0')}:00`;
    }),
    processed: Array.from({ length: 24 }, () => Math.round(180_000 + Math.random() * 60_000)),
    failed:    Array.from({ length: 24 }, () => Math.round(200   + Math.random() * 100)),
  },
  queueSeries: {
    timestamps: Array.from({ length: 24 }, (_, i) => {
      const d = new Date(Date.now() - (23 - i) * 3_600_000);
      return `${d.getHours().toString().padStart(2, '0')}:00`;
    }),
    depth: Array.from({ length: 24 }, () => Math.round(1_000 + Math.random() * 2_000)),
  },
  pipelines: [
    { pipelineId: 'pl-aws',      pipelineName: 'AWS CUR Ingestion',       status: 'Healthy',  lagSec: 2.1,  throughputEph: 820_000, errorRate: 0.08, lastEventAt: new Date(Date.now()-120_000).toISOString() },
    { pipelineId: 'pl-azure',    pipelineName: 'Azure Cost Export',        status: 'Healthy',  lagSec: 3.4,  throughputEph: 610_000, errorRate: 0.11, lastEventAt: new Date(Date.now()-90_000).toISOString() },
    { pipelineId: 'pl-gcp',      pipelineName: 'GCP Billing Export',       status: 'Degraded', lagSec: 14.2, throughputEph: 220_000, errorRate: 0.94, lastEventAt: new Date(Date.now()-600_000).toISOString() },
    { pipelineId: 'pl-onprem',   pipelineName: 'On-Premises DCGM Metrics', status: 'Healthy',  lagSec: 1.8,  throughputEph: 380_000, errorRate: 0.03, lastEventAt: new Date(Date.now()-60_000).toISOString() },
    { pipelineId: 'pl-norm',     pipelineName: 'Normalization Pipeline',   status: 'Healthy',  lagSec: 4.1,  throughputEph: 440_000, errorRate: 0.05, lastEventAt: new Date(Date.now()-180_000).toISOString() },
  ],
  narrative: {
    summary: 'Metering throughput is 12.4% above baseline for the last 24 hours. The GCP Billing Export pipeline is degraded with elevated lag (14.2s) — investigation recommended. All other pipelines are operating within SLO.',
    agentId: 'FSD-ME-01',
    agentName: 'Self-Managing Metering Engine',
    generatedAt: new Date().toISOString(),
    highlights: [
      '4.82M events processed in the last 24 hours (+12.4%)',
      'GCP pipeline lag elevated at 14.2s — threshold is 10s',
      'Overall failure rate at 0.12% — within 0.5% SLO ceiling',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class MeteringEngineService {
  readonly #http = inject(HttpClient);

  // SWAP TO REAL: return this.#http.get<MeteringDashboardData>(`${environment.apiUrl}/platform/metering/dashboard`, { params: new HttpParams().set('range', range) })
  getDashboard(range: MeteringTimeRange): Observable<MeteringDashboardData> {
    return of(MOCK).pipe(delay(700));
  }
}
