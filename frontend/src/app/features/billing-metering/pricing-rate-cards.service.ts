// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/platform/pricing/pricing-rate-cards.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import {
  type RateCardListQuery,
  type RateCardListResponse,
  type RateCardListSummary,
  type CreateRateCardDto,
} from '@shared/types/pricing-rate-cards.types';
import { environment } from '@env/environment';
import { formatCurrency } from '@lib/chart-defaults';

const MOCK: RateCardListResponse = {
  data: [
    { rateCardId:'rc-001', name:'Standard Compute',       description:'x86 vCPU on-premises compute rate',         resourceType:'Compute',    rate:0.14,  currency:'AED', pricingUnit:'vCPU-hour',      status:'Active',     effectiveFrom:'2025-01-01', effectiveTo:null,         version:3, tenantScope:'Platform',          createdBy:'Ahmed Hassan',  updatedAt:'2025-01-01T08:00:00Z' },
    { rateCardId:'rc-002', name:'Standard Memory',        description:'x86 memory rate per GB per hour',           resourceType:'Memory',     rate:0.018, currency:'AED', pricingUnit:'GB-hour',        status:'Active',     effectiveFrom:'2025-01-01', effectiveTo:null,         version:2, tenantScope:'Platform',          createdBy:'Ahmed Hassan',  updatedAt:'2025-01-01T08:00:00Z' },
    { rateCardId:'rc-003', name:'NVMe Storage',           description:'NVMe all-flash storage per GB per month',   resourceType:'Storage',    rate:0.042, currency:'AED', pricingUnit:'GB-month',       status:'Active',     effectiveFrom:'2025-01-01', effectiveTo:null,         version:1, tenantScope:'Platform',          createdBy:'Sara Ali',      updatedAt:'2025-01-01T08:00:00Z' },
    { rateCardId:'rc-004', name:'GPU H100 Standard',      description:'NVIDIA H100 80GB per GPU per hour',         resourceType:'GPU',        rate:12.50, currency:'AED', pricingUnit:'GPU-hour',       status:'Active',     effectiveFrom:'2025-01-01', effectiveTo:null,         version:1, tenantScope:'Platform',          createdBy:'Ahmed Hassan',  updatedAt:'2025-01-01T08:00:00Z' },
    { rateCardId:'rc-005', name:'GPU MIG Slice 3g.40gb',  description:'H100 MIG 3g.40gb slice rate',               resourceType:'GPU',        rate:6.25,  currency:'AED', pricingUnit:'MIG-slice-hour', status:'Active',     effectiveFrom:'2025-01-01', effectiveTo:null,         version:1, tenantScope:'Platform',          createdBy:'Ahmed Hassan',  updatedAt:'2025-01-01T08:00:00Z' },
    { rateCardId:'rc-006', name:'Network Egress',         description:'Outbound network bandwidth per Mbps/hr',    resourceType:'Network',    rate:0.006, currency:'AED', pricingUnit:'Mbps-hour',      status:'Active',     effectiveFrom:'2025-03-01', effectiveTo:null,         version:2, tenantScope:'Platform',          createdBy:'Sara Ali',      updatedAt:'2025-03-01T09:00:00Z' },
    { rateCardId:'rc-007', name:'Facilities Overhead',    description:'PUE-based power & cooling flat overhead',   resourceType:'Facilities', rate:0.15,  currency:'AED', pricingUnit:'flat-month',     status:'Active',     effectiveFrom:'2025-01-01', effectiveTo:null,         version:1, tenantScope:'Platform',          createdBy:'Ahmed Hassan',  updatedAt:'2025-01-01T08:00:00Z' },
    { rateCardId:'rc-008', name:'Premium Compute Q2',     description:'Updated compute rate effective Q2 2025',    resourceType:'Compute',    rate:0.16,  currency:'AED', pricingUnit:'vCPU-hour',      status:'Draft',      effectiveFrom:'2025-07-01', effectiveTo:null,         version:1, tenantScope:'Platform',          createdBy:'Sara Ali',      updatedAt:'2025-04-10T11:00:00Z' },
    { rateCardId:'rc-009', name:'Legacy HDD Storage',     description:'Spinning disk storage — being phased out',  resourceType:'Storage',    rate:0.008, currency:'AED', pricingUnit:'GB-month',       status:'Superseded', effectiveFrom:'2024-01-01', effectiveTo:'2024-12-31', version:4, tenantScope:'Platform',          createdBy:'Ahmed Hassan',  updatedAt:'2024-12-31T23:59:00Z' },
    { rateCardId:'rc-010', name:'VMware Licensing',       description:'vSphere per-core license allocation',       resourceType:'Licensing',  rate:0.032, currency:'AED', pricingUnit:'core-hour',      status:'Active',     effectiveFrom:'2025-01-01', effectiveTo:null,         version:2, tenantScope:'Platform',          createdBy:'Omar Khalid',   updatedAt:'2025-01-01T08:00:00Z' },
  ],
  pagination: { total: 10, page: 0, limit: 20 },
};

const MOCK_SUMMARY: RateCardListSummary = {
  totalRateCards:   10,
  activeRateCards:  8,
  draftRateCards:   1,
  pendingEffective: 1,
};

@Injectable({ providedIn: 'root' })
export class PricingRateCardsService {
  readonly #http = inject(HttpClient);

  // SWAP TO REAL: return this.#http.get<RateCardListResponse>(`${environment.apiUrl}/platform/pricing/rate-cards`, { params })
  list(query: RateCardListQuery): Observable<RateCardListResponse> {
    return of(MOCK).pipe(delay(600));
  }

  // SWAP TO REAL: return this.#http.get<RateCardListSummary>(`${environment.apiUrl}/platform/pricing/rate-cards/summary`)
  summary(): Observable<RateCardListSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }

  // SWAP TO REAL: return this.#http.post<RateCardListRow>(`${environment.apiUrl}/platform/pricing/rate-cards`, dto)
  create(dto: CreateRateCardDto): Observable<void> {
    return of(undefined as void).pipe(delay(800));
  }

  // SWAP TO REAL: return this.#http.patch<void>(`${environment.apiUrl}/platform/pricing/rate-cards/${id}/archive`, {})
  archive(id: string): Observable<void> {
    return of(undefined as void).pipe(delay(600));
  }
}
