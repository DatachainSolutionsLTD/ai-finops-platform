// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Services for: WorkloadOptimizer, RateOptimizer, ArchitectureAdvisor, Sustainability
// Each service is in its own @Injectable class below.

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import {
  type WorkloadDashboardData, type WorkloadOptTimeRange,
  type RateDashboardData, type RateOptTimeRange,
  type ArchRecommendationRow, type ArchAdvisorSummary,
  type SustainabilityDashboardData, type SustainabilityTimeRange,
} from '@shared/types/optimize-dashboards.types';
import { environment } from '@env/environment';

const CUR = 'AED';
function sparks(base: number): number[] { return Array.from({ length: 8 }, () => +(base + (Math.random() - 0.5) * base * 0.2).toFixed(0)); }

// ─────────────────────────────────────────────────────────────────────────────
// Workload Optimizer (A11)
// ─────────────────────────────────────────────────────────────────────────────
const WORKLOAD_MOCK: WorkloadDashboardData = {
  kpis: {
    totalOpportunities: { value: 48,        deltaPercent: -12, deltaDirection: 'down', sparkline: sparks(55) },
    pendingSavings:     { value: 978_200, currency: CUR, deltaPercent: 8.4, deltaDirection: 'up', sparkline: sparks(900_000) },
    realizedSavings:    { value: 412_600, currency: CUR, deltaPercent: 22.3, deltaDirection: 'up', sparkline: sparks(340_000) },
    avgConfidence:      { value: 89,         deltaPercent: 1.2, deltaDirection: 'up', sparkline: sparks(88) },
  },
  opportunityBreakdown: [
    { type:'Rightsizing',          count:18, totalSavings:384_200, currency:CUR, avgConfidence:91 },
    { type:'Idle / Schedule',      count:14, totalSavings:284_600, currency:CUR, avgConfidence:97 },
    { type:'Orphan Cleanup',       count:9,  totalSavings:124_400, currency:CUR, avgConfidence:95 },
    { type:'K8s Limit Adjustment', count:5,  totalSavings:112_800, currency:CUR, avgConfidence:86 },
    { type:'Spot Migration',       count:2,  totalSavings:72_200,  currency:CUR, avgConfidence:82 },
  ],
  savingsTrend: Array.from({ length: 6 }, (_, i) => ({
    period: new Date(2025, 10 + i, 1).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }),
    projected: Math.round(80_000 + i * 12_000 + Math.random() * 8_000),
    realized:  Math.round(60_000 + i * 10_000 + Math.random() * 6_000),
  })),
  topResources: [
    { resourceId:'i-0a1b2c3d', resourceName:'EC2 p4d.24xlarge',  resourceType:'EC2',        provider:'AWS',   environment:'Production', businessUnit:'AI Research',    optimizationType:'Rightsizing',     currentMonthlyCost:52_400, savingsAmount:149_800, currency:CUR, confidenceScore:94, status:'Pending' },
    { resourceId:'vm-dev-01',  resourceName:'Azure Dev VM Fleet', resourceType:'VM ScaleSet', provider:'Azure', environment:'Development', businessUnit:'Engineering',    optimizationType:'Schedule',        currentMonthlyCost:12_840, savingsAmount:84_200,  currency:CUR, confidenceScore:98, status:'Pending' },
    { resourceId:'s3-grp-01',  resourceName:'Orphaned S3 Buckets',resourceType:'S3',          provider:'AWS',   environment:'Production', businessUnit:'Data Platform',  optimizationType:'Orphan Cleanup',  currentMonthlyCost:3_550,  savingsAmount:42_600,  currency:CUR, confidenceScore:96, status:'Pending' },
    { resourceId:'gke-ns-01',  resourceName:'Analytics K8s NS',   resourceType:'K8s NS',      provider:'GCP',   environment:'Production', businessUnit:'Analytics',      optimizationType:'K8s Limits',      currentMonthlyCost:14_200, savingsAmount:68_400,  currency:CUR, confidenceScore:87, status:'Pending' },
    { resourceId:'rds-idle-01',resourceName:'RDS Dev Instance',   resourceType:'RDS',         provider:'AWS',   environment:'Development', businessUnit:'Engineering',    optimizationType:'Idle Shutdown',   currentMonthlyCost:2_840,  savingsAmount:34_080,  currency:CUR, confidenceScore:99, status:'Approved' },
  ],
  narrative: {
    summary: '48 workload optimization opportunities identified with AED 978K in pending savings. Rightsizing opportunities represent 39% of total value, led by the AI Research EC2 p4d.24xlarge rightsizing recommendation (AED 150K annual). Realized savings for the trailing 90 days are AED 413K (+22.3% MoM).',
    agentId:'A11', agentName:'Workload Optimizer Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      '48 opportunities — 12% reduction from prior period (optimization progress)',
      'AED 978K pending savings — top opportunity: AI Research EC2 rightsizing AED 150K',
      'AED 413K realized savings trailing 90d (+22.3% MoM)',
      '14 idle/schedule automation opportunities — immediate low-risk savings available',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class WorkloadOptimizerService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<WorkloadDashboardData>(`${environment.apiUrl}/optimize/workload/dashboard`, { params })
  getDashboard(range: WorkloadOptTimeRange): Observable<WorkloadDashboardData> {
    return of(WORKLOAD_MOCK).pipe(delay(700));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Optimizer (A12)
// ─────────────────────────────────────────────────────────────────────────────
const RATE_MOCK: RateDashboardData = {
  kpis: {
    coverageRate:   { value: 62.4, deltaPercent: 4.2, deltaDirection: 'up',   sparkline: sparks(60) },
    pendingSavings: { value: 402_600, currency: CUR, deltaPercent: 18.4, deltaDirection: 'up', sparkline: sparks(340_000) },
    expiringSoon:   { value: 3,    deltaPercent: 0,   deltaDirection: 'neutral', sparkline: sparks(3) },
    underUtilized:  { value: 2,    deltaPercent: -50, deltaDirection: 'down',  sparkline: sparks(4) },
  },
  portfolioByProvider: [
    { provider:'AWS',   type:'Savings Plan',      utilization:91.2, totalCost:184_200, currency:CUR, savings:96_400,  expiresInDays:284 },
    { provider:'AWS',   type:'Reserved Instances', utilization:78.4, totalCost:142_600, currency:CUR, savings:64_200,  expiresInDays:120 },
    { provider:'Azure', type:'Reserved Instances', utilization:95.6, totalCost:218_400, currency:CUR, savings:84_800,  expiresInDays:342 },
    { provider:'GCP',   type:'CUD Resource-based', utilization:88.0, totalCost:96_200,  currency:CUR, savings:32_400,  expiresInDays:180 },
  ],
  savingsTrend: Array.from({ length: 6 }, (_, i) => ({
    period: new Date(2025, 10 + i, 1).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }),
    projected: Math.round(55_000 + i * 4_000 + Math.random() * 3_000),
    realized:  Math.round(48_000 + i * 3_500 + Math.random() * 2_500),
  })),
  recommendations: [
    { recommendationId:'rr-001', title:'AWS Compute Savings Plan $12,400/hr commitment',  provider:'AWS',   instrument:'Savings Plan',       annualSavings:284_000, currency:CUR, breakEvenMonths:4.2, risk:'Low',    status:'Pending' },
    { recommendationId:'rr-002', title:'Azure 1-Year Reserved Instances (D-series)',        provider:'Azure', instrument:'Reserved Instance',   annualSavings:118_600, currency:CUR, breakEvenMonths:5.8, risk:'Low',    status:'Pending' },
    { recommendationId:'rr-003', title:'AWS EC2 Instance SP (r6i family, me-central-1)',    provider:'AWS',   instrument:'Savings Plan',       annualSavings:52_400,  currency:CUR, breakEvenMonths:6.1, risk:'Low',    status:'Approved' },
    { recommendationId:'rr-004', title:'GCP Resource CUD: n2-standard-64 (3-year)',         provider:'GCP',   instrument:'Committed Use Discount', annualSavings:38_200, currency:CUR, breakEvenMonths:3.8, risk:'Medium', status:'Pending' },
    { recommendationId:'rr-005', title:'Renew expiring AWS RIs before 120-day deadline',    provider:'AWS',   instrument:'Reserved Instance',   annualSavings:64_200,  currency:CUR, breakEvenMonths:5.2, risk:'Medium', status:'Pending' },
  ],
  narrative: {
    summary: 'Commitment coverage is 62.4% of eligible on-demand spend, up 4.2pp. AED 402K in new commitment recommendations are pending approval, led by the AWS Compute Savings Plan (AED 284K annual). Two under-utilized commitments require attention. Three commitments expire within 120 days.',
    agentId:'A12', agentName:'Rate Optimizer Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      'Coverage 62.4% (+4.2pp) — opportunity to reach 80%+ with pending recommendations',
      'AWS Savings Plan AED 284K/yr pending approval — break-even 4.2 months',
      '3 commitments expiring within 120 days — renewal analysis ready',
      '2 under-utilized commitments (AWS RIs <80%) — remediation recommended',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class RateOptimizerService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<RateDashboardData>(`${environment.apiUrl}/optimize/rate/dashboard`, { params })
  getDashboard(range: RateOptTimeRange): Observable<RateDashboardData> {
    return of(RATE_MOCK).pipe(delay(700));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Architecture Advisor (A13)
// ─────────────────────────────────────────────────────────────────────────────
const ARCH_ROWS: ArchRecommendationRow[] = [
  { recommendationId:'aa-001', title:'Containerize Risk Scoring API on AKS',              type:'Containerization',     priority:'High',     status:'Pending',      application:'Risk Scoring API',   businessUnit:'Risk Analytics',   provider:'Azure', monthlySavings:6_034,  migrationCost:48_000, currency:CUR, paybackMonths:7.9,  complexityScore:5, confidenceScore:78, createdAt:'2026-04-09T11:00:00Z', assignedTo:null },
  { recommendationId:'aa-002', title:'Migrate Report Generator to Lambda (Serverless)',    type:'Serverless_Migration', priority:'Medium',   status:'Approved',     application:'Report Generator',   businessUnit:'Analytics',        provider:'AWS',   monthlySavings:4_200,  migrationCost:24_000, currency:CUR, paybackMonths:5.7,  complexityScore:4, confidenceScore:84, createdAt:'2026-04-07T09:00:00Z', assignedTo:'Omar Khalid' },
  { recommendationId:'aa-003', title:'Replace self-managed Redis with ElastiCache',        type:'Managed_Service',      priority:'High',     status:'In_Progress',  application:'Session Cache',      businessUnit:'Digital Products', provider:'AWS',   monthlySavings:3_840,  migrationCost:8_000,  currency:CUR, paybackMonths:2.1,  complexityScore:3, confidenceScore:92, createdAt:'2026-04-05T14:00:00Z', assignedTo:'Sara Ali' },
  { recommendationId:'aa-004', title:'Consolidate 3 GCP regions → me-central-1',          type:'Region_Consolidation', priority:'Critical', status:'Under_Review',application:'All workloads GCP',  businessUnit:'Platform',         provider:'GCP',   monthlySavings:18_420, migrationCost:120_000,currency:CUR, paybackMonths:6.5,  complexityScore:8, confidenceScore:71, createdAt:'2026-04-10T08:00:00Z', assignedTo:'Ahmed Hassan' },
  { recommendationId:'aa-005', title:'Modernize Notification Svc IaC (Terraform → CDK)',  type:'IaC_Modernization',    priority:'Low',      status:'Open',         application:'Notification Svc',  businessUnit:'Digital Products', provider:'AWS',   monthlySavings:1_200,  migrationCost:16_000, currency:CUR, paybackMonths:13.3, complexityScore:2, confidenceScore:89, createdAt:'2026-04-11T15:00:00Z', assignedTo:null },
  { recommendationId:'aa-006', title:'Replace Azure VMs with Azure Container Apps',        type:'Containerization',     priority:'Medium',   status:'Open',         application:'Batch Processor',   businessUnit:'Data Platform',    provider:'Azure', monthlySavings:8_640,  migrationCost:64_000, currency:CUR, paybackMonths:7.4,  complexityScore:6, confidenceScore:82, createdAt:'2026-04-12T10:00:00Z', assignedTo:null },
  { recommendationId:'aa-007', title:'Migrate OCI workloads to AWS (exit)',                type:'Multi_Cloud_Exit',     priority:'Medium',   status:'Rejected',     application:'OCI Tier',          businessUnit:'Core Banking',     provider:'OCI',   monthlySavings:12_400, migrationCost:280_000,currency:CUR, paybackMonths:22.6, complexityScore:9, confidenceScore:61, createdAt:'2026-04-01T08:00:00Z', assignedTo:'Fatima Jaber' },
];
const ARCH_SUMMARY: ArchAdvisorSummary = { total: 7, open: 3, totalSavings: 682_200, currency: CUR, inProgress: 1 };

@Injectable({ providedIn: 'root' })
export class ArchitectureAdvisorService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<{ data: ArchRecommendationRow[]; pagination: ... }>(`${environment.apiUrl}/optimize/architecture`, { params })
  list(query: Record<string, unknown>): Observable<{ data: ArchRecommendationRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: ARCH_ROWS, pagination: { total: ARCH_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<ArchAdvisorSummary> { return of(ARCH_SUMMARY).pipe(delay(400)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sustainability (A14)
// ─────────────────────────────────────────────────────────────────────────────
const SUSTAINABILITY_MOCK: SustainabilityDashboardData = {
  kpis: {
    totalCarbonKg:      { value: 284_620,  deltaPercent: -8.4,  deltaDirection: 'down', sparkline: sparks(310_000) },
    carbonPerTxn:       { value: 0.00674,  deltaPercent: -6.2,  deltaDirection: 'down', sparkline: sparks(0.0072) },
    greenOpportunities: { value: 12,       deltaPercent: 0,     deltaDirection: 'neutral', sparkline: sparks(12) },
    renewableEnergyPct: { value: 68.4,     deltaPercent: 3.8,   deltaDirection: 'up',  sparkline: sparks(65) },
  },
  carbonTrend: Array.from({ length: 12 }, (_, i) => ({
    period: new Date(2025, i, 1).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }),
    carbon: Math.round(310_000 - i * 2_100 + (Math.random() - 0.5) * 8_000),
  })),
  carbonBySource: [
    { label: 'AWS Cloud',       carbon: 98_400,  pct: 34.6 },
    { label: 'Azure Cloud',     carbon: 82_200,  pct: 28.9 },
    { label: 'GCP Cloud',       carbon: 44_800,  pct: 15.7 },
    { label: 'On-Premises DC',  carbon: 59_220,  pct: 20.8 },
  ],
  opportunities: [
    { opportunityId:'go-001', title:'Shift ML training to low-carbon window (02:00-06:00 UTC)', type:'Time Shift',          businessUnit:'AI Research',     currentCarbonKg:42_400, projectedReductionKg:11_872, reductionPct:28.0, costImpact:0,       currency:CUR, status:'Pending',    priority:'High' },
    { opportunityId:'go-002', title:'Migrate us-east-1 workloads to me-central-1 (lower grid intensity)', type:'Region Shift', businessUnit:'Digital Products', currentCarbonKg:18_600, projectedReductionKg:8_928,  reductionPct:48.0, costImpact:-4_200,  currency:CUR, status:'Approved',   priority:'High' },
    { opportunityId:'go-003', title:'Rightsize GPU cluster — idle hours emit 340 kgCO2/day',   type:'Instance Efficiency', businessUnit:'AI Research',     currentCarbonKg:124_100,projectedReductionKg:24_820, reductionPct:20.0, costImpact:-149_800,currency:CUR, status:'Pending',    priority:'Critical' },
    { opportunityId:'go-004', title:'Enable AWS GravitonRegional for analytics workloads',       type:'Instance Efficiency', businessUnit:'Analytics',       currentCarbonKg:8_200,  projectedReductionKg:2_050,  reductionPct:25.0, costImpact:-12_400, currency:CUR, status:'Pending',    priority:'Medium' },
    { opportunityId:'go-005', title:'Schedule dev environment shutdown (22:00-06:00)',           type:'Time Shift',          businessUnit:'Engineering',     currentCarbonKg:6_840,  projectedReductionKg:4_104,  reductionPct:60.0, costImpact:-84_200, currency:CUR, status:'Pending',    priority:'Medium' },
  ],
  narrative: {
    summary: 'Total carbon footprint is 284,620 kgCO2eq this period, down 8.4% from prior period. Renewable energy coverage is 68.4% (+3.8pp). The AI Research GPU cluster remains the largest single emission source (124,100 kgCO2eq). The highest-impact green opportunity is GPU rightsizing, which co-delivers both carbon reduction (20%) and cost savings (AED 150K).',
    agentId:'A14', agentName:'Sustainability Agent',
    generatedAt: new Date().toISOString(),
    highlights: [
      'Carbon footprint 284,620 kgCO2eq — down 8.4% (trending toward annual target)',
      'GPU cluster: 124,100 kgCO2eq — rightsizing removes 24,820 kg AND saves AED 150K',
      'Renewable energy 68.4% (+3.8pp) — region migration opportunity to reach 75%+',
      'Carbon-per-transaction AED 0.00674 — improved 6.2% MoM',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class SustainabilityService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<SustainabilityDashboardData>(`${environment.apiUrl}/optimize/sustainability/dashboard`, { params })
  getDashboard(range: SustainabilityTimeRange): Observable<SustainabilityDashboardData> {
    return of(SUSTAINABILITY_MOCK).pipe(delay(700));
  }
}
