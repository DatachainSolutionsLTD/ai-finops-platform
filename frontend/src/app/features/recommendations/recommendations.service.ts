// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/optimize/queue/recommendations.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type RecommendationListRow, type RecommendationListSummary } from '@shared/types/recommendations.types';
import { environment } from '@env/environment';

const CUR = 'AED';
const MOCK_ROWS: RecommendationListRow[] = [
  { recommendationId:'rec-001', title:'Rightsize i-0a1b2c3d from p4d.24xlarge → p3.16xlarge',       description:'P95 GPU utilisation 42%; rightsizing saves 39% cost with no performance impact on ML inference workload.',    type:'Rightsizing',            priority:'Critical', status:'Pending',  risk:'Low',    source:'A11', provider:'AWS',   resourceId:'i-0a1b2c3d',    resourceType:'EC2 Instance',  businessUnit:'AI Research',     environment:'Production',  estimatedSavings:149_800, currency:CUR, savingsPeriod:'annual', confidenceScore:94, createdAt:'2026-04-12T10:00:00Z', expiresAt:'2026-05-12T10:00:00Z', assignedTo:null },
  { recommendationId:'rec-002', title:'Purchase AWS 1-Year Compute Savings Plan ($12,400/hr)',        description:'Stable compute baseline qualifies for Compute SP. Break-even in 4.2 months. NPV AED 284K over term.',           type:'Commitment_Purchase',    priority:'Critical', status:'Pending',  risk:'Low',    source:'A12', provider:'AWS',   resourceId:'sp-candidate-01',resourceType:'Savings Plan',  businessUnit:'Platform',        environment:'All',         estimatedSavings:284_000, currency:CUR, savingsPeriod:'annual', confidenceScore:91, createdAt:'2026-04-11T08:00:00Z', expiresAt:'2026-05-11T08:00:00Z', assignedTo:'Ahmed Hassan' },
  { recommendationId:'rec-003', title:'Shut down 14 idle dev VMs outside working hours',              description:'14 VMs in Dev environment show 0% CPU for 12+ hours nightly. Schedule automation saves 61% of dev compute cost.',type:'Schedule_Automation',    priority:'High',     status:'Pending',  risk:'Low',    source:'A11', provider:'Azure', resourceId:'vm-dev-cluster',resourceType:'VM Scale Set',  businessUnit:'Engineering',     environment:'Development', estimatedSavings:84_200,  currency:CUR, savingsPeriod:'annual', confidenceScore:98, createdAt:'2026-04-13T06:00:00Z', expiresAt:null,                   assignedTo:null },
  { recommendationId:'rec-004', title:'Clean up 23 orphaned S3 buckets (unattached, 0 access 90d)',   description:'23 S3 buckets with no owner tag, no access in 90 days, 4.2 TB aggregate. Immediate cleanup saves storage cost.',   type:'Orphan_Cleanup',         priority:'High',     status:'Pending',  risk:'Low',    source:'A11', provider:'AWS',   resourceId:'s3-orphan-set',  resourceType:'S3 Buckets',    businessUnit:'Data Platform',   environment:'Production',  estimatedSavings:42_600,  currency:CUR, savingsPeriod:'annual', confidenceScore:96, createdAt:'2026-04-12T14:00:00Z', expiresAt:null,                   assignedTo:null },
  { recommendationId:'rec-005', title:'Adjust K8s memory limits in analytics namespace (78% waste)',   description:'Containers request 12 GB but use <2.6 GB at P99. Reducing limits frees 9 nodes.',                                type:'K8s_Limit_Adjustment',   priority:'High',     status:'Pending',  risk:'Medium', source:'A11', provider:'GCP',   resourceId:'gke-analytics-ns',resourceType:'K8s Namespace', businessUnit:'Analytics',       environment:'Production',  estimatedSavings:68_400,  currency:CUR, savingsPeriod:'annual', confidenceScore:87, createdAt:'2026-04-11T16:00:00Z', expiresAt:null,                   assignedTo:'Sara Ali' },
  { recommendationId:'rec-006', title:'Migrate batch ETL jobs to spot instances (81% cheaper)',        description:'Fault-tolerant nightly ETL shows low interruption risk. Estimated annual savings AED 58K.',                      type:'Spot_Migration',         priority:'Medium',   status:'Approved', risk:'Medium', source:'A12', provider:'AWS',   resourceId:'etl-batch-sg',   resourceType:'EC2 ASG',       businessUnit:'Data Platform',   environment:'Production',  estimatedSavings:58_200,  currency:CUR, savingsPeriod:'annual', confidenceScore:83, createdAt:'2026-04-10T09:00:00Z', expiresAt:'2026-05-10T09:00:00Z', assignedTo:'Omar Khalid' },
  { recommendationId:'rec-007', title:'Migrate Risk Scoring API from VMs to containers (AKS)',         description:'Architecture Advisor: containerising this API reduces infrastructure cost 34% and improves scaling flexibility.',   type:'Architecture_Change',    priority:'Medium',   status:'Pending',  risk:'High',   source:'A13', provider:'Azure', resourceId:'vm-risk-api',    resourceType:'Azure VMs',     businessUnit:'Risk Analytics',  environment:'Production',  estimatedSavings:72_400,  currency:CUR, savingsPeriod:'annual', confidenceScore:78, createdAt:'2026-04-09T11:00:00Z', expiresAt:'2026-07-09T11:00:00Z', assignedTo:null },
  { recommendationId:'rec-008', title:'Purchase Azure 1-Year VM Reserved Instances (D-series)',        description:'73% stable D-series usage in me-central-1. 1-Year No-Upfront breaks even in 5.8 months.',                       type:'Commitment_Purchase',    priority:'High',     status:'Pending',  risk:'Low',    source:'A12', provider:'Azure', resourceId:'ri-azure-d-01',  resourceType:'Reserved Instance',businessUnit:'Digital Products', environment:'All',        estimatedSavings:118_600, currency:CUR, savingsPeriod:'annual', confidenceScore:88, createdAt:'2026-04-12T08:00:00Z', expiresAt:'2026-05-12T08:00:00Z', assignedTo:'Ahmed Hassan' },
  { recommendationId:'rec-009', title:'Shift ML training batch to low-carbon window (02:00–06:00 UTC)', description:'Sustainability: shifting 3 nightly training jobs to low-carbon window reduces carbon 28% with identical cost.',    type:'Schedule_Automation',    priority:'Low',      status:'Pending',  risk:'Low',    source:'A14', provider:'AWS',   resourceId:'ml-training-sg', resourceType:'EC2 Training',  businessUnit:'AI Research',     environment:'Production',  estimatedSavings:0,       currency:CUR, savingsPeriod:'annual', confidenceScore:92, createdAt:'2026-04-13T07:00:00Z', expiresAt:null,                   assignedTo:null },
  { recommendationId:'rec-010', title:'Rightsize 8 Azure VMs in Risk Analytics (D16 → D8)',           description:'Consistent <35% CPU across observation window. P99 utilisation 41%. Break-even in 0 months (immediate savings).',  type:'Rightsizing',            priority:'High',     status:'Rejected', risk:'Low',    source:'A11', provider:'Azure', resourceId:'vm-risk-set',    resourceType:'Azure VMs',     businessUnit:'Risk Analytics',  environment:'Production',  estimatedSavings:96_400,  currency:CUR, savingsPeriod:'annual', confidenceScore:89, createdAt:'2026-04-08T10:00:00Z', expiresAt:'2026-05-08T10:00:00Z', assignedTo:'Fatima Jaber' },
];

const MOCK_SUMMARY: RecommendationListSummary = {
  total: 10, pending: 7, totalSavings: 978_200, currency: CUR, highPriority: 4, avgConfidence: 89,
};

@Injectable({ providedIn: 'root' })
export class RecommendationsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/optimize/recommendations`, { params })
  list(query: Record<string, unknown>): Observable<{ data: RecommendationListRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: MOCK_ROWS, pagination: { total: MOCK_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<RecommendationListSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/optimize/recommendations/${id}/approve`, {})
  approve(id: string): Observable<void> { return of(undefined as void).pipe(delay(500)); }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/optimize/recommendations/${id}/reject`, { reason })
  reject(id: string, reason: string): Observable<void> { return of(undefined as void).pipe(delay(500)); }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/optimize/recommendations/bulk-approve`, { ids })
  bulkApprove(ids: string[]): Observable<void> { return of(undefined as void).pipe(delay(700)); }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/optimize/recommendations/bulk-reject`, { ids, reason })
  bulkReject(ids: string[], reason: string): Observable<void> { return of(undefined as void).pipe(delay(700)); }
}
