// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/budgets.types.ts

export type BudgetStatus        = 'Active' | 'Draft' | 'Expired' | 'Archived';
export type BudgetHealth        = 'On_Track' | 'At_Risk' | 'Over_Budget' | 'No_Spend';
export type BudgetDimensionType = 'Business_Unit' | 'Application' | 'Project' | 'Provider' | 'Environment' | 'Cost_Center';
export type BudgetPeriodType    = 'Monthly' | 'Quarterly' | 'Annual';

export interface BudgetListRow {
  budgetId:        string;
  name:            string;
  dimensionType:   BudgetDimensionType;
  dimensionName:   string;
  status:          BudgetStatus;
  health:          BudgetHealth;
  periodType:      BudgetPeriodType;
  billingPeriod:   string;
  budgetAmount:    number;
  actualSpend:     number;
  forecastedSpend: number;
  currency:        string;
  consumptionPct:  number;   // actual / budget * 100
  variancePct:     number;   // (forecast - budget) / budget * 100
  alertThreshold:  number;   // % trigger for warning
  lastAlertAt:     string | null;
  ownedBy:         string;
  updatedAt:       string;
}

export interface BudgetListSummary {
  total:         number;
  onTrack:       number;
  atRisk:        number;
  overBudget:    number;
  totalBudgeted: number;
  totalActual:   number;
  currency:      string;
}

export const BUDGET_STATUS_OPTIONS:    BudgetStatus[]        = ['Active', 'Draft', 'Expired', 'Archived'];
export const BUDGET_HEALTH_OPTIONS:    BudgetHealth[]        = ['On_Track', 'At_Risk', 'Over_Budget', 'No_Spend'];
export const BUDGET_DIMENSION_OPTIONS: BudgetDimensionType[] = ['Business_Unit', 'Application', 'Project', 'Provider', 'Environment', 'Cost_Center'];
