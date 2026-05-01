// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Consolidated services for Batch 6 — Manage.
// Location: apps/frontend/src/app/features/manage/

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import {
  type PolicyListRow, type PolicyListSummary,
  type ViolationListRow, type ViolationListSummary,
  type TaggingDashboardData,
  type ChargebackStatementRow, type ChargebackListSummary,
  type AssessmentDashboardData,
  type EducationContentRow, type EducationListSummary,
} from '@shared/types/manage.types';
import { environment } from '@env/environment';

const CUR = 'AED';
function sparks(b: number) { return Array.from({ length: 8 }, () => Math.round(b + (Math.random() - 0.5) * b * 0.2)); }

// ─────────────────────────────────────────────────────────────────────────────
// Governance Policies  (A20)
// ─────────────────────────────────────────────────────────────────────────────
const POLICY_ROWS: PolicyListRow[] = [
  { policyId:'pol-001', name:'Mandatory Tags — Production', policyType:'Tagging',             severity:'Critical',     scope:'All Production', status:'Active',  enforcement:'Alert_Only',        autoRemediation:false, violationCount:142, affectedResources:284, createdBy:'System',        updatedAt:'2026-04-01T00:00:00Z' },
  { policyId:'pol-002', name:'Mandatory Tags — Non-Prod',   policyType:'Tagging',             severity:'High',         scope:'Non-Production', status:'Active',  enforcement:'Auto_Remediate',    autoRemediation:true,  violationCount:58,  affectedResources:112, createdBy:'System',        updatedAt:'2026-04-01T00:00:00Z' },
  { policyId:'pol-003', name:'Budget Guardrail — 80% Alert',policyType:'Budget_Guardrail',    severity:'High',         scope:'All BUs',        status:'Active',  enforcement:'Alert_Only',        autoRemediation:false, violationCount:3,   affectedResources:3,   createdBy:'Ahmed Hassan',  updatedAt:'2026-03-15T12:00:00Z' },
  { policyId:'pol-004', name:'Budget Guardrail — 100% Block',policyType:'Budget_Guardrail',   severity:'Critical',     scope:'All BUs',        status:'Active',  enforcement:'Block_Provisioning',autoRemediation:false, violationCount:1,   affectedResources:1,   createdBy:'Ahmed Hassan',  updatedAt:'2026-03-15T12:00:00Z' },
  { policyId:'pol-005', name:'EC2 Naming Convention',        policyType:'Naming_Convention',   severity:'Medium',       scope:'AWS Production', status:'Active',  enforcement:'Alert_Only',        autoRemediation:false, violationCount:28,  affectedResources:28,  createdBy:'Omar Khalid',   updatedAt:'2026-02-20T09:00:00Z' },
  { policyId:'pol-006', name:'VM Naming Convention',         policyType:'Naming_Convention',   severity:'Medium',       scope:'Azure All',      status:'Active',  enforcement:'Alert_Only',        autoRemediation:false, violationCount:14,  affectedResources:14,  createdBy:'Omar Khalid',   updatedAt:'2026-02-20T09:00:00Z' },
  { policyId:'pol-007', name:'Least Privilege Access Prod',  policyType:'Access_Control',      severity:'Critical',     scope:'All Production', status:'Active',  enforcement:'Alert_Only',        autoRemediation:false, violationCount:7,   affectedResources:24,  createdBy:'Sara Ali',      updatedAt:'2026-01-10T14:00:00Z' },
  { policyId:'pol-008', name:'No Public S3 Buckets',         policyType:'Automation_Boundary', severity:'Critical',     scope:'AWS All',        status:'Active',  enforcement:'Block_Provisioning',autoRemediation:false, violationCount:0,   affectedResources:0,   createdBy:'System',        updatedAt:'2026-01-01T00:00:00Z' },
  { policyId:'pol-009', name:'Dev Environment Shutdown',     policyType:'Automation_Boundary', severity:'Low',          scope:'Dev Environments',status:'Draft',  enforcement:'Auto_Remediate',    autoRemediation:true,  violationCount:0,   affectedResources:0,   createdBy:'Fatima Jaber',  updatedAt:'2026-04-10T16:00:00Z' },
  { policyId:'pol-010', name:'GPU Idle Time Limit (4h)',     policyType:'Automation_Boundary', severity:'Medium',       scope:'GPU Clusters',   status:'Active',  enforcement:'Alert_Only',        autoRemediation:false, violationCount:4,   affectedResources:4,   createdBy:'Ahmed Hassan',  updatedAt:'2026-04-01T00:00:00Z' },
];
const POLICY_SUMMARY: PolicyListSummary = { total: 10, active: 8, draft: 1, withViolations: 7, autoRemediated: 2 };

@Injectable({ providedIn: 'root' })
export class GovernancePoliciesService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/manage/policies`, { params })
  list(q: Record<string, unknown>): Observable<{ data: PolicyListRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: POLICY_ROWS, pagination: { total: POLICY_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<PolicyListSummary> { return of(POLICY_SUMMARY).pipe(delay(400)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Violations  (A20)
// ─────────────────────────────────────────────────────────────────────────────
const VIOLATION_ROWS: ViolationListRow[] = [
  { violationId:'viol-001', policyName:'Mandatory Tags — Production',  policyType:'Tagging',          severity:'Critical',     status:'Open',          slaStatus:'Approaching',  resourceId:'i-0a1b2c3d', resourceType:'EC2 Instance', provider:'AWS',   businessUnit:'AI Research',     environment:'Production', costImpact:48_420, currency:CUR, detectedAt:'2026-04-11T08:00:00Z', slaRemainingHours:2,  assignedTo:null },
  { violationId:'viol-002', policyName:'Least Privilege Access Prod',  policyType:'Access_Control',   severity:'Critical',     status:'Acknowledged',  slaStatus:'Within_SLA',   resourceId:'role-admin',  resourceType:'IAM Role',     provider:'AWS',   businessUnit:'Engineering',     environment:'Production', costImpact:0,      currency:CUR, detectedAt:'2026-04-12T14:00:00Z', slaRemainingHours:18, assignedTo:'Sara Ali' },
  { violationId:'viol-003', policyName:'Budget Guardrail — 100% Block',policyType:'Budget_Guardrail', severity:'Critical',     status:'In_Remediation',slaStatus:'Within_SLA',   resourceId:'bg-ai-res',   resourceType:'Budget',       provider:'AWS',   businessUnit:'AI Research',     environment:'All',        costImpact:312_400,currency:CUR, detectedAt:'2026-04-12T10:00:00Z', slaRemainingHours:8,  assignedTo:'Ahmed Hassan' },
  { violationId:'viol-004', policyName:'Mandatory Tags — Production',  policyType:'Tagging',          severity:'High',         status:'Open',          slaStatus:'Within_SLA',   resourceId:'vm-risk-01',  resourceType:'Azure VM',     provider:'Azure', businessUnit:'Risk Analytics',  environment:'Production', costImpact:8_640,  currency:CUR, detectedAt:'2026-04-13T06:00:00Z', slaRemainingHours:21, assignedTo:null },
  { violationId:'viol-005', policyName:'EC2 Naming Convention',        policyType:'Naming_Convention',severity:'Medium',       status:'Open',          slaStatus:'Within_SLA',   resourceId:'ec2-dataproc',resourceType:'EC2 Instance', provider:'AWS',   businessUnit:'Data Platform',   environment:'Production', costImpact:3_240,  currency:CUR, detectedAt:'2026-04-10T11:00:00Z', slaRemainingHours:55, assignedTo:null },
  { violationId:'viol-006', policyName:'Mandatory Tags — Non-Prod',    policyType:'Tagging',          severity:'High',         status:'Open',          slaStatus:'Breached',     resourceId:'vm-dev-fleet',resourceType:'VM ScaleSet',  provider:'Azure', businessUnit:'Engineering',     environment:'Development',costImpact:12_840, currency:CUR, detectedAt:'2026-04-06T10:00:00Z', slaRemainingHours:null,assignedTo:'Omar Khalid' },
  { violationId:'viol-007', policyName:'GPU Idle Time Limit (4h)',     policyType:'Automation_Boundary',severity:'Medium',     status:'Open',          slaStatus:'Within_SLA',   resourceId:'gpu-train-01',resourceType:'GPU Node',    provider:'AWS',   businessUnit:'AI Research',     environment:'Production', costImpact:18_240, currency:CUR, detectedAt:'2026-04-13T04:00:00Z', slaRemainingHours:64, assignedTo:null },
  { violationId:'viol-008', policyName:'VM Naming Convention',         policyType:'Naming_Convention',severity:'Medium',       status:'Remediated',    slaStatus:'Within_SLA',   resourceId:'vm-az-002',   resourceType:'Azure VM',     provider:'Azure', businessUnit:'Core Banking',    environment:'Production', costImpact:0,      currency:CUR, detectedAt:'2026-04-08T09:00:00Z', slaRemainingHours:null,assignedTo:'Fatima Jaber' },
];
const VIOLATION_SUMMARY: ViolationListSummary = { total: 8, open: 5, critical: 3, slaBreached: 1, unacknowledged: 4, totalCostImpact: 403_780, currency: CUR };

@Injectable({ providedIn: 'root' })
export class PolicyViolationsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/manage/violations`, { params })
  list(q: Record<string, unknown>): Observable<{ data: ViolationListRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: VIOLATION_ROWS, pagination: { total: VIOLATION_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<ViolationListSummary> { return of(VIOLATION_SUMMARY).pipe(delay(400)); }
  acknowledge(id: string): Observable<void>  { return of(undefined as void).pipe(delay(400)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tagging Hygiene Dashboard  (A24)
// ─────────────────────────────────────────────────────────────────────────────
const TAGGING_MOCK: TaggingDashboardData = {
  kpis: {
    overallComplianceRate: { value: 78.4, deltaPercent: 2.8, deltaDirection: 'up',   sparkline: sparks(76) },
    nonCompliantResources: { value: 1_842, deltaPercent:-8.4, deltaDirection: 'down', sparkline: sparks(2_000) },
    untaggedCost:          { value: 284_600, currency: CUR, deltaPercent: -12.1, deltaDirection: 'down', sparkline: sparks(320_000) },
    autoTaggedToday:       { value: 184, deltaPercent: 22, deltaDirection: 'up', sparkline: sparks(150) },
  },
  complianceTrend: Array.from({ length: 12 }, (_, i) => ({
    period: new Date(2025, i, 1).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }),
    rate: Math.round(62 + i * 1.4 + (Math.random() - 0.5) * 3),
  })),
  complianceByBu: [
    { bu: 'Core Banking',     complianceRate: 96.2, nonCompliantCount: 18 },
    { bu: 'Risk Analytics',   complianceRate: 91.4, nonCompliantCount: 32 },
    { bu: 'Digital Products', complianceRate: 84.8, nonCompliantCount: 84 },
    { bu: 'Data Platform',    complianceRate: 72.1, nonCompliantCount: 210 },
    { bu: 'Engineering',      complianceRate: 68.4, nonCompliantCount: 380 },
    { bu: 'AI Research',      complianceRate: 54.2, nonCompliantCount: 642 },
    { bu: 'Analytics',        complianceRate: 81.6, nonCompliantCount: 128 },
    { bu: 'Finance',          complianceRate: 95.8, nonCompliantCount: 12 },
  ],
  remediation: [
    { resourceId:'i-0a1b2c3d', resourceName:'EC2 p4d.24xlarge', resourceType:'EC2 Instance', provider:'AWS',   businessUnit:'AI Research',   environment:'Production', missingTags:['CostCenter','Owner','Project'], monthlyCost:52_400, currency:CUR, priority:'Critical', daysOpen:2 },
    { resourceId:'vm-dev-fleet',resourceName:'Azure Dev VMSS',  resourceType:'VM ScaleSet',  provider:'Azure', businessUnit:'Engineering',   environment:'Development',missingTags:['Owner'],                         monthlyCost:12_840, currency:CUR, priority:'High',     daysOpen:8 },
    { resourceId:'gke-ns-data', resourceName:'GKE analytics NS',resourceType:'K8s Namespace',provider:'GCP',   businessUnit:'Analytics',     environment:'Production', missingTags:['CostCenter','BillingCode'],     monthlyCost:14_200, currency:CUR, priority:'High',     daysOpen:5 },
    { resourceId:'rds-dev-01',  resourceName:'RDS Dev Instance', resourceType:'RDS Instance', provider:'AWS',   businessUnit:'Engineering',   environment:'Development',missingTags:['Owner','Project','Env'],        monthlyCost:2_840,  currency:CUR, priority:'Medium',   daysOpen:12 },
    { resourceId:'blob-archive',resourceName:'Azure Blob Archive',resourceType:'Blob Storage',provider:'Azure', businessUnit:'Data Platform', environment:'Production', missingTags:['DataClassification'],           monthlyCost:4_200,  currency:CUR, priority:'Medium',   daysOpen:3 },
  ],
  narrative: {
    summary: 'Overall tag compliance is 78.4% (+2.8pp), driven by automated remediation of 184 resources today. AI Research BU remains the lowest at 54.2% with 642 non-compliant resources. Untagged cost has decreased to AED 284,600 (-12.1%) as auto-tagging takes effect in non-production environments.',
    agentId: 'A24', agentName: 'Tagging Hygiene Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      'Overall compliance 78.4% (+2.8pp) — 184 resources auto-tagged today',
      'AI Research BU: 54.2% compliance — 642 non-compliant resources require action',
      'AED 284,600 untagged cost (-12.1%) — improving allocation accuracy',
      'Core Banking leads with 96.2% compliance — best practice target',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class TaggingHygieneService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<TaggingDashboardData>(`${environment.apiUrl}/manage/tagging/dashboard`)
  getDashboard(): Observable<TaggingDashboardData> { return of(TAGGING_MOCK).pipe(delay(700)); }
  triggerScan(): Observable<void> { return of(undefined as void).pipe(delay(500)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chargeback  (A22)
// ─────────────────────────────────────────────────────────────────────────────
const CB_ROWS: ChargebackStatementRow[] = [
  { statementId:'cb-2026-03-001', billingPeriod:'2026-03', statementType:'Chargeback_Binding', businessUnit:'All BUs',         totalAmount:4_218_420, currency:CUR, status:'Distributed', disputeCount:2, hasAnomaly:false, generatedAt:'2026-04-03T06:00:00Z', distributedAt:'2026-04-05T09:00:00Z', approvedBy:'Ahmed Hassan' },
  { statementId:'cb-2026-03-ai',  billingPeriod:'2026-03', statementType:'Chargeback_Binding', businessUnit:'AI Research',     totalAmount:1_480_200, currency:CUR, status:'Disputed',    disputeCount:1, hasAnomaly:true,  generatedAt:'2026-04-03T06:00:00Z', distributedAt:'2026-04-05T09:00:00Z', approvedBy:'Ahmed Hassan' },
  { statementId:'cb-2026-03-cb',  billingPeriod:'2026-03', statementType:'Chargeback_Binding', businessUnit:'Core Banking',    totalAmount:824_400,   currency:CUR, status:'Distributed', disputeCount:0, hasAnomaly:false, generatedAt:'2026-04-03T06:00:00Z', distributedAt:'2026-04-05T09:00:00Z', approvedBy:'Ahmed Hassan' },
  { statementId:'cb-2026-03-dp',  billingPeriod:'2026-03', statementType:'Chargeback_Binding', businessUnit:'Digital Products',totalAmount:680_200,   currency:CUR, status:'Distributed', disputeCount:1, hasAnomaly:false, generatedAt:'2026-04-03T06:00:00Z', distributedAt:'2026-04-05T09:00:00Z', approvedBy:'Ahmed Hassan' },
  { statementId:'cb-2026-04-001', billingPeriod:'2026-04', statementType:'Chargeback_Binding', businessUnit:'All BUs',         totalAmount:4_640_180, currency:CUR, status:'Pending_Review',disputeCount:0, hasAnomaly:true,  generatedAt:'2026-04-13T06:00:00Z', distributedAt:null, approvedBy:null },
  { statementId:'sw-2026-03-001', billingPeriod:'2026-03', statementType:'Showback_Advisory',  businessUnit:'Engineering',     totalAmount:342_800,   currency:CUR, status:'Distributed', disputeCount:0, hasAnomaly:false, generatedAt:'2026-04-03T06:00:00Z', distributedAt:'2026-04-05T10:00:00Z', approvedBy:'System' },
];
const CB_SUMMARY: ChargebackListSummary = { totalCharged: 4_218_420, currency: CUR, openDisputes: 2, pendingApproval: 1, reconStatus: 'Warning', lastPeriod: '2026-03' };

@Injectable({ providedIn: 'root' })
export class ChargebackService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/manage/chargeback`, { params })
  list(q: Record<string, unknown>): Observable<{ data: ChargebackStatementRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: CB_ROWS, pagination: { total: CB_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<ChargebackListSummary> { return of(CB_SUMMARY).pipe(delay(400)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment  (A21)
// ─────────────────────────────────────────────────────────────────────────────
const ASSESSMENT_MOCK: AssessmentDashboardData = {
  kpis: {
    overallMaturityScore: { value: 58, deltaPercent: 8.4, deltaDirection: 'up', sparkline: sparks(54) },
    crawlCount:           { value: 6,  sparkline: sparks(8) },
    walkCount:            { value: 14, sparkline: sparks(12) },
    runCount:             { value: 2,  sparkline: sparks(1) },
  },
  radarData: [
    { capability:'Data Ingestion',       score: 82 },
    { capability:'Cost Normalisation',   score: 79 },
    { capability:'Allocation',           score: 74 },
    { capability:'Reporting',            score: 68 },
    { capability:'Anomaly Detection',    score: 72 },
    { capability:'Forecasting',          score: 64 },
    { capability:'Budget Management',    score: 56 },
    { capability:'Benchmarking',         score: 48 },
    { capability:'Unit Economics',       score: 42 },
    { capability:'Workload Optimisation',score: 61 },
    { capability:'Rate Optimisation',    score: 55 },
    { capability:'Governance',           score: 52 },
    { capability:'Tagging Hygiene',      score: 44 },
    { capability:'Education',            score: 38 },
  ],
  capabilities: [
    { capabilityId:'c-01', capabilityName:'Data Ingestion',       domain:'Understand', maturityLevel:'Run',  score:82, deltaScore:+4,  agentId:'A01', keyKpis:'Freshness 0.5h; Quality 99.2%' },
    { capabilityId:'c-02', capabilityName:'Cost Normalisation',   domain:'Understand', maturityLevel:'Run',  score:79, deltaScore:+2,  agentId:'A02', keyKpis:'FOCUS compliance 99%; Norm rate 100%' },
    { capabilityId:'c-03', capabilityName:'Allocation',           domain:'Understand', maturityLevel:'Walk', score:74, deltaScore:+5,  agentId:'A03', keyKpis:'Coverage 94%; Unattributed 6%' },
    { capabilityId:'c-04', capabilityName:'Reporting & Analytics',domain:'Understand', maturityLevel:'Walk', score:68, deltaScore:+3,  agentId:'A04', keyKpis:'Freshness daily; Dashboards live' },
    { capabilityId:'c-05', capabilityName:'Anomaly Detection',    domain:'Understand', maturityLevel:'Walk', score:72, deltaScore:+8,  agentId:'A05', keyKpis:'MTTD 42min; Precision 91%' },
    { capabilityId:'c-06', capabilityName:'Forecasting',          domain:'Quantify',   maturityLevel:'Walk', score:64, deltaScore:+6,  agentId:'A06', keyKpis:'Accuracy 94.2%; MAPE 5.8%' },
    { capabilityId:'c-07', capabilityName:'Budget Management',    domain:'Quantify',   maturityLevel:'Walk', score:56, deltaScore:+4,  agentId:'A07', keyKpis:'Coverage 78%; 3 breaches active' },
    { capabilityId:'c-08', capabilityName:'Benchmarking',         domain:'Quantify',   maturityLevel:'Crawl',score:48, deltaScore:+2,  agentId:'A08', keyKpis:'8 above-benchmark; 22% avg deviation' },
    { capabilityId:'c-09', capabilityName:'Unit Economics',       domain:'Quantify',   maturityLevel:'Crawl',score:42, deltaScore:+8,  agentId:'A09', keyKpis:'CPT coverage 65%; 2 critical apps' },
    { capabilityId:'c-10', capabilityName:'Workload Optimisation',domain:'Optimize',   maturityLevel:'Walk', score:61, deltaScore:+12, agentId:'A11', keyKpis:'48 opportunities; AED 978K pending' },
    { capabilityId:'c-11', capabilityName:'Rate Optimisation',    domain:'Optimize',   maturityLevel:'Walk', score:55, deltaScore:+4,  agentId:'A12', keyKpis:'Coverage 62.4%; AED 402K pending' },
    { capabilityId:'c-12', capabilityName:'Governance',           domain:'Manage',     maturityLevel:'Walk', score:52, deltaScore:+2,  agentId:'A20', keyKpis:'Posture 74%; 253 open violations' },
    { capabilityId:'c-13', capabilityName:'Tagging Hygiene',      domain:'Manage',     maturityLevel:'Crawl',score:44, deltaScore:+6,  agentId:'A24', keyKpis:'Compliance 78.4%; AED 285K untagged' },
    { capabilityId:'c-14', capabilityName:'Education & Adoption', domain:'Manage',     maturityLevel:'Crawl',score:38, deltaScore:+4,  agentId:'A25', keyKpis:'Adoption 42%; Completion rate 68%' },
  ],
  narrative: {
    summary: 'Overall FinOps maturity score is 58/100 (Walk), up 8.4% (+4.5 points) from the previous assessment. 2 capabilities have reached Run level: Data Ingestion and Cost Normalisation. The platform is transitioning 3 Crawl capabilities toward Walk. Key improvement opportunities are in Unit Economics (42), Education & Adoption (38), and Tagging Hygiene (44).',
    agentId: 'A21', agentName: 'Assessment Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      'Overall maturity 58/100 (+8.4%) — on track for Walk→Run transition in 2 capabilities by Q3',
      'Data Ingestion (82) + Cost Normalisation (79) achieved Run — platform data foundation solid',
      'Unit Economics (42) lowest Quantify capability — CPT coverage expansion recommended',
      'Education & Adoption (38) — structured enablement programme needed to accelerate platform ROI',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class AssessmentService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<AssessmentDashboardData>(`${environment.apiUrl}/manage/assessment/dashboard`)
  getDashboard(): Observable<AssessmentDashboardData> { return of(ASSESSMENT_MOCK).pipe(delay(700)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Education & Training  (A25)
// ─────────────────────────────────────────────────────────────────────────────
const EDUCATION_ROWS: EducationContentRow[] = [
  { contentId:'edu-001', title:'FinOps Foundations: Cost Visibility Basics',          contentType:'Video',                  proficiencyLevel:'Novice',      status:'Published', targetRole:'All',              enrollmentCount:342, completionRate:82.7, avgRating:4.6, durationMinutes:24,  publishedAt:'2025-10-01T00:00:00Z', lastUpdatedAt:'2026-01-15T00:00:00Z' },
  { contentId:'edu-002', title:'Understanding Your Cloud Bill',                        contentType:'Interactive_Tutorial',    proficiencyLevel:'Beginner',    status:'Published', targetRole:'BU Lead',          enrollmentCount:284, completionRate:74.3, avgRating:4.4, durationMinutes:45,  publishedAt:'2025-10-15T00:00:00Z', lastUpdatedAt:'2026-01-15T00:00:00Z' },
  { contentId:'edu-003', title:'AWS Reserved Instances: Commit or Not?',              contentType:'Article',                 proficiencyLevel:'Intermediate',status:'Published', targetRole:'FinOps Analyst',   enrollmentCount:186, completionRate:61.8, avgRating:4.2, durationMinutes:15,  publishedAt:'2025-11-01T00:00:00Z', lastUpdatedAt:'2026-02-10T00:00:00Z' },
  { contentId:'edu-004', title:'Writing Good Allocation Rules',                        contentType:'Walkthrough',             proficiencyLevel:'Intermediate',status:'Published', targetRole:'FinOps Analyst',   enrollmentCount:124, completionRate:68.5, avgRating:4.5, durationMinutes:35,  publishedAt:'2025-11-15T00:00:00Z', lastUpdatedAt:'2026-02-10T00:00:00Z' },
  { contentId:'edu-005', title:'FinOps Practitioner Certification',                   contentType:'Certification_Module',    proficiencyLevel:'Advanced',    status:'Published', targetRole:'FinOps Analyst',   enrollmentCount:68,  completionRate:54.4, avgRating:4.8, durationMinutes:240, publishedAt:'2025-12-01T00:00:00Z', lastUpdatedAt:'2026-03-01T00:00:00Z' },
  { contentId:'edu-006', title:'Kubernetes Cost Attribution Deep Dive',               contentType:'Video',                   proficiencyLevel:'Advanced',    status:'Published', targetRole:'Cloud Engineer',   enrollmentCount:142, completionRate:48.6, avgRating:4.3, durationMinutes:52,  publishedAt:'2026-01-10T00:00:00Z', lastUpdatedAt:'2026-03-10T00:00:00Z' },
  { contentId:'edu-007', title:'Tagging Strategy for Cost Allocation',                contentType:'Article',                 proficiencyLevel:'Beginner',    status:'Published', targetRole:'All',              enrollmentCount:228, completionRate:71.9, avgRating:4.1, durationMinutes:12,  publishedAt:'2026-01-20T00:00:00Z', lastUpdatedAt:'2026-03-15T00:00:00Z' },
  { contentId:'edu-008', title:'GPU Cost Optimization for ML Engineers',              contentType:'Interactive_Tutorial',    proficiencyLevel:'Expert',      status:'Published', targetRole:'ML Engineer',      enrollmentCount:84,  completionRate:62.0, avgRating:4.7, durationMinutes:60,  publishedAt:'2026-02-01T00:00:00Z', lastUpdatedAt:'2026-04-01T00:00:00Z' },
  { contentId:'edu-009', title:'FinOps for Executives: 5-Minute Brief',               contentType:'Quick_Tip',              proficiencyLevel:'Novice',      status:'Published', targetRole:'Executive',        enrollmentCount:124, completionRate:88.7, avgRating:4.0, durationMinutes:5,   publishedAt:'2026-02-15T00:00:00Z', lastUpdatedAt:'2026-04-01T00:00:00Z' },
  { contentId:'edu-010', title:'Building a FinOps Culture: Change Management',        contentType:'Article',                 proficiencyLevel:'Intermediate',status:'Draft',    targetRole:'FinOps Lead',      enrollmentCount:0,   completionRate:0,    avgRating:0,   durationMinutes:18,  publishedAt:null,                  lastUpdatedAt:'2026-04-10T00:00:00Z' },
];
const EDUCATION_SUMMARY: EducationListSummary = { totalContent: 10, published: 9, totalEnrollments: 1_582, avgCompletionRate: 71.3, avgRating: 4.46 };

@Injectable({ providedIn: 'root' })
export class EducationService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/manage/education`, { params })
  list(q: Record<string, unknown>): Observable<{ data: EducationContentRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: EDUCATION_ROWS, pagination: { total: EDUCATION_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<EducationListSummary> { return of(EDUCATION_SUMMARY).pipe(delay(400)); }
}
