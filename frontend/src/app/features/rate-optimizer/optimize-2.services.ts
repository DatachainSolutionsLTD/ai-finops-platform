// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Services for all 5 Batch 5 screens — each in its own @Injectable class.

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import {
  type LicenseEntitlementRow, type LicenseSummary,
} from '@shared/types/license-saas.types';
import {
  type GpuDashboardData,
  type ContainerDashboardData,
  type NetworkDashboardData,
  type StorageDashboardData,
} from '@shared/types/optimize-2-dashboards.types';
import { environment } from '@env/environment';

const CUR = 'AED';
function sp(base: number, n = 8): number[] { return Array.from({ length: n }, () => +(base + (Math.random() - 0.5) * base * 0.18).toFixed(0)); }

// ─────────────────────────────────────────────────────────────────────────────
// License & SaaS (A15)
// ─────────────────────────────────────────────────────────────────────────────
const LICENSE_ROWS: LicenseEntitlementRow[] = [
  { entitlementId:'lic-001', vendor:'Microsoft', product:'Microsoft 365 E5',      licenseType:'SaaS_Seat',          entitledQty:1800, deployedQty:1800, activeQty:1242, utilizationPct:69.0, complianceStatus:'Compliant',     contractEndDate:'2026-12-31', annualCostSar:5_940_000, currency:CUR, wasteAmount:184_800, renewalAlertDays:262, byolEligible:false, ahbApplied:false, group:'Quick_Win' },
  { entitlementId:'lic-002', vendor:'Microsoft', product:'Windows Server DC',     licenseType:'Perpetual',          entitledQty:240,  deployedQty:240,  activeQty:240,  utilizationPct:100,  complianceStatus:'True_Up_Risk',  contractEndDate:null,         annualCostSar:420_000,   currency:CUR, wasteAmount:0,       renewalAlertDays:null, byolEligible:true,  ahbApplied:false, group:'Strategic' },
  { entitlementId:'lic-003', vendor:'Microsoft', product:'Azure Hybrid Benefit',  licenseType:'BYOL',               entitledQty:180,  deployedQty:68,   activeQty:68,   utilizationPct:37.8, complianceStatus:'Under_Deployed',contractEndDate:null,         annualCostSar:0,         currency:CUR, wasteAmount:0,       renewalAlertDays:null, byolEligible:false, ahbApplied:true,  group:'Quick_Win' },
  { entitlementId:'lic-004', vendor:'Salesforce', product:'Sales Cloud Enterprise',licenseType:'SaaS_Seat',         entitledQty:320,  deployedQty:320,  activeQty:218,  utilizationPct:68.1, complianceStatus:'Compliant',     contractEndDate:'2027-01-31', annualCostSar:1_920_000, currency:CUR, wasteAmount:244_800, renewalAlertDays:293, byolEligible:false, ahbApplied:false, group:'Quick_Win' },
  { entitlementId:'lic-005', vendor:'ServiceNow', product:'ITSM Professional',    licenseType:'SaaS_Seat',          entitledQty:150,  deployedQty:150,  activeQty:124,  utilizationPct:82.7, complianceStatus:'Compliant',     contractEndDate:'2026-09-30', annualCostSar:840_000,   currency:CUR, wasteAmount:42_000,  renewalAlertDays:170, byolEligible:false, ahbApplied:false, group:'Housekeeping' },
  { entitlementId:'lic-006', vendor:'Snowflake',  product:'Enterprise Edition',   licenseType:'Consumption',        entitledQty:500,  deployedQty:480,  activeQty:480,  utilizationPct:96.0, complianceStatus:'Compliant',     contractEndDate:'2026-11-30', annualCostSar:2_400_000, currency:CUR, wasteAmount:0,       renewalAlertDays:231, byolEligible:false, ahbApplied:false, group:'Strategic' },
  { entitlementId:'lic-007', vendor:'Oracle',     product:'Database EE',          licenseType:'Perpetual',          entitledQty:32,   deployedQty:38,   activeQty:38,   utilizationPct:118.8,complianceStatus:'Over_Deployed', contractEndDate:null,         annualCostSar:3_840_000, currency:CUR, wasteAmount:0,       renewalAlertDays:null, byolEligible:false, ahbApplied:false, group:'Strategic' },
  { entitlementId:'lic-008', vendor:'Red Hat',    product:'RHEL Server Premium',  licenseType:'Subscription',       entitledQty:400,  deployedQty:284,  activeQty:284,  utilizationPct:71.0, complianceStatus:'Compliant',     contractEndDate:'2026-06-30', annualCostSar:720_000,   currency:CUR, wasteAmount:57_600,  renewalAlertDays:78,  byolEligible:true,  ahbApplied:false, group:'Quick_Win' },
  { entitlementId:'lic-009', vendor:'Slack',      product:'Pro Plan',             licenseType:'SaaS_Seat',          entitledQty:2000, deployedQty:2000, activeQty:1640, utilizationPct:82.0, complianceStatus:'Compliant',     contractEndDate:'2026-10-31', annualCostSar:580_000,   currency:CUR, wasteAmount:63_800,  renewalAlertDays:201, byolEligible:false, ahbApplied:false, group:'Housekeeping' },
  { entitlementId:'lic-010', vendor:'Databricks', product:'Premium (DBU)',        licenseType:'Consumption',        entitledQty:10000,deployedQty:8420, activeQty:8420, utilizationPct:84.2, complianceStatus:'Compliant',     contractEndDate:'2027-03-31', annualCostSar:1_840_000, currency:CUR, wasteAmount:0,       renewalAlertDays:352, byolEligible:false, ahbApplied:false, group:'Strategic' },
];
const LICENSE_SUMMARY: LicenseSummary = { totalLicenseSpend: 7_020_000, totalSaasSpend: 11_480_000, totalWaste: 593_000, complianceScore: 82, pendingRecs: 6, currency: CUR, ahbCoverageRate: 37.8 };

@Injectable({ providedIn: 'root' })
export class LicenseSaasService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/optimize/licenses`, { params })
  list(query: Record<string, unknown>): Observable<{ data: LicenseEntitlementRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: LICENSE_ROWS, pagination: { total: LICENSE_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<LicenseSummary> { return of(LICENSE_SUMMARY).pipe(delay(400)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GPU Optimizer (A16)
// ─────────────────────────────────────────────────────────────────────────────
const GPU_MOCK: GpuDashboardData = {
  kpis: {
    avgCudaUtilPct:    { value: 47.2, deltaPercent: 8.4,  deltaDirection: 'up',   sparkline: sp(44) },
    idleGpuCost:       { value: 284_600, currency: CUR, deltaPercent: -12.4, deltaDirection: 'down', sparkline: sp(325_000) },
    migEfficiency:     { value: 68.4, deltaPercent: 4.8,  deltaDirection: 'up',   sparkline: sp(65) },
    savingsIdentified: { value: 498_200, currency: CUR, deltaPercent: 18.2, deltaDirection: 'up', sparkline: sp(420_000) },
  },
  trendPoints: Array.from({ length: 14 }, (_, i) => ({
    period: new Date(2026, 2, 31 - 13 + i).toLocaleDateString('en-AE', { day:'2-digit', month:'short' }),
    cuda:   Math.round(42 + Math.sin(i / 2.5) * 12 + Math.random() * 8),
    vram:   Math.round(58 + Math.cos(i / 3) * 10 + Math.random() * 6),
  })),
  workloadDist: [
    { label: 'Compute-Bound',  count: 18 },
    { label: 'Memory-Bound',   count: 14 },
    { label: 'I/O-Bound',      count: 6 },
    { label: 'Unclassified',   count: 4 },
  ],
  nodes: [
    { nodeId:'gpu-001', nodeName:'gpu-prod-h100-01', gpuModel:'NVIDIA H100 80GB', cudaUtilPct:82.4, vramUtilPct:71.2, powerDrawW:420, migEnabled:true,  workloadClass:'Compute_Bound', monthlyCostSar:48_400, currency:CUR, savingsSar:0,       status:'Active' },
    { nodeId:'gpu-002', nodeName:'gpu-prod-h100-02', gpuModel:'NVIDIA H100 80GB', cudaUtilPct:91.2, vramUtilPct:88.4, powerDrawW:512, migEnabled:true,  workloadClass:'Memory_Bound',  monthlyCostSar:48_400, currency:CUR, savingsSar:0,       status:'OOM_Risk' },
    { nodeId:'gpu-003', nodeName:'gpu-prod-a100-01', gpuModel:'NVIDIA A100 40GB', cudaUtilPct:38.4, vramUtilPct:44.2, powerDrawW:280, migEnabled:false, workloadClass:'Compute_Bound', monthlyCostSar:28_200, currency:CUR, savingsSar:149_800, status:'Active' },
    { nodeId:'gpu-004', nodeName:'gpu-prod-a100-02', gpuModel:'NVIDIA A100 40GB', cudaUtilPct:12.8, vramUtilPct:18.6, powerDrawW:180, migEnabled:false, workloadClass:'Unclassified',  monthlyCostSar:28_200, currency:CUR, savingsSar:28_200,  status:'Idle' },
    { nodeId:'gpu-005', nodeName:'gpu-dev-l40-01',   gpuModel:'NVIDIA L40 48GB',  cudaUtilPct:2.1,  vramUtilPct:4.8,  powerDrawW:80,  migEnabled:false, workloadClass:'Unclassified',  monthlyCostSar:14_800, currency:CUR, savingsSar:14_800,  status:'Idle' },
  ],
  narrative: {
    summary: 'GPU fleet averages 47.2% CUDA utilisation (+8.4%). Idle GPU cost is AED 285K — AI Research A100 cluster running at <15% CUDA qualifies for immediate rightsizing (AED 150K annual saving). MIG efficiency at 68.4%; H100-02 vRAM is at 88.4% — OOM risk requires attention. Total identified savings: AED 498K.',
    agentId:'A16', agentName:'GPU Optimizer Agent', generatedAt: new Date().toISOString(),
    highlights: [
      'gpu-prod-a100-01 at 38% CUDA — rightsize to L40, save AED 150K/yr',
      'gpu-prod-h100-02 vRAM at 88.4% — OOM risk, remediation required',
      '2 idle GPU nodes wasting AED 43K/month — schedule or decommission',
      'MIG efficiency 68.4% — H100 MIG reconfiguration can improve to 85%+',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class GpuOptimizerService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<GpuDashboardData>(`${environment.apiUrl}/optimize/gpu/dashboard`)
  getDashboard(): Observable<GpuDashboardData> { return of(GPU_MOCK).pipe(delay(700)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Container Optimizer (A17)
// ─────────────────────────────────────────────────────────────────────────────
const CONTAINER_MOCK: ContainerDashboardData = {
  kpis: {
    totalContainerSpend: { value: 2_184_000, currency: CUR, deltaPercent: 6.2,  deltaDirection: 'up',  sparkline: sp(2_060_000) },
    identifiedSavings:   { value: 484_200,  currency: CUR, deltaPercent: 14.8, deltaDirection: 'up',  sparkline: sp(420_000) },
    avgClusterScore:     { value: 64,        deltaPercent: 4.2,  deltaDirection: 'up',  sparkline: sp(62) },
    pendingRecs:         { value: 28,        deltaPercent: -12,  deltaDirection: 'down', sparkline: sp(32) },
  },
  clusterScores: [
    { clusterId:'cl-001', clusterName:'prod-k8s-aws',   provider:'AWS',   overallScore:72, cpuScore:68, memScore:76, monthlyCost:840_000, currency:CUR, savingsSar:168_000, pendingRecs:12 },
    { clusterId:'cl-002', clusterName:'prod-aks-azure',  provider:'Azure', overallScore:61, cpuScore:54, memScore:68, monthlyCost:640_000, currency:CUR, savingsSar:192_000, pendingRecs:10 },
    { clusterId:'cl-003', clusterName:'dev-k8s-gcp',    provider:'GCP',   overallScore:48, cpuScore:42, memScore:54, monthlyCost:420_000, currency:CUR, savingsSar:94_200,  pendingRecs:6 },
    { clusterId:'cl-004', clusterName:'prod-openshift',  provider:'On-Prem',overallScore:80, cpuScore:78, memScore:82,monthlyCost:284_000, currency:CUR, savingsSar:30_000,  pendingRecs:0 },
  ],
  savingsPipeline: [
    { stage: 'Identified', amount: 484_200 },
    { stage: 'Approved',   amount: 248_000 },
    { stage: 'Executed',   amount: 182_000 },
    { stage: 'Realized',   amount: 164_400 },
  ],
  podRightsizing: [
    { namespace:'analytics', workload:'spark-driver',    currentCpu:'8',   recCpu:'4',   currentMem:'32Gi', recMem:'16Gi', monthlySavings:28_400, currency:CUR, confidence:91, risk:'Low' },
    { namespace:'analytics', workload:'spark-executor',  currentCpu:'4',   recCpu:'2',   currentMem:'16Gi', recMem:'8Gi',  monthlySavings:24_200, currency:CUR, confidence:88, risk:'Low' },
    { namespace:'ml-ops',    workload:'feature-store',   currentCpu:'16',  recCpu:'8',   currentMem:'64Gi', recMem:'32Gi', monthlySavings:42_800, currency:CUR, confidence:85, risk:'Medium' },
    { namespace:'digital',   workload:'api-gateway',     currentCpu:'2',   recCpu:'1',   currentMem:'4Gi',  recMem:'2Gi',  monthlySavings:8_400,  currency:CUR, confidence:94, risk:'Low' },
    { namespace:'risk',      workload:'scoring-engine',  currentCpu:'8',   recCpu:'6',   currentMem:'32Gi', recMem:'24Gi', monthlySavings:14_200, currency:CUR, confidence:82, risk:'Medium' },
  ],
  narrative: {
    summary: 'Container fleet spend is AED 2.18M/month with AED 484K in identified savings. Average cluster optimization score is 64/100 — dev-k8s-gcp scores 48 due to significant CPU/memory over-provisioning in ML workloads. Realized savings are AED 164K (34% of identified). 28 pending rightsizing recommendations await approval.',
    agentId:'A17', agentName:'Container & Serverless Optimizer', generatedAt: new Date().toISOString(),
    highlights: [
      'AED 484K identified savings — analytics namespace biggest opportunity (AED 53K)',
      'dev-k8s-gcp cluster score 48/100 — ML workload over-provisioning driving waste',
      'Savings pipeline 34% realized rate — accelerate approvals to increase realization',
      '28 pending recommendations — 18 are Low Risk and can be bulk-approved',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class ContainerOptimizerService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<ContainerDashboardData>(`${environment.apiUrl}/optimize/containers/dashboard`)
  getDashboard(): Observable<ContainerDashboardData> { return of(CONTAINER_MOCK).pipe(delay(700)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Optimizer (A18)
// ─────────────────────────────────────────────────────────────────────────────
const NETWORK_MOCK: NetworkDashboardData = {
  kpis: {
    totalTransferCost: { value: 842_400, currency: CUR, deltaPercent: 12.8, deltaDirection: 'up',  sparkline: sp(748_000) },
    egressCost:        { value: 484_200, currency: CUR, deltaPercent: 18.4, deltaDirection: 'up',  sparkline: sp(408_000) },
    optimizationOpp:   { value: 284_600, currency: CUR, deltaPercent: 24.2, deltaDirection: 'up',  sparkline: sp(228_000) },
    activeAnomalies:   { value: 2,        deltaPercent: 0,    deltaDirection: 'neutral', sparkline: sp(2) },
  },
  transferByType: [
    { label: 'Internet Egress',    cost: 484_200, currency: CUR },
    { label: 'Inter-Region',       cost: 168_400, currency: CUR },
    { label: 'NAT Gateway',        cost: 92_600,  currency: CUR },
    { label: 'VPN / Interconnect', cost: 64_800,  currency: CUR },
    { label: 'CDN',                cost: 32_400,  currency: CUR },
  ],
  trendPoints: Array.from({ length: 6 }, (_, i) => ({
    period: new Date(2025, 10 + i, 1).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }),
    cost:   Math.round(640_000 + i * 34_000 + (Math.random() - 0.5) * 20_000),
  })),
  recommendations: [
    { recommendationId:'nr-001', title:'Replace NAT Gateway with VPC Endpoints (S3, DynamoDB)',  type:'NAT Optimization',    provider:'AWS',   annualSavings:148_800, currency:CUR, complexity:'Low',    status:'Pending' },
    { recommendationId:'nr-002', title:'Enable CloudFront for Digital Products API responses',   type:'CDN Optimization',    provider:'AWS',   annualSavings:84_000,  currency:CUR, complexity:'Medium', status:'Pending' },
    { recommendationId:'nr-003', title:'Consolidate 3 Azure regions → UAE North',               type:'Region Consolidation', provider:'Azure', annualSavings:124_200, currency:CUR, complexity:'High',   status:'Approved' },
    { recommendationId:'nr-004', title:'Reduce inter-zone traffic via service mesh locality',    type:'Traffic Routing',     provider:'GCP',   annualSavings:42_400,  currency:CUR, complexity:'Medium', status:'Pending' },
    { recommendationId:'nr-005', title:'Rightsize ExpressRoute circuit (1Gbps → 500Mbps)',      type:'Connectivity',        provider:'Azure', annualSavings:48_000,  currency:CUR, complexity:'Low',    status:'Pending' },
  ],
  narrative: {
    summary: 'Total data transfer cost is AED 842K/month (+12.8%), with internet egress being the largest category at AED 484K (57.5%). The highest-value optimization is NAT Gateway → VPC Endpoint migration (AED 149K/yr). Two active transfer anomalies are under investigation. Total optimization opportunity: AED 285K annual.',
    agentId:'A18', agentName:'Data Transfer & Network Optimizer', generatedAt: new Date().toISOString(),
    highlights: [
      'Total transfer cost AED 842K/mo (+12.8%) — growing 2× overall cloud spend growth rate',
      'NAT Gateway AED 93K/mo — VPC Endpoint migration saves AED 149K/yr, Low complexity',
      '2 active egress anomalies under investigation — AI Research bucket unexpectedly uploading to EU',
      'Azure region consolidation approved — AED 124K/yr saving in implementation',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class NetworkOptimizerService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<NetworkDashboardData>(`${environment.apiUrl}/optimize/network/dashboard`)
  getDashboard(): Observable<NetworkDashboardData> { return of(NETWORK_MOCK).pipe(delay(700)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Optimizer (A19)
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_MOCK: StorageDashboardData = {
  kpis: {
    totalStorageSpend: { value: 1_284_000, currency: CUR, deltaPercent: 8.4,  deltaDirection: 'up',  sparkline: sp(1_184_000) },
    storageWaste:      { value: 342_000,   currency: CUR, deltaPercent: -4.2, deltaDirection: 'down', sparkline: sp(357_000) },
    orphanedResources: { value: 34,         deltaPercent: 18,  deltaDirection: 'up',  sparkline: sp(29) },
    tieringOpportunity:{ value: 284_800,   currency: CUR, deltaPercent: 12.8, deltaDirection: 'up',  sparkline: sp(252_000) },
  },
  tierTrend: Array.from({ length: 6 }, (_, i) => ({
    period: new Date(2025, 10 + i, 1).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }),
    hot:    Math.round(620_000 + i * 8_000 + (Math.random() - 0.5) * 12_000),
    warm:   Math.round(280_000 + i * 4_000 + (Math.random() - 0.5) * 8_000),
    cold:   Math.round(180_000 - i * 2_000 + (Math.random() - 0.5) * 6_000),
    archive:Math.round(80_000 - i * 1_000 + (Math.random() - 0.5) * 4_000),
  })),
  recommendations: [
    { recommendationId:'sr-001', title:'Move 84TB rarely-accessed S3 objects to Infrequent Access',          type:'Tiering',         provider:'AWS',   resourceId:'s3-data-lake-01',  monthlySavings:42_800,  currency:CUR, risk:'Low',    confidence:96, status:'Pending' },
    { recommendationId:'sr-002', title:'Archive 23TB backup data older than 90 days to Glacier',             type:'Tiering',         provider:'AWS',   resourceId:'s3-backup-01',     monthlySavings:28_400,  currency:CUR, risk:'Low',    confidence:94, status:'Approved' },
    { recommendationId:'sr-003', title:'Delete 23 orphaned EBS volumes (unattached >30 days)',               type:'Orphan_Cleanup',  provider:'AWS',   resourceId:'ebs-grp-orphaned', monthlySavings:18_240,  currency:CUR, risk:'Low',    confidence:99, status:'Pending' },
    { recommendationId:'sr-004', title:'Rightsize 8 io2 EBS volumes → gp3 (over-provisioned IOPS)',         type:'Volume_Rightsize', provider:'AWS',   resourceId:'ebs-grp-io2',     monthlySavings:24_600,  currency:CUR, risk:'Medium', confidence:88, status:'Pending' },
    { recommendationId:'sr-005', title:'Enable S3 Intelligent-Tiering on mixed-access buckets (6 buckets)', type:'Tiering',         provider:'AWS',   resourceId:'s3-mixed-access',  monthlySavings:16_800,  currency:CUR, risk:'Low',    confidence:92, status:'Pending' },
    { recommendationId:'sr-006', title:'Move Azure Blob cool-eligible data (18TB) to Cool tier',            type:'Tiering',         provider:'Azure', resourceId:'blob-analytics',   monthlySavings:12_400,  currency:CUR, risk:'Low',    confidence:89, status:'Pending' },
    { recommendationId:'sr-007', title:'Delete 11 orphaned Azure Managed Disks (unattached >14 days)',      type:'Orphan_Cleanup',  provider:'Azure', resourceId:'disk-orphaned',    monthlySavings:8_240,   currency:CUR, risk:'Low',    confidence:98, status:'Pending' },
    { recommendationId:'sr-008', title:'Reduce GCP snapshot retention from 365d to 90d (non-regulated)',    type:'Snapshot',        provider:'GCP',   resourceId:'snap-prod-cluster',monthlySavings:6_400,   currency:CUR, risk:'Medium', confidence:84, status:'Pending' },
  ],
  narrative: {
    summary: 'Total storage spend is AED 1.28M/month (+8.4%), with AED 342K in identified waste. Tiering opportunity is AED 285K annually — 84TB of S3 data has not been accessed in >30 days and qualifies for Infrequent Access. 34 orphaned volumes and disks are wasting AED 26K/month. Snapshot retention reduction can recover AED 77K/year.',
    agentId:'A19', agentName:'Storage Optimizer Agent', generatedAt: new Date().toISOString(),
    highlights: [
      'AED 342K storage waste identified — 84TB S3 cold data top opportunity (AED 43K/mo)',
      '34 orphaned volumes — AED 26K/month, Low Risk, approvals outstanding',
      'S3 Intelligent-Tiering on 6 mixed-access buckets — AED 17K/mo, no manual lifecycle rules needed',
      'Snapshot retention 365→90d saves AED 77K/yr — compliance validation already passed',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class StorageOptimizerService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<StorageDashboardData>(`${environment.apiUrl}/optimize/storage/dashboard`)
  getDashboard(): Observable<StorageDashboardData> { return of(STORAGE_MOCK).pipe(delay(700)); }
}
