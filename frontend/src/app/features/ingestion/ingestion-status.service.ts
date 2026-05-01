// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/understand/ingestion/ingestion-status.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type IngestionStatusDashboardData } from '@shared/types/ingestion-status.types';
import { environment } from '@env/environment';

function sparks(base: number, len = 8): number[] {
  return Array.from({ length: len }, () => base + Math.round((Math.random() - 0.5) * base * 0.15));
}

const MOCK: IngestionStatusDashboardData = {
  kpis: {
    totalConnectors:   { value: 9,           deltaPercent: 0,    deltaDirection: 'neutral', sparkline: sparks(9) },
    healthyConnectors: { value: 7,           deltaPercent: -11,  deltaDirection: 'down',    sparkline: sparks(8) },
    recordsToday:      { value: 4_218_640,   deltaPercent: 6.2,  deltaDirection: 'up',      sparkline: sparks(4_000_000) },
    avgQualityScore:   { value: 98.4,        deltaPercent: 0.2,  deltaDirection: 'up',      sparkline: sparks(98) },
  },
  connectors: [
    { connectorId:'c-aws',      connectorName:'AWS CUR',                  sourceType:'AWS',        status:'Healthy',  lastRunAt: new Date(Date.now()-1_800_000).toISOString(),  lastRunStatus:'Completed', recordsLastRun:1_820_340, qualityScore:99.2, freshnessHours:0.5,  retryCount:0, errorMessage:null },
    { connectorId:'c-azure',    connectorName:'Azure Cost Export',        sourceType:'Azure',      status:'Healthy',  lastRunAt: new Date(Date.now()-2_400_000).toISOString(),  lastRunStatus:'Completed', recordsLastRun:1_104_200, qualityScore:98.8, freshnessHours:0.7,  retryCount:0, errorMessage:null },
    { connectorId:'c-gcp',      connectorName:'GCP BigQuery Billing',     sourceType:'GCP',        status:'Degraded', lastRunAt: new Date(Date.now()-14_400_000).toISOString(), lastRunStatus:'Partial',   recordsLastRun:412_800,   qualityScore:94.1, freshnessHours:4.0,  retryCount:2, errorMessage:'Rate limit exceeded on project billing export' },
    { connectorId:'c-onprem',   connectorName:'VMware vCenter',           sourceType:'VMware',     status:'Healthy',  lastRunAt: new Date(Date.now()-3_600_000).toISOString(),  lastRunStatus:'Completed', recordsLastRun:384_100,   qualityScore:99.5, freshnessHours:1.0,  retryCount:0, errorMessage:null },
    { connectorId:'c-k8s',      connectorName:'Kubecost (Prod Cluster)',  sourceType:'Kubernetes', status:'Healthy',  lastRunAt: new Date(Date.now()-3_000_000).toISOString(),  lastRunStatus:'Completed', recordsLastRun:218_000,   qualityScore:97.8, freshnessHours:0.8,  retryCount:0, errorMessage:null },
    { connectorId:'c-gpu',      connectorName:'NVIDIA DCGM Metrics',      sourceType:'GPU_DCGM',   status:'Healthy',  lastRunAt: new Date(Date.now()-600_000).toISOString(),   lastRunStatus:'Completed', recordsLastRun:142_400,   qualityScore:99.9, freshnessHours:0.2,  retryCount:0, errorMessage:null },
    { connectorId:'c-erp',      connectorName:'ERP (SAP) Enrichment',     sourceType:'ERP',        status:'Stale',    lastRunAt: new Date(Date.now()-90_000_000).toISOString(),lastRunStatus:'Completed', recordsLastRun:8_200,     qualityScore:100,  freshnessHours:25.0, retryCount:0, errorMessage:null },
    { connectorId:'c-manual',   connectorName:'Manual Import Upload',     sourceType:'Manual',     status:'Healthy',  lastRunAt: new Date(Date.now()-86_400_000).toISOString(), lastRunStatus:'Completed', recordsLastRun:1_440,     qualityScore:98.0, freshnessHours:24.0, retryCount:0, errorMessage:null },
    { connectorId:'c-oci',      connectorName:'OCI Cost Reports',         sourceType:'OCI',        status:'Failed',   lastRunAt: new Date(Date.now()-28_800_000).toISOString(), lastRunStatus:'Failed',    recordsLastRun:0,         qualityScore:0,    freshnessHours:8.0,  retryCount:3, errorMessage:'Credential expired — API key requires renewal' },
  ],
  throughputHistory: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86_400_000).toLocaleDateString('en-AE', { day: '2-digit', month: 'short' }),
    records: Math.round(3_800_000 + Math.random() * 800_000),
  })),
  qualityBySource: [
    { source: 'AWS',        score: 99.2 },
    { source: 'Azure',      score: 98.8 },
    { source: 'GCP',        score: 94.1 },
    { source: 'VMware',     score: 99.5 },
    { source: 'Kubernetes', score: 97.8 },
    { source: 'GPU_DCGM',   score: 99.9 },
    { source: 'ERP',        score: 100 },
    { source: 'Manual',     score: 98.0 },
    { source: 'OCI',        score: 0 },
  ],
  narrative: {
    summary: 'Data ingestion is operating with 7 of 9 connectors healthy. GCP BigQuery is degraded due to API rate limiting — 2 retries in progress. OCI credentials have expired and require immediate renewal to restore 8-hour-stale data. All other connectors are processing within expected freshness thresholds.',
    agentId:     'A01',
    agentName:   'Data Ingestion Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      '4.22M records ingested today (+6.2% vs yesterday)',
      'OCI connector FAILED — credentials expired, data stale 8h — immediate action required',
      'GCP pipeline degraded — API rate limit triggered, retrying',
      'ERP enrichment data stale (25h) — scheduled run expected within 2h',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class IngestionStatusService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: return this.#http.get<IngestionStatusDashboardData>(`${environment.apiUrl}/understand/ingestion/dashboard`)
  getDashboard(): Observable<IngestionStatusDashboardData> {
    return of(MOCK).pipe(delay(700));
  }
  // SWAP TO REAL: return this.#http.post<void>(`${environment.apiUrl}/understand/ingestion/connectors/${connectorId}/run`, {})
  triggerRun(connectorId: string): Observable<void> {
    return of(undefined as void).pipe(delay(500));
  }
}
