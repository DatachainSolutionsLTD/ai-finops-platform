// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/understand/reports/reports.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type ReportListRow, type ReportListSummary } from '@shared/types/understand-lists.types';
import { environment } from '@env/environment';

const MOCK_ROWS: ReportListRow[] = [
  { reportId:'rpt-001', name:'March 2026 Cost Summary',       description:'Full cost breakdown for March 2026',           category:'Cost',       status:'Ready',      format:'PDF',  billingPeriod:'2026-03', generatedAt:'2026-04-01T06:00:00Z', scheduledAt:null,                  fileSize:'2.4 MB', createdBy:'System',       downloadUrl:'/api/reports/rpt-001/download' },
  { reportId:'rpt-002', name:'March 2026 Allocation Report',  description:'Allocation coverage and chargeback detail',     category:'Allocation', status:'Ready',      format:'XLSX', billingPeriod:'2026-03', generatedAt:'2026-04-01T06:30:00Z', scheduledAt:null,                  fileSize:'1.8 MB', createdBy:'System',       downloadUrl:'/api/reports/rpt-002/download' },
  { reportId:'rpt-003', name:'Q1 2026 Executive Summary',     description:'Quarterly executive cost and savings summary',  category:'Executive',  status:'Ready',      format:'PDF',  billingPeriod:'2026-Q1', generatedAt:'2026-04-02T08:00:00Z', scheduledAt:null,                  fileSize:'3.1 MB', createdBy:'Ahmed Hassan', downloadUrl:'/api/reports/rpt-003/download' },
  { reportId:'rpt-004', name:'Anomaly Report — March 2026',   description:'Anomaly detection summary for the period',      category:'Anomaly',    status:'Ready',      format:'PDF',  billingPeriod:'2026-03', generatedAt:'2026-04-01T07:00:00Z', scheduledAt:null,                  fileSize:'1.2 MB', createdBy:'System',       downloadUrl:'/api/reports/rpt-004/download' },
  { reportId:'rpt-005', name:'April 2026 Cost Summary',       description:'Auto-scheduled monthly cost summary',           category:'Cost',       status:'Scheduled',  format:'PDF',  billingPeriod:'2026-04', generatedAt:null,                    scheduledAt:'2026-05-01T06:00:00Z',fileSize:null,     createdBy:'System',       downloadUrl:null },
  { reportId:'rpt-006', name:'GPU Utilization Detail',        description:'Per-GPU utilization and cost breakdown',        category:'Cost',       status:'Generating', format:'XLSX', billingPeriod:'2026-03', generatedAt:null,                    scheduledAt:null,                  fileSize:null,     createdBy:'Sara Ali',     downloadUrl:null },
  { reportId:'rpt-007', name:'Compliance Posture — Q1 2026',  description:'Governance and compliance findings for Q1',     category:'Compliance', status:'Ready',      format:'PDF',  billingPeriod:'2026-Q1', generatedAt:'2026-04-03T09:00:00Z', scheduledAt:null,                  fileSize:'4.7 MB', createdBy:'Ahmed Hassan', downloadUrl:'/api/reports/rpt-007/download' },
  { reportId:'rpt-008', name:'12-Month Forecast Report',      description:'Forecast projections for next 12 months',       category:'Forecast',   status:'Ready',      format:'XLSX', billingPeriod:'2026-12', generatedAt:'2026-04-05T10:00:00Z', scheduledAt:null,                  fileSize:'960 KB', createdBy:'System',       downloadUrl:'/api/reports/rpt-008/download' },
  { reportId:'rpt-009', name:'Feb 2026 Cost Summary',         description:'Full cost breakdown for February 2026',         category:'Cost',       status:'Expired',    format:'PDF',  billingPeriod:'2026-02', generatedAt:'2026-03-01T06:00:00Z', scheduledAt:null,                  fileSize:'2.3 MB', createdBy:'System',       downloadUrl:null },
  { reportId:'rpt-010', name:'Custom BU Cost — AI Research',  description:'Custom cost report scoped to AI Research BU',   category:'Custom',     status:'Failed',     format:'XLSX', billingPeriod:'2026-03', generatedAt:null,                    scheduledAt:null,                  fileSize:null,     createdBy:'Omar Khalid',  downloadUrl:null },
];

const MOCK_SUMMARY: ReportListSummary = { total: 10, ready: 6, scheduled: 1, generating: 1 };

@Injectable({ providedIn: 'root' })
export class ReportsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/understand/reports`, { params })
  list(query: Record<string, unknown>): Observable<{ data: ReportListRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: MOCK_ROWS, pagination: { total: MOCK_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<ReportListSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/understand/reports/generate`, params)
  generate(params: Record<string, unknown>): Observable<void> {
    return of(undefined as void).pipe(delay(800));
  }
}
