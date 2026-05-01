// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/quantify-dashboards.types.ts
// Contains: BenchmarkingDashboardData + UnitEconomicsDashboardData

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARKING  (Agent A08)
// ═══════════════════════════════════════════════════════════════════════════

export type BenchmarkDeviationSeverity = 'Critical' | 'Warning' | 'Advisory' | 'On_Target';
export type BenchmarkTimeRange         = '30d' | '90d' | '6m' | '12m';

export interface BenchmarkKpis {
  aboveBenchmarkDimensions: { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  avgDeviationPct:          { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  optimizationOpportunity:  { value: number; currency: string; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  improvementVelocity:      { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };  // % improvement per month
}

export interface EfficiencyRatioItem {
  metric:         string;  // e.g. "Cost per vCPU-hour"
  actual:         number;
  benchmark:      number;
  unit:           string;
  currency:       string;
  deviationPct:   number;
  severity:       BenchmarkDeviationSeverity;
}

export interface BenchmarkTrendPoint {
  period:      string;
  avgDeviation: number;
}

export interface AboveBenchmarkRow {
  dimension:       string;
  dimensionType:   string;
  metric:          string;
  actualValue:     number;
  benchmarkValue:  number;
  currency:        string;
  deviationPct:    number;
  severity:        BenchmarkDeviationSeverity;
  estSavings:      number;
  linkedActions:   number;
}

export interface BenchmarkingDashboardData {
  kpis:              BenchmarkKpis;
  efficiencyRatios:  EfficiencyRatioItem[];
  trendPoints:       BenchmarkTrendPoint[];
  aboveBenchmark:    AboveBenchmarkRow[];
  narrative: {
    summary: string; agentId: string; agentName: string;
    generatedAt: string; highlights: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIT ECONOMICS  (Agent A09)
// ═══════════════════════════════════════════════════════════════════════════

export type EfficiencyRating  = 'Excellent' | 'Good' | 'Needs_Attention' | 'Critical';
export type UETimeRange       = '30d' | '90d' | '6m' | '12m';

export interface UnitEconomicsKpis {
  avgCpt:          { value: number; currency: string; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  totalTransactions:{ value: number;                  deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  avgCes:          { value: number;                  deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  criticalApps:    { value: number;                  deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
}

export interface CptTrendPoint {
  date: string;
  cpt:  number;
}

export interface EfficiencyLeaderboardRow {
  rank:       number;
  appName:    string;
  businessUnit: string;
  currentCpt: number;
  currency:   string;
  momChange:  number;
  ces:        number;
  rating:     EfficiencyRating;
  transactions: number;
}

export interface CptHeatmapCell {
  rowLabel: string;  // BU
  colLabel: string;  // Environment
  cpt:      number;
  currency: string;
}

export interface UnitEconomicsDashboardData {
  kpis:        UnitEconomicsKpis;
  cptTrend:    CptTrendPoint[];
  leaderboard: EfficiencyLeaderboardRow[];
  heatmapData: CptHeatmapCell[];
  narrative: {
    summary: string; agentId: string; agentName: string;
    generatedAt: string; highlights: string[];
  };
}
