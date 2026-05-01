// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/quantify/budgets/budgets.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type BudgetListRow, type BudgetListSummary } from '@shared/types/budgets.types';
import { environment } from '@env/environment';

const CUR = 'AED';
const MOCK_ROWS: BudgetListRow[] = [
  { budgetId:'bg-001', name:'AI Research Annual',         dimensionType:'Business_Unit', dimensionName:'AI Research',     status:'Active', health:'Over_Budget', periodType:'Annual',    billingPeriod:'2026', budgetAmount:12_000_000, actualSpend:4_820_340, forecastedSpend:13_920_000, currency:CUR, consumptionPct:40.2, variancePct:16.0, alertThreshold:80, lastAlertAt:'2026-04-12T10:00:00Z', ownedBy:'Ahmed Hassan',  updatedAt:'2026-04-12T10:00:00Z' },
  { budgetId:'bg-002', name:'Digital Products Q2',        dimensionType:'Business_Unit', dimensionName:'Digital Products',status:'Active', health:'At_Risk',     periodType:'Quarterly', billingPeriod:'2026-Q2', budgetAmount:1_800_000, actualSpend:820_400,   forecastedSpend:2_019_600,  currency:CUR, consumptionPct:45.6, variancePct:12.2, alertThreshold:75, lastAlertAt:'2026-04-13T08:00:00Z', ownedBy:'Omar Khalid',   updatedAt:'2026-04-13T08:00:00Z' },
  { budgetId:'bg-003', name:'AWS Monthly Budget',         dimensionType:'Provider',      dimensionName:'AWS',             status:'Active', health:'At_Risk',     periodType:'Monthly',   billingPeriod:'2026-04', budgetAmount:2_200_000, actualSpend:884_200,   forecastedSpend:2_420_000,  currency:CUR, consumptionPct:40.2, variancePct:10.0, alertThreshold:85, lastAlertAt:'2026-04-11T14:00:00Z', ownedBy:'System',        updatedAt:'2026-04-11T14:00:00Z' },
  { budgetId:'bg-004', name:'Azure Monthly Budget',       dimensionType:'Provider',      dimensionName:'Azure',           status:'Active', health:'On_Track',    periodType:'Monthly',   billingPeriod:'2026-04', budgetAmount:1_800_000, actualSpend:618_400,   forecastedSpend:1_680_000,  currency:CUR, consumptionPct:34.4, variancePct:-6.7, alertThreshold:85, lastAlertAt:null,                   ownedBy:'System',        updatedAt:'2026-04-01T00:00:00Z' },
  { budgetId:'bg-005', name:'Core Banking Annual',        dimensionType:'Business_Unit', dimensionName:'Core Banking',    status:'Active', health:'On_Track',    periodType:'Annual',    billingPeriod:'2026',    budgetAmount:4_200_000, actualSpend:1_340_200, forecastedSpend:4_020_000,  currency:CUR, consumptionPct:31.9, variancePct:-4.3, alertThreshold:80, lastAlertAt:null,                   ownedBy:'Sara Ali',      updatedAt:'2026-04-01T00:00:00Z' },
  { budgetId:'bg-006', name:'GCP Monthly Budget',         dimensionType:'Provider',      dimensionName:'GCP',             status:'Active', health:'On_Track',    periodType:'Monthly',   billingPeriod:'2026-04', budgetAmount:900_000,   actualSpend:328_400,   forecastedSpend:920_000,    currency:CUR, consumptionPct:36.5, variancePct:2.2,  alertThreshold:90, lastAlertAt:null,                   ownedBy:'System',        updatedAt:'2026-04-01T00:00:00Z' },
  { budgetId:'bg-007', name:'Risk Analytics Q2',          dimensionType:'Business_Unit', dimensionName:'Risk Analytics',  status:'Active', health:'On_Track',    periodType:'Quarterly', billingPeriod:'2026-Q2', budgetAmount:1_200_000, actualSpend:412_100,   forecastedSpend:1_148_000,  currency:CUR, consumptionPct:34.3, variancePct:-4.3, alertThreshold:80, lastAlertAt:null,                   ownedBy:'Fatima Jaber',  updatedAt:'2026-04-01T00:00:00Z' },
  { budgetId:'bg-008', name:'On-Premises Annual',         dimensionType:'Provider',      dimensionName:'On-Premises',     status:'Active', health:'On_Track',    periodType:'Annual',    billingPeriod:'2026',    budgetAmount:2_800_000, actualSpend:840_200,   forecastedSpend:2_480_000,  currency:CUR, consumptionPct:30.0, variancePct:-11.4,alertThreshold:80, lastAlertAt:null,                   ownedBy:'System',        updatedAt:'2026-04-01T00:00:00Z' },
  { budgetId:'bg-009', name:'Data Platform Q2',           dimensionType:'Business_Unit', dimensionName:'Data Platform',   status:'Draft',  health:'No_Spend',    periodType:'Quarterly', billingPeriod:'2026-Q2', budgetAmount:800_000,   actualSpend:0,         forecastedSpend:0,          currency:CUR, consumptionPct:0,    variancePct:0,    alertThreshold:80, lastAlertAt:null,                   ownedBy:'Omar Khalid',   updatedAt:'2026-04-08T14:00:00Z' },
];

const MOCK_SUMMARY: BudgetListSummary = { total: 9, onTrack: 5, atRisk: 2, overBudget: 1, totalBudgeted: 27_700_000, totalActual: 10_063_640, currency: CUR };

@Injectable({ providedIn: 'root' })
export class BudgetsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/quantify/budgets`, { params })
  list(query: Record<string, unknown>): Observable<{ data: BudgetListRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: MOCK_ROWS, pagination: { total: MOCK_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<BudgetListSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }
}
