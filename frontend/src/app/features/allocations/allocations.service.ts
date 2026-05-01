// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/understand/allocations/allocations.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type AllocationListRow, type AllocationListSummary } from '@shared/types/understand-lists.types';
import { environment } from '@env/environment';

const CUR = 'AED';

const MOCK_ROWS: AllocationListRow[] = [
  { allocationId:'al-001', ruleName:'AI Research Direct',          description:'Direct GPU costs to AI Research BU',                model:'Direct',       status:'Applied',   scope:'Cloud',       sourcePool:'GPU Compute Pool',   targetBu:'AI Research',     totalAmount:964_070,   currency:CUR, coverageRate:100,  billingPeriod:'2026-03', appliedAt:'2026-04-01T02:00:00Z', createdBy:'Ahmed Hassan', updatedAt:'2026-04-01T02:10:00Z' },
  { allocationId:'al-002', ruleName:'Shared Infra Proportional',   description:'Distribute shared infra by utilisation',            model:'Proportional', status:'Applied',   scope:'All',         sourcePool:'Shared Infra Pool',  targetBu:'All BUs',         totalAmount:1_240_000, currency:CUR, coverageRate:97.2, billingPeriod:'2026-03', appliedAt:'2026-04-01T02:05:00Z', createdBy:'Ahmed Hassan', updatedAt:'2026-04-01T02:15:00Z' },
  { allocationId:'al-003', ruleName:'Core Banking DB Direct',      description:'Allocate RDS Aurora costs to Core Banking',         model:'Direct',       status:'Applied',   scope:'Cloud',       sourcePool:'Database Pool',      targetBu:'Core Banking',    totalAmount:187_600,   currency:CUR, coverageRate:100,  billingPeriod:'2026-03', appliedAt:'2026-04-01T02:08:00Z', createdBy:'Sara Ali',    updatedAt:'2026-04-01T02:08:00Z' },
  { allocationId:'al-004', ruleName:'Network Egress Even Split',   description:'Split network egress evenly across cloud BUs',      model:'Even_Split',   status:'Applied',   scope:'Cloud',       sourcePool:'Network Pool',       targetBu:'All Cloud BUs',   totalAmount:337_420,   currency:CUR, coverageRate:100,  billingPeriod:'2026-03', appliedAt:'2026-04-01T02:12:00Z', createdBy:'Ahmed Hassan', updatedAt:'2026-04-01T02:12:00Z' },
  { allocationId:'al-005', ruleName:'Idle Capacity Tax',           description:'Apply idle capacity tax to over-provisioned VMs',   model:'Idle_Tax',     status:'Partial',   scope:'On-Premises', sourcePool:'On-Prem Compute',    targetBu:'Digital Products',totalAmount:128_400,   currency:CUR, coverageRate:72.4, billingPeriod:'2026-03', appliedAt:'2026-04-01T03:00:00Z', createdBy:'Omar Khalid', updatedAt:'2026-04-01T03:00:00Z' },
  { allocationId:'al-006', ruleName:'Risk Analytics Fixed Ratio',  description:'40% of analytics cluster to Risk Analytics BU',     model:'Fixed_Ratio',  status:'Applied',   scope:'Cloud',       sourcePool:'Analytics Cluster',  targetBu:'Risk Analytics',  totalAmount:212_100,   currency:CUR, coverageRate:100,  billingPeriod:'2026-03', appliedAt:'2026-04-01T02:20:00Z', createdBy:'Sara Ali',    updatedAt:'2026-04-01T02:20:00Z' },
  { allocationId:'al-007', ruleName:'Storage Proportional',        description:'Distribute blob/S3 costs by storage consumption',   model:'Proportional', status:'Pending',   scope:'Cloud',       sourcePool:'Storage Pool',       targetBu:'All BUs',         totalAmount:626_640,   currency:CUR, coverageRate:0,    billingPeriod:'2026-04', appliedAt:null, createdBy:'Ahmed Hassan', updatedAt:'2026-04-10T10:00:00Z' },
  { allocationId:'al-008', ruleName:'Digital Products Licensing',  description:'VMware licensing allocation to Digital Products',   model:'Direct',       status:'Failed',    scope:'On-Premises', sourcePool:'Licensing Pool',     targetBu:'Digital Products',totalAmount:143_000,   currency:CUR, coverageRate:0,    billingPeriod:'2026-03', appliedAt:null, createdBy:'Omar Khalid', updatedAt:'2026-04-02T08:00:00Z' },
];

const MOCK_SUMMARY: AllocationListSummary = {
  totalRules: 8, activeRules: 6, coverageRate: 94.8,
  unattributedCostPct: 5.2, totalAllocated: 3_839_230, currency: CUR,
};

@Injectable({ providedIn: 'root' })
export class AllocationsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/understand/allocations`, { params })
  list(query: Record<string, unknown>): Observable<{ data: AllocationListRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: MOCK_ROWS, pagination: { total: MOCK_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  summary(): Observable<AllocationListSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }
}
