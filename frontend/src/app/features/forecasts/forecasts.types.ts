// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/forecasts.types.ts

export type ForecastHorizon    = '30d' | '90d' | '180d' | '12m';
export type ForecastTimeRange  = '30d' | '90d' | 'QTD' | 'YTD' | '12m';
export type ForecastDimension  = 'total' | 'provider' | 'business_unit' | 'application';
export type EarlyWarningSeverity = 'Critical' | 'Warning' | 'Informational';
export type EarlyWarningStatus   = 'Active' | 'Acknowledged' | 'Resolved';

export interface ForecastKpis {
  forecastedSpend:   { value: number; currency: string; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  forecastAccuracy:  { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };  // MAPE %
  earlyWarnings:     { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  budgetExhaustion:  { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };  // days until first breach
}

export interface ForecastTrendPoint {
  date:           string;
  actual:         number | null;  // null for future dates
  forecast:       number;
  confidenceLow:  number;
  confidenceHigh: number;
}

export interface ForecastByDimensionItem {
  label:         string;
  forecastAmount: number;
  currency:      string;
  budgetAmount:  number | null;
  variancePct:   number | null;
}

export interface EarlyWarningRow {
  warningId:       string;
  dimension:       string;
  dimensionType:   string;
  budgetAmount:    number;
  projectedSpend:  number;
  currency:        string;
  variancePct:     number;
  exhaustionDate:  string | null;
  severity:        EarlyWarningSeverity;
  status:          EarlyWarningStatus;
  updatedAt:       string;
}

export interface ForecastsDashboardData {
  kpis:            ForecastKpis;
  trendPoints:     ForecastTrendPoint[];
  byDimension:     ForecastByDimensionItem[];
  earlyWarnings:   EarlyWarningRow[];
  narrative: {
    summary: string; agentId: string; agentName: string;
    generatedAt: string; highlights: string[];
  };
}

export const FORECAST_HORIZON_OPTIONS: ForecastHorizon[]   = ['30d', '90d', '180d', '12m'];
export const FORECAST_DIMENSION_OPTIONS: { value: ForecastDimension; label: string }[] = [
  { value: 'total',         label: 'Total spend' },
  { value: 'provider',      label: 'By provider' },
  { value: 'business_unit', label: 'By business unit' },
  { value: 'application',   label: 'By application' },
];
