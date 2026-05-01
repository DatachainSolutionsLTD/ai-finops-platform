// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/cost-explorer.types.ts

export type CostGranularity = 'daily' | 'weekly' | 'monthly';
export type CostTimeRange   = '7d' | '30d' | '90d' | 'QTD' | 'YTD' | '12m';
export type CostGroupBy     = 'provider' | 'service' | 'region' | 'environment' | 'business_unit' | 'application';
export type CostChargeType  = 'BilledCost' | 'EffectiveCost' | 'AmortizedCost';

export interface CostKpis {
  totalSpend:          { value: number; currency: string; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  forecastedSpend:     { value: number; currency: string; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  budgetUtilization:   { value: number;                  deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  optimizationSavings: { value: number; currency: string; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
}

export interface CostByDimensionItem {
  label:    string;
  amount:   number;
  currency: string;
  pct:      number;
}

export interface CostTopDriverRow {
  resourceId:   string;
  serviceName:  string;
  provider:     string;
  region:       string;
  businessUnit: string;
  amount:       number;
  currency:     string;
  mom:          number;  // month-over-month %
}

export interface CostExplorerDashboardData {
  kpis:        CostKpis;
  trendDates:  string[];
  trendSeries: Array<{ name: string; data: number[] }>;
  byProvider:  CostByDimensionItem[];
  byService:   CostByDimensionItem[];
  topDrivers:  CostTopDriverRow[];
  narrative: {
    summary: string; agentId: string; agentName: string;
    generatedAt: string; highlights: string[];
  };
}

export interface CostExplorerQuery {
  timeRange:    CostTimeRange;
  granularity:  CostGranularity;
  groupBy:      CostGroupBy;
  chargeType:   CostChargeType;
  provider?:    string[];
  businessUnit?: string[];
}

export const TIME_RANGE_OPTIONS: CostTimeRange[]  = ['7d', '30d', '90d', 'QTD', 'YTD', '12m'];
export const GRANULARITY_OPTIONS: CostGranularity[] = ['daily', 'weekly', 'monthly'];
export const GROUP_BY_OPTIONS: { value: CostGroupBy; label: string }[] = [
  { value: 'provider',      label: 'Cloud provider' },
  { value: 'service',       label: 'Service' },
  { value: 'region',        label: 'Region' },
  { value: 'environment',   label: 'Environment' },
  { value: 'business_unit', label: 'Business unit' },
  { value: 'application',   label: 'Application' },
];
export const CHARGE_TYPE_OPTIONS: { value: CostChargeType; label: string }[] = [
  { value: 'BilledCost',    label: 'Billed cost' },
  { value: 'EffectiveCost', label: 'Effective cost' },
  { value: 'AmortizedCost', label: 'Amortized cost' },
];
