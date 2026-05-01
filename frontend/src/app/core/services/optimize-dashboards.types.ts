// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/optimize-dashboards.types.ts
// Contains types for: WorkloadOptimizer, RateOptimizer, Sustainability dashboards
// and ArchitectureAdvisor list.

// ═══════════════════════════════════════════════════════════════════════════
// WORKLOAD OPTIMIZER DASHBOARD  (Agent A11)
// ═══════════════════════════════════════════════════════════════════════════

export type WorkloadOptTimeRange = '7d' | '30d' | '90d';

export interface WorkloadKpis {
  totalOpportunities:   { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  pendingSavings:       { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  realizedSavings:      { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  avgConfidence:        { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
}

export interface WorkloadOpportunitySummary {
  type:            string;
  count:           number;
  totalSavings:    number;
  currency:        string;
  avgConfidence:   number;
}

export interface WorkloadSavingsTrendPoint { period: string; projected: number; realized: number; }

export interface WorkloadResourceRow {
  resourceId:      string;
  resourceName:    string;
  resourceType:    string;
  provider:        string;
  environment:     string;
  businessUnit:    string;
  optimizationType:string;
  currentMonthlyCost: number;
  savingsAmount:   number;
  currency:        string;
  confidenceScore: number;
  status:          string;
}

export interface WorkloadDashboardData {
  kpis:             WorkloadKpis;
  opportunityBreakdown: WorkloadOpportunitySummary[];
  savingsTrend:     WorkloadSavingsTrendPoint[];
  topResources:     WorkloadResourceRow[];
  narrative: { summary: string; agentId: string; agentName: string; generatedAt: string; highlights: string[] };
}

// ═══════════════════════════════════════════════════════════════════════════
// RATE OPTIMIZER DASHBOARD  (Agent A12)
// ═══════════════════════════════════════════════════════════════════════════

export type RateOptTimeRange = '30d' | '90d' | '12m';

export interface RateKpis {
  coverageRate:      { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  pendingSavings:    { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  expiringSoon:      { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  underUtilized:     { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
}

export interface CommitmentPortfolioItem {
  provider:     string;
  type:         string;   // RI, SP, CUD
  utilization:  number;
  totalCost:    number;
  currency:     string;
  savings:      number;
  expiresInDays:number | null;
}

export interface RateSavingsPoint { period: string; projected: number; realized: number; }

export interface RateRecommendationRow {
  recommendationId: string;
  title:            string;
  provider:         string;
  instrument:       string;
  annualSavings:    number;
  currency:         string;
  breakEvenMonths:  number;
  risk:             string;
  status:           string;
}

export interface RateDashboardData {
  kpis:               RateKpis;
  portfolioByProvider: CommitmentPortfolioItem[];
  savingsTrend:       RateSavingsPoint[];
  recommendations:    RateRecommendationRow[];
  narrative: { summary: string; agentId: string; agentName: string; generatedAt: string; highlights: string[] };
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHITECTURE ADVISOR LIST  (Agent A13)
// ═══════════════════════════════════════════════════════════════════════════

export type ArchRecStatus   = 'Open' | 'Under_Review' | 'Approved' | 'In_Progress' | 'Completed' | 'Rejected';
export type ArchRecType     = 'Containerization' | 'Serverless_Migration' | 'Managed_Service' | 'Region_Consolidation' | 'Multi_Cloud_Exit' | 'Right_Architecture' | 'IaC_Modernization';
export type ArchRecPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ArchRecommendationRow {
  recommendationId: string;
  title:            string;
  type:             ArchRecType;
  priority:         ArchRecPriority;
  status:           ArchRecStatus;
  application:      string;
  businessUnit:     string;
  provider:         string;
  monthlySavings:   number;
  migrationCost:    number;
  currency:         string;
  paybackMonths:    number;
  complexityScore:  number;   // 1-10
  confidenceScore:  number;   // 0-100
  createdAt:        string;
  assignedTo:       string | null;
}

export interface ArchAdvisorSummary {
  total:           number;
  open:            number;
  totalSavings:    number;
  currency:        string;
  inProgress:      number;
}

export const ARCH_STATUS_OPTIONS:   ArchRecStatus[]   = ['Open','Under_Review','Approved','In_Progress','Completed','Rejected'];
export const ARCH_TYPE_OPTIONS:     ArchRecType[]     = ['Containerization','Serverless_Migration','Managed_Service','Region_Consolidation','Multi_Cloud_Exit','Right_Architecture','IaC_Modernization'];
export const ARCH_PRIORITY_OPTIONS: ArchRecPriority[] = ['Critical','High','Medium','Low'];

// ═══════════════════════════════════════════════════════════════════════════
// SUSTAINABILITY DASHBOARD  (Agent A14)
// ═══════════════════════════════════════════════════════════════════════════

export type SustainabilityTimeRange = '30d' | '90d' | '6m' | '12m';

export interface SustainabilityKpis {
  totalCarbonKg:     { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  carbonPerTxn:      { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  greenOpportunities:{ value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  renewableEnergyPct:{ value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
}

export interface CarbonTrendPoint    { period: string; carbon: number; }
export interface CarbonBySourceItem  { label: string; carbon: number; pct: number; }
export interface GreenOpportunityRow {
  opportunityId:   string;
  title:           string;
  type:            string;
  businessUnit:    string;
  currentCarbonKg: number;
  projectedReductionKg: number;
  reductionPct:    number;
  costImpact:      number;    // positive = cost increase, negative = cost saving
  currency:        string;
  status:          string;
  priority:        string;
}

export interface SustainabilityDashboardData {
  kpis:            SustainabilityKpis;
  carbonTrend:     CarbonTrendPoint[];
  carbonBySource:  CarbonBySourceItem[];
  opportunities:   GreenOpportunityRow[];
  narrative: { summary: string; agentId: string; agentName: string; generatedAt: string; highlights: string[] };
}
