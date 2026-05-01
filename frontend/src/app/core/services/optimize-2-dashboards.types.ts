// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/optimize-2-dashboards.types.ts
// Contains dashboard types for: GPU (A16), Container (A17), Network (A18), Storage (A19)

// ═══════════════════════════════════════════════════════════════════════════
// GPU OPTIMIZER  (Agent A16)
// ═══════════════════════════════════════════════════════════════════════════

export interface GpuKpis {
  avgCudaUtilPct:    { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  idleGpuCost:       { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  migEfficiency:     { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  savingsIdentified: { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
}

export type GpuNodeStatus = 'Active' | 'Idle' | 'OOM_Risk' | 'Degraded';
export type WorkloadClass  = 'Compute_Bound' | 'Memory_Bound' | 'IO_Bound' | 'Unclassified';

export interface GpuNodeRow {
  nodeId:          string;
  nodeName:        string;
  gpuModel:        string;
  cudaUtilPct:     number;
  vramUtilPct:     number;
  powerDrawW:      number;
  migEnabled:      boolean;
  workloadClass:   WorkloadClass | null;
  monthlyCostSar:  number;
  currency:        string;
  savingsSar:      number;
  status:          GpuNodeStatus;
}

export interface GpuTrendPoint        { period: string; cuda: number; vram: number; }
export interface WorkloadClassItem    { label: string; count: number; }

export interface GpuDashboardData {
  kpis:              GpuKpis;
  trendPoints:       GpuTrendPoint[];
  workloadDist:      WorkloadClassItem[];
  nodes:             GpuNodeRow[];
  narrative: { summary: string; agentId: string; agentName: string; generatedAt: string; highlights: string[] };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTAINER OPTIMIZER  (Agent A17)
// ═══════════════════════════════════════════════════════════════════════════

export interface ContainerKpis {
  totalContainerSpend:  { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  identifiedSavings:    { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  avgClusterScore:      { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  pendingRecs:          { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
}

export interface ClusterScoreRow {
  clusterId:      string;
  clusterName:    string;
  provider:       string;
  overallScore:   number;
  cpuScore:       number;
  memScore:       number;
  monthlyCost:    number;
  currency:       string;
  savingsSar:     number;
  pendingRecs:    number;
}

export interface SavingsPipelineItem { stage: string; amount: number; }
export interface PodRightsizingRow {
  namespace:     string;
  workload:      string;
  currentCpu:    string;
  recCpu:        string;
  currentMem:    string;
  recMem:        string;
  monthlySavings:number;
  currency:      string;
  confidence:    number;
  risk:          string;
}

export interface ContainerDashboardData {
  kpis:           ContainerKpis;
  clusterScores:  ClusterScoreRow[];
  savingsPipeline:SavingsPipelineItem[];
  podRightsizing: PodRightsizingRow[];
  narrative: { summary: string; agentId: string; agentName: string; generatedAt: string; highlights: string[] };
}

// ═══════════════════════════════════════════════════════════════════════════
// NETWORK OPTIMIZER  (Agent A18)
// ═══════════════════════════════════════════════════════════════════════════

export interface NetworkKpis {
  totalTransferCost:  { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  egressCost:         { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  optimizationOpp:    { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  activeAnomalies:    { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
}

export interface TransferByTypeItem   { label: string; cost: number; currency: string; }
export interface NetworkTrendPoint    { period: string; cost: number; }
export interface NetworkRecommendationRow {
  recommendationId: string;
  title:            string;
  type:             string;
  provider:         string;
  annualSavings:    number;
  currency:         string;
  complexity:       string;
  status:           string;
}

export interface NetworkDashboardData {
  kpis:            NetworkKpis;
  transferByType:  TransferByTypeItem[];
  trendPoints:     NetworkTrendPoint[];
  recommendations: NetworkRecommendationRow[];
  narrative: { summary: string; agentId: string; agentName: string; generatedAt: string; highlights: string[] };
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE OPTIMIZER  (Agent A19)
// ═══════════════════════════════════════════════════════════════════════════

export interface StorageKpis {
  totalStorageSpend: { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  storageWaste:      { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  orphanedResources: { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  tieringOpportunity:{ value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
}

export interface StorageTierPoint { period: string; hot: number; warm: number; cold: number; archive: number; }
export interface StorageRecRow {
  recommendationId: string;
  title:            string;
  type:             string;   // Tiering, Orphan_Cleanup, Snapshot, Volume_Rightsize
  provider:         string;
  resourceId:       string;
  monthlySavings:   number;
  currency:         string;
  risk:             string;
  confidence:       number;
  status:           string;
}

export interface StorageDashboardData {
  kpis:         StorageKpis;
  tierTrend:    StorageTierPoint[];
  recommendations: StorageRecRow[];
  narrative: { summary: string; agentId: string; agentName: string; generatedAt: string; highlights: string[] };
}
