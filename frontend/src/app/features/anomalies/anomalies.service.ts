// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/understand/anomalies/anomalies.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type AnomalyListRow, type AnomalyListSummary } from '@shared/types/understand-lists.types';
import { environment } from '@env/environment';

const CUR = 'AED';

const MOCK_ROWS: AnomalyListRow[] = [
  { anomalyId:'an-001', title:'Azure Blob Storage spike +42%',       provider:'Azure',    serviceName:'Blob Storage',      businessUnit:'Data Platform',    region:'me-central-1', severity:'Critical',      lifecycle:'New',          detectionMethod:'ML_Isolation_Forest', deviationAmount:62_400,  deviationPct:42.1, currency:CUR, detectedAt:'2026-04-12T14:32:00Z', acknowledgedAt:null,             resolvedAt:null,                 assignedTo:null },
  { anomalyId:'an-002', title:'AWS EC2 off-hours spend increase',    provider:'AWS',      serviceName:'EC2',               businessUnit:'Digital Products', region:'me-central-1', severity:'Warning',       lifecycle:'Acknowledged', detectionMethod:'Statistical',        deviationAmount:28_200,  deviationPct:18.4, currency:CUR, detectedAt:'2026-04-11T08:15:00Z', acknowledgedAt:'2026-04-11T09:00:00Z', resolvedAt:null,  assignedTo:'Sara Ali' },
  { anomalyId:'an-003', title:'GCP BigQuery cost anomaly',           provider:'GCP',      serviceName:'BigQuery',          businessUnit:'Analytics',        region:'me-central-1', severity:'Warning',       lifecycle:'Investigating', detectionMethod:'ML_LSTM',            deviationAmount:19_800,  deviationPct:24.7, currency:CUR, detectedAt:'2026-04-10T16:44:00Z', acknowledgedAt:'2026-04-10T17:30:00Z', resolvedAt:null,  assignedTo:'Omar Khalid' },
  { anomalyId:'an-004', title:'RDS Multi-AZ failover cost impact',  provider:'AWS',      serviceName:'RDS Aurora',        businessUnit:'Core Banking',     region:'me-central-1', severity:'Informational', lifecycle:'Resolved',     detectionMethod:'Rule_Based',         deviationAmount:12_100,  deviationPct:9.2,  currency:CUR, detectedAt:'2026-04-09T02:00:00Z', acknowledgedAt:'2026-04-09T03:00:00Z', resolvedAt:'2026-04-09T12:00:00Z', assignedTo:'Ahmed Hassan' },
  { anomalyId:'an-005', title:'GPU cluster idle cost spike',         provider:'On-Prem',  serviceName:'NVIDIA DCGM',       businessUnit:'AI Research',      region:'me-central-1', severity:'Critical',      lifecycle:'New',          detectionMethod:'ML_Isolation_Forest', deviationAmount:84_300,  deviationPct:31.6, currency:CUR, detectedAt:'2026-04-12T22:18:00Z', acknowledgedAt:null,             resolvedAt:null,                 assignedTo:null },
  { anomalyId:'an-006', title:'Azure VM scale-out over-provisioned', provider:'Azure',    serviceName:'Virtual Machines',  businessUnit:'Risk Analytics',   region:'me-central-1', severity:'Warning',       lifecycle:'False_Positive', detectionMethod:'Statistical',       deviationAmount:9_400,   deviationPct:7.8,  currency:CUR, detectedAt:'2026-04-08T11:00:00Z', acknowledgedAt:'2026-04-08T13:00:00Z', resolvedAt:'2026-04-09T09:00:00Z', assignedTo:'Fatima Jaber' },
  { anomalyId:'an-007', title:'EKS node pool unexpected scale',      provider:'AWS',      serviceName:'EKS',               businessUnit:'Digital Products', region:'me-central-1', severity:'Informational', lifecycle:'Expected_Change', detectionMethod:'Rule_Based',        deviationAmount:7_200,   deviationPct:5.1,  currency:CUR, detectedAt:'2026-04-07T14:00:00Z', acknowledgedAt:'2026-04-07T15:00:00Z', resolvedAt:'2026-04-07T16:00:00Z', assignedTo:'Sara Ali' },
  { anomalyId:'an-008', title:'On-prem storage I/O throughput cost', provider:'On-Prem',  serviceName:'Storage Array',     businessUnit:'Core Banking',     region:'me-central-1', severity:'Warning',       lifecycle:'Investigating', detectionMethod:'Statistical',        deviationAmount:14_600,  deviationPct:11.3, currency:CUR, detectedAt:'2026-04-11T19:00:00Z', acknowledgedAt:'2026-04-12T08:00:00Z', resolvedAt:null,                 assignedTo:'Ahmed Hassan' },
];

const MOCK_SUMMARY: AnomalyListSummary = { total: 8, critical: 2, warning: 3, informational: 2, unacknowledged: 2 };

@Injectable({ providedIn: 'root' })
export class AnomaliesService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/understand/anomalies`, { params })
  list(query: Record<string, unknown>): Observable<{ data: AnomalyListRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: MOCK_ROWS, pagination: { total: MOCK_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<AnomalyListSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }
  // SWAP TO REAL: this.#http.patch<void>(`${environment.apiUrl}/understand/anomalies/${anomalyId}/acknowledge`, {})
  acknowledge(anomalyId: string): Observable<void> {
    return of(undefined as void).pipe(delay(500));
  }
}
