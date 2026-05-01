// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/pricing-rate-cards.types.ts

export type RateCardStatus       = 'Active' | 'Draft' | 'Superseded' | 'Archived';
export type RateCardResourceType = 'Compute' | 'Memory' | 'Storage' | 'GPU' | 'Network' | 'Licensing' | 'Facilities' | 'Operations';
export type PricingUnit          = 'vCPU-hour' | 'GB-hour' | 'GB-month' | 'GPU-hour' | 'MIG-slice-hour' | 'Mbps-hour' | 'core-hour' | 'flat-month';

export interface RateCardListRow {
  rateCardId:    string;
  name:          string;
  description:   string;
  resourceType:  RateCardResourceType;
  rate:          number;            // numeric value
  currency:      string;            // e.g. 'AED'
  pricingUnit:   PricingUnit;
  status:        RateCardStatus;
  effectiveFrom: string;            // ISO date
  effectiveTo:   string | null;     // ISO date or null = open-ended
  version:       number;
  tenantScope:   'Platform' | 'Tenant-specific';
  createdBy:     string;
  updatedAt:     string;
}

export interface RateCardListQuery {
  search?:       string;
  status?:       RateCardStatus[];
  resourceType?: RateCardResourceType[];
  page?:         number;
  limit?:        number;
}

export interface RateCardListResponse {
  data:       RateCardListRow[];
  pagination: { total: number; page: number; limit: number };
}

export interface RateCardListSummary {
  totalRateCards:    number;
  activeRateCards:   number;
  draftRateCards:    number;
  pendingEffective:  number;  // cards with future effectiveFrom
}

export interface CreateRateCardDto {
  name:          string;
  description:   string;
  resourceType:  RateCardResourceType;
  rate:          number;
  currency:      string;
  pricingUnit:   PricingUnit;
  effectiveFrom: string;
  effectiveTo:   string | null;
}

export const RATE_CARD_STATUS_OPTIONS:        RateCardStatus[]       = ['Active', 'Draft', 'Superseded', 'Archived'];
export const RATE_CARD_RESOURCE_TYPE_OPTIONS: RateCardResourceType[] = ['Compute', 'Memory', 'Storage', 'GPU', 'Network', 'Licensing', 'Facilities', 'Operations'];
export const PRICING_UNIT_OPTIONS:            PricingUnit[]          = ['vCPU-hour', 'GB-hour', 'GB-month', 'GPU-hour', 'MIG-slice-hour', 'Mbps-hour', 'core-hour', 'flat-month'];
