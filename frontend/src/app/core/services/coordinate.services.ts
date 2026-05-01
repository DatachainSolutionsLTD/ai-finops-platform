// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Consolidated services for Batch 7 — Coordinate.

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import {
  type ApprovalQueueRow,    type ApprovalQueueSummary,
  type AgentActivityRow,    type AgentActivitySummary,
  type ConflictListRow,     type ConflictListSummary,
  type ExplanationRow,      type ExplanationListSummary,
} from '@shared/types/coordinate.types';
import { environment } from '@env/environment';

const CUR = 'AED';

// ─────────────────────────────────────────────────────────────────────────────
// Approvals Queue  (A30)
// ─────────────────────────────────────────────────────────────────────────────
const APPROVAL_ROWS: ApprovalQueueRow[] = [
  { escalationId:'esc-001', title:'Rightsize EC2 p4d.24xlarge → p3.16xlarge — AI Research', originatingAgent:'Workload Optimizer Agent', agentId:'A11', domain:'Workload',      priority:'Critical', environment:'Production',    financialImpact:12_483,  currency:CUR, status:'Pending',    slaStatus:'At_Risk',    slaRemainingHours:2,   assignedTo:null,             businessUnit:'AI Research',     riskLevel:'Low',    confidenceScore:94, createdAt:'2026-04-12T10:00:00Z' },
  { escalationId:'esc-002', title:'Purchase AWS Compute Savings Plan $12,400/hr',           originatingAgent:'Rate Optimizer Agent',    agentId:'A12', domain:'Rate',          priority:'Critical', environment:'All',            financialImpact:23_667,  currency:CUR, status:'In_Review',  slaStatus:'Within_SLA', slaRemainingHours:18,  assignedTo:'Ahmed Hassan',   businessUnit:'Platform',        riskLevel:'Low',    confidenceScore:91, createdAt:'2026-04-11T08:00:00Z' },
  { escalationId:'esc-003', title:'GCP region consolidation: 3 regions → me-central-1',     originatingAgent:'Architecture Advisor',   agentId:'A13', domain:'Architecture',  priority:'High',     environment:'All',            financialImpact:18_420,  currency:CUR, status:'Pending',    slaStatus:'Within_SLA', slaRemainingHours:36,  assignedTo:null,             businessUnit:'Platform',        riskLevel:'High',   confidenceScore:71, createdAt:'2026-04-10T08:00:00Z' },
  { escalationId:'esc-004', title:'Enable Azure Hybrid Benefit on 48 Windows Server VMs',   originatingAgent:'License & SaaS Agent',   agentId:'A15', domain:'License',       priority:'High',     environment:'Production',    financialImpact:8_200,   currency:CUR, status:'Pending',    slaStatus:'Within_SLA', slaRemainingHours:48,  assignedTo:null,             businessUnit:'Core Banking',    riskLevel:'Low',    confidenceScore:98, createdAt:'2026-04-13T07:00:00Z' },
  { escalationId:'esc-005', title:'MIG partitioning on NVIDIA A100 x4 (AI Research cluster)',originatingAgent:'GPU Optimizer',          agentId:'A16', domain:'GPU',           priority:'High',     environment:'Production',    financialImpact:9_840,   currency:CUR, status:'Pending',    slaStatus:'Within_SLA', slaRemainingHours:24,  assignedTo:'Sara Ali',       businessUnit:'AI Research',     riskLevel:'Medium', confidenceScore:88, createdAt:'2026-04-12T14:00:00Z' },
  { escalationId:'esc-006', title:'Shift ML training to low-carbon window — AI Research',    originatingAgent:'Sustainability Agent',   agentId:'A14', domain:'Sustainability', priority:'Medium',   environment:'Production',    financialImpact:0,       currency:CUR, status:'Pending',    slaStatus:'Within_SLA', slaRemainingHours:72,  assignedTo:null,             businessUnit:'AI Research',     riskLevel:'Low',    confidenceScore:92, createdAt:'2026-04-13T07:00:00Z' },
  { escalationId:'esc-007', title:'Containerize Risk Scoring API on AKS',                   originatingAgent:'Architecture Advisor',   agentId:'A13', domain:'Architecture',  priority:'Medium',   environment:'Production',    financialImpact:6_034,   currency:CUR, status:'Deferred',   slaStatus:'Within_SLA', slaRemainingHours:null,assignedTo:'Omar Khalid',    businessUnit:'Risk Analytics',  riskLevel:'High',   confidenceScore:78, createdAt:'2026-04-09T11:00:00Z' },
  { escalationId:'esc-008', title:'Reduce K8s memory limits in analytics namespace',         originatingAgent:'Workload Optimizer Agent',agentId:'A11', domain:'Workload',      priority:'High',     environment:'Production',    financialImpact:5_700,   currency:CUR, status:'Approved',   slaStatus:'Within_SLA', slaRemainingHours:null,assignedTo:'Sara Ali',       businessUnit:'Analytics',       riskLevel:'Medium', confidenceScore:87, createdAt:'2026-04-11T16:00:00Z' },
  { escalationId:'esc-009', title:'Delete 23 orphaned S3 buckets — Data Platform',           originatingAgent:'Workload Optimizer Agent',agentId:'A11', domain:'Workload',      priority:'High',     environment:'Production',    financialImpact:3_550,   currency:CUR, status:'Approved',   slaStatus:'Within_SLA', slaRemainingHours:null,assignedTo:'Ahmed Hassan',   businessUnit:'Data Platform',   riskLevel:'Low',    confidenceScore:96, createdAt:'2026-04-12T14:00:00Z' },
  { escalationId:'esc-010', title:'Azure 1-Year Reserved Instances — D-series me-central-1', originatingAgent:'Rate Optimizer Agent',    agentId:'A12', domain:'Rate',          priority:'High',     environment:'All',            financialImpact:9_883,   currency:CUR, status:'Pending',    slaStatus:'At_Risk',    slaRemainingHours:6,   assignedTo:'Ahmed Hassan',   businessUnit:'Digital Products', riskLevel:'Low',    confidenceScore:88, createdAt:'2026-04-12T08:00:00Z' },
];
const APPROVAL_SUMMARY: ApprovalQueueSummary = { pending: 6, slaAtRisk: 2, decidedToday: 4, approvalRate: 84.2, avgDecisionHours: 8.4 };

@Injectable({ providedIn: 'root' })
export class ApprovalsQueueService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/coordinate/approvals`, { params })
  list(q: Record<string, unknown>): Observable<{ data: ApprovalQueueRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: APPROVAL_ROWS, pagination: { total: APPROVAL_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<ApprovalQueueSummary> { return of(APPROVAL_SUMMARY).pipe(delay(400)); }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/coordinate/approvals/${id}/approve`, { reason })
  approve(id: string, reason?: string): Observable<void> { return of(undefined as void).pipe(delay(500)); }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/coordinate/approvals/${id}/reject`, { reason })
  reject(id: string, reason: string): Observable<void> { return of(undefined as void).pipe(delay(500)); }
  bulkApprove(ids: string[]): Observable<void> { return of(undefined as void).pipe(delay(700)); }
  bulkReject(ids: string[], reason: string): Observable<void> { return of(undefined as void).pipe(delay(700)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Activity  (A27)
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_ROWS: AgentActivityRow[] = [
  { agentId:'ag-01', agentCode:'A01', agentName:'Data Ingestion Agent',              tier:'Understand',   status:'Healthy',   version:'1.0.0', queueDepth:0,   activeActions:2,  lastHeartbeatAt: new Date(Date.now()-12_000).toISOString(),  uptimePct:99.98, cpuPct:12,  memoryPct:34,  errorRatePct:0,    actionsLast24h:48 },
  { agentId:'ag-02', agentCode:'A02', agentName:'Cost Normalization Agent',          tier:'Understand',   status:'Healthy',   version:'1.0.0', queueDepth:0,   activeActions:0,  lastHeartbeatAt: new Date(Date.now()-18_000).toISOString(),  uptimePct:99.99, cpuPct:8,   memoryPct:28,  errorRatePct:0,    actionsLast24h:24 },
  { agentId:'ag-03', agentCode:'A03', agentName:'Allocation Agent',                  tier:'Understand',   status:'Healthy',   version:'1.0.0', queueDepth:2,   activeActions:1,  lastHeartbeatAt: new Date(Date.now()-24_000).toISOString(),  uptimePct:99.96, cpuPct:24,  memoryPct:48,  errorRatePct:0,    actionsLast24h:86 },
  { agentId:'ag-05', agentCode:'A05', agentName:'Anomaly Detection Agent',           tier:'Understand',   status:'Healthy',   version:'1.0.0', queueDepth:8,   activeActions:3,  lastHeartbeatAt: new Date(Date.now()-8_000).toISOString(),   uptimePct:99.94, cpuPct:42,  memoryPct:56,  errorRatePct:0.2,  actionsLast24h:240 },
  { agentId:'ag-06', agentCode:'A06', agentName:'Forecasting Agent',                 tier:'Quantify',     status:'Healthy',   version:'1.0.0', queueDepth:0,   activeActions:1,  lastHeartbeatAt: new Date(Date.now()-30_000).toISOString(),  uptimePct:99.91, cpuPct:31,  memoryPct:62,  errorRatePct:0,    actionsLast24h:12 },
  { agentId:'ag-07', agentCode:'A07', agentName:'Budget Guardian Agent',             tier:'Quantify',     status:'Healthy',   version:'1.0.0', queueDepth:3,   activeActions:2,  lastHeartbeatAt: new Date(Date.now()-15_000).toISOString(),  uptimePct:99.97, cpuPct:18,  memoryPct:40,  errorRatePct:0,    actionsLast24h:36 },
  { agentId:'ag-11', agentCode:'A11', agentName:'Workload Optimizer Agent',          tier:'Optimize',     status:'Busy',      version:'1.0.0', queueDepth:48,  activeActions:12, lastHeartbeatAt: new Date(Date.now()-5_000).toISOString(),   uptimePct:99.88, cpuPct:78,  memoryPct:82,  errorRatePct:0.8,  actionsLast24h:184 },
  { agentId:'ag-12', agentCode:'A12', agentName:'Rate Optimizer Agent',              tier:'Optimize',     status:'Healthy',   version:'1.0.0', queueDepth:4,   activeActions:2,  lastHeartbeatAt: new Date(Date.now()-22_000).toISOString(),  uptimePct:99.95, cpuPct:28,  memoryPct:45,  errorRatePct:0,    actionsLast24h:48 },
  { agentId:'ag-14', agentCode:'A14', agentName:'Sustainability Agent',              tier:'Optimize',     status:'Healthy',   version:'1.0.0', queueDepth:0,   activeActions:1,  lastHeartbeatAt: new Date(Date.now()-28_000).toISOString(),  uptimePct:99.82, cpuPct:14,  memoryPct:38,  errorRatePct:0,    actionsLast24h:28 },
  { agentId:'ag-16', agentCode:'A16', agentName:'GPU Optimizer',                     tier:'Optimize',     status:'Degraded',  version:'1.0.0', queueDepth:12,  activeActions:4,  lastHeartbeatAt: new Date(Date.now()-55_000).toISOString(),  uptimePct:98.42, cpuPct:88,  memoryPct:91,  errorRatePct:3.2,  actionsLast24h:62 },
  { agentId:'ag-20', agentCode:'A20', agentName:'Governance Agent',                  tier:'Manage',       status:'Healthy',   version:'1.0.0', queueDepth:1,   activeActions:1,  lastHeartbeatAt: new Date(Date.now()-18_000).toISOString(),  uptimePct:99.96, cpuPct:22,  memoryPct:44,  errorRatePct:0,    actionsLast24h:96 },
  { agentId:'ag-24', agentCode:'A24', agentName:'Tagging Hygiene Agent',             tier:'Manage',       status:'Healthy',   version:'1.0.0', queueDepth:0,   activeActions:0,  lastHeartbeatAt: new Date(Date.now()-40_000).toISOString(),  uptimePct:99.91, cpuPct:6,   memoryPct:22,  errorRatePct:0,    actionsLast24h:840 },
  { agentId:'ag-27', agentCode:'A27', agentName:'Orchestrator Agent',                tier:'Orchestration',status:'Healthy',   version:'1.0.0', queueDepth:0,   activeActions:18, lastHeartbeatAt: new Date(Date.now()-4_000).toISOString(),   uptimePct:99.999,cpuPct:44,  memoryPct:68,  errorRatePct:0,    actionsLast24h:0 },
  { agentId:'ag-29', agentCode:'A29', agentName:'Explainability Agent',              tier:'Coordinate',   status:'Healthy',   version:'1.0.0', queueDepth:6,   activeActions:2,  lastHeartbeatAt: new Date(Date.now()-12_000).toISOString(),  uptimePct:99.94, cpuPct:34,  memoryPct:52,  errorRatePct:0,    actionsLast24h:124 },
  { agentId:'ag-30', agentCode:'A30', agentName:'Human-in-the-Loop Agent',           tier:'Coordinate',   status:'Healthy',   version:'1.0.0', queueDepth:10,  activeActions:10, lastHeartbeatAt: new Date(Date.now()-6_000).toISOString(),   uptimePct:99.98, cpuPct:18,  memoryPct:36,  errorRatePct:0,    actionsLast24h:18 },
  { agentId:'ag-32', agentCode:'A32', agentName:'Continuous Learning Agent',         tier:'Orchestration',status:'Updating',  version:'1.1.0', queueDepth:0,   activeActions:0,  lastHeartbeatAt: new Date(Date.now()-120_000).toISOString(), uptimePct:99.44, cpuPct:0,   memoryPct:12,  errorRatePct:0,    actionsLast24h:4 },
];
const AGENT_SUMMARY: AgentActivitySummary = { totalAgents: 32, healthy: 26, degraded: 2, failed: 0, suspended: 1, totalQueueDepth: 94 };

@Injectable({ providedIn: 'root' })
export class AgentActivityService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/coordinate/agents`, { params })
  list(q: Record<string, unknown>): Observable<{ data: AgentActivityRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: AGENT_ROWS, pagination: { total: AGENT_ROWS.length, page: 0, limit: 50 } }).pipe(delay(600));
  }
  summary(): Observable<AgentActivitySummary> { return of(AGENT_SUMMARY).pipe(delay(400)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflicts  (A28)
// ─────────────────────────────────────────────────────────────────────────────
const CONFLICT_ROWS: ConflictListRow[] = [
  { conflictId:'conf-001', conflictType:'Resource_Action',  status:'Resolved_Auto',  resolution:'Algorithmic',    agentA:'A11 Workload Optimizer', agentB:'A12 Rate Optimizer',    resourceId:'i-vm-prod-0472', resourceType:'EC2 Instance',  combinedImpact:22_200, currency:CUR, chosenSavings:18_600, confidenceScore:88, detectedAt:'2026-04-12T09:00:00Z', resolvedAt:'2026-04-12T09:02:18Z', resolutionDurationSec:138,  businessUnit:'AI Research',     requiresHuman:false },
  { conflictId:'conf-002', conflictType:'Financial_Impact',  status:'Pending_Human',  resolution:null,             agentA:'A11 Workload Optimizer', agentB:'A13 Architecture Advisor',resourceId:'vm-risk-api',   resourceType:'Azure VM Group', combinedImpact:78_434, currency:CUR, chosenSavings:null,   confidenceScore:null, detectedAt:'2026-04-13T07:00:00Z', resolvedAt:null,                   resolutionDurationSec:null,  businessUnit:'Risk Analytics',  requiresHuman:true  },
  { conflictId:'conf-003', conflictType:'Policy_Boundary',   status:'Resolved_Human', resolution:'Human_Decision', agentA:'A14 Sustainability',    agentB:'A12 Rate Optimizer',    resourceId:'aws-us-east-1', resourceType:'Cloud Region',   combinedImpact:48_600, currency:CUR, chosenSavings:42_000, confidenceScore:76, detectedAt:'2026-04-11T14:00:00Z', resolvedAt:'2026-04-11T18:42:10Z', resolutionDurationSec:17_530, businessUnit:'Platform',        requiresHuman:true  },
  { conflictId:'conf-004', conflictType:'Scheduling',        status:'Resolved_Auto',  resolution:'Algorithmic',    agentA:'A11 Workload Optimizer', agentB:'A24 Tagging Hygiene',   resourceId:'dev-env-batch', resourceType:'Batch Job Set',  combinedImpact:4_200,  currency:CUR, chosenSavings:4_200,  confidenceScore:96, detectedAt:'2026-04-13T03:00:00Z', resolvedAt:'2026-04-13T03:00:42Z', resolutionDurationSec:42,    businessUnit:'Engineering',     requiresHuman:false },
  { conflictId:'conf-005', conflictType:'Resource_Action',   status:'Analyzing',      resolution:null,             agentA:'A16 GPU Optimizer',     agentB:'A12 Rate Optimizer',    resourceId:'gpu-cluster-01',resourceType:'GPU Cluster',    combinedImpact:34_800, currency:CUR, chosenSavings:null,   confidenceScore:null, detectedAt:'2026-04-13T09:00:00Z', resolvedAt:null,                   resolutionDurationSec:null,  businessUnit:'AI Research',     requiresHuman:false },
  { conflictId:'conf-006', conflictType:'Multi_Party',       status:'Escalated',      resolution:null,             agentA:'A11 Workload Optimizer', agentB:'A12 Rate Optimizer',    resourceId:'azure-d-family',resourceType:'Azure VM Family', combinedImpact:118_600,currency:CUR, chosenSavings:null,   confidenceScore:null, detectedAt:'2026-04-10T11:00:00Z', resolvedAt:null,                   resolutionDurationSec:null,  businessUnit:'Digital Products',requiresHuman:true  },
];
const CONFLICT_SUMMARY: ConflictListSummary = { total: 6, open: 3, pendingHuman: 2, resolvedAuto: 2, avgResolutionMin: 8 };

@Injectable({ providedIn: 'root' })
export class ConflictsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/coordinate/conflicts`, { params })
  list(q: Record<string, unknown>): Observable<{ data: ConflictListRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: CONFLICT_ROWS, pagination: { total: CONFLICT_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<ConflictListSummary> { return of(CONFLICT_SUMMARY).pipe(delay(400)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Explanations  (A29)
// ─────────────────────────────────────────────────────────────────────────────
const EXPLANATION_ROWS: ExplanationRow[] = [
  { explanationId:'exp-001', title:'Rightsize EC2 p4d.24xlarge: Why this recommendation is safe',        summary:'The AI Research cluster GPU utilisation is 42% at P95 — well below the optimal 70-85% range. Reducing from p4d.24xlarge to p3.16xlarge eliminates 58% excess GPU capacity while...', originatingAgent:'Workload Optimizer', agentId:'A11', audience:'FinOps_Analyst', status:'Delivered',  relatedActionId:'esc-001', businessUnit:'AI Research',     financialImpact:12_483, currency:CUR, confidenceScore:94, generatedAt:'2026-04-12T10:01:00Z', viewCount:3 },
  { explanationId:'exp-002', title:'AWS Savings Plan recommendation — executive summary',                 summary:'By committing to an AWS Compute Savings Plan at $12,400/hr, the platform can reduce on-demand compute spending by AED 284K annually. The break-even period is 4.2 months...', originatingAgent:'Rate Optimizer',     agentId:'A12', audience:'Executive',       status:'Viewed',     relatedActionId:'esc-002', businessUnit:'Platform',        financialImpact:23_667, currency:CUR, confidenceScore:91, generatedAt:'2026-04-11T08:02:00Z', viewCount:8 },
  { explanationId:'exp-003', title:'GCP region consolidation: trade-offs for finance audience',           summary:'Consolidating three GCP regions into me-central-1 reduces latency-induced cost and simplifies billing by 34%. The migration requires 6 months and AED 120K migration cost...', originatingAgent:'Architecture Advisor',agentId:'A13', audience:'Finance',          status:'Generated',  relatedActionId:'esc-003', businessUnit:'Platform',        financialImpact:18_420, currency:CUR, confidenceScore:71, generatedAt:'2026-04-10T08:05:00Z', viewCount:0 },
  { explanationId:'exp-004', title:'Azure Hybrid Benefit: plain-language explanation for BU leads',       summary:'48 Windows Server VMs are currently licensed through Azure\'s pay-as-you-go model despite the company already owning equivalent on-premises licenses. Enabling AHB switches...', originatingAgent:'License & SaaS',    agentId:'A15', audience:'FinOps_Analyst', status:'Delivered',  relatedActionId:'esc-004', businessUnit:'Core Banking',    financialImpact:8_200,  currency:CUR, confidenceScore:98, generatedAt:'2026-04-13T07:01:00Z', viewCount:2 },
  { explanationId:'exp-005', title:'MIG partitioning explained for ML engineers',                         summary:'Multi-Instance GPU (MIG) partitioning splits each A100 GPU into up to 7 independent slices. For your training workloads, 4 slices of 1/7th A100 provide sufficient GPU memory...', originatingAgent:'GPU Optimizer',      agentId:'A16', audience:'Engineering',     status:'Delivered',  relatedActionId:'esc-005', businessUnit:'AI Research',     financialImpact:9_840,  currency:CUR, confidenceScore:88, generatedAt:'2026-04-12T14:02:00Z', viewCount:5 },
  { explanationId:'exp-006', title:'Anomaly detected: AI Research spend up 40% in 24h',                  summary:'Cloud spend in the AI Research BU increased AED 48,420 in the last 24 hours — 40.9% above the 7-day rolling average. Primary driver: 12 new GPU training jobs launched simultaneously...', originatingAgent:'Anomaly Detection',  agentId:'A05', audience:'All',            status:'Viewed',     relatedActionId:null,      businessUnit:'AI Research',     financialImpact:48_420, currency:CUR, confidenceScore:96, generatedAt:'2026-04-12T11:00:00Z', viewCount:12 },
  { explanationId:'exp-007', title:'Budget breach projection — AI Research, engineering explanation',     summary:'The AI Research BU is forecasted to exhaust its annual budget of AED 12M in 18 days based on the current burn rate of AED 667K/day. The GPU rightsizing recommendation (esc-001)...', originatingAgent:'Forecasting Agent',  agentId:'A06', audience:'Engineering',     status:'Viewed',     relatedActionId:null,      businessUnit:'AI Research',     financialImpact:312_400,currency:CUR, confidenceScore:91, generatedAt:'2026-04-12T10:30:00Z', viewCount:7 },
  { explanationId:'exp-008', title:'Tag compliance drop — why AI Research BU is at 54%',                 summary:'The AI Research BU\'s tag compliance dropped from 68% to 54% over 30 days. Analysis shows 642 new GPU and storage resources were provisioned without the required CostCenter, Owner, and Project tags...', originatingAgent:'Tagging Hygiene',   agentId:'A24', audience:'FinOps_Analyst', status:'Generated',  relatedActionId:null,      businessUnit:'AI Research',     financialImpact:284_600,currency:CUR, confidenceScore:99, generatedAt:'2026-04-13T06:00:00Z', viewCount:0 },
];
const EXPLANATION_SUMMARY: ExplanationListSummary = { total: 8, generatedToday: 3, avgConfidence: 91, uniqueViewers: 14 };

@Injectable({ providedIn: 'root' })
export class ExplanationsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/coordinate/explanations`, { params })
  list(q: Record<string, unknown>): Observable<{ data: ExplanationRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: EXPLANATION_ROWS, pagination: { total: EXPLANATION_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<ExplanationListSummary> { return of(EXPLANATION_SUMMARY).pipe(delay(400)); }
}
