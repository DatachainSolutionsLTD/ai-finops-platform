// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/license-saas.types.ts

export type LicenseType        = 'Perpetual' | 'Subscription' | 'Consumption' | 'SaaS_Seat' | 'BYOL' | 'Enterprise_Agreement';
export type LicenseCompliance  = 'Compliant' | 'Over_Deployed' | 'Under_Deployed' | 'True_Up_Risk' | 'Unknown';
export type LicenseGroup       = 'Quick_Win' | 'Strategic' | 'Housekeeping';

export interface LicenseEntitlementRow {
  entitlementId?:   string;
  vendor?:          string;
  product?:         string;
  licenseType?:     any;
  entitledQty?:     number;
  deployedQty?:     number;
  activeQty?:       number;
  utilizationPct?:  number;
  complianceStatus?:any;
  contractEndDate?: string | null;
  annualCostSar?:   number;
  currency?:        string;
  wasteAmount?:     number;
  renewalAlertDays?:number | null;
  byolEligible?:    boolean;
  ahbApplied?:      boolean;
  group?:           any;
  licenseMetric?:   string;
  [key: string]:    any;
}

export interface LicenseSummary {
  totalLicenseSpend?: number;
  totalSaasSpend?:    number;
  totalWaste?:        number;
  complianceScore?:   number;    // 0-100
  pendingRecs?:       number;
  currency?:          string;
  ahbCoverageRate?:   number;    // %
  saasSpend?:        number;
  [key: string]:     any;
}

export const LICENSE_TYPE_OPTIONS:       LicenseType[]       = ['Perpetual','Subscription','Consumption','SaaS_Seat','BYOL','Enterprise_Agreement'];
export const LICENSE_COMPLIANCE_OPTIONS: LicenseCompliance[] = ['Compliant','Over_Deployed','Under_Deployed','True_Up_Risk','Unknown'];
export const LICENSE_GROUP_OPTIONS:      LicenseGroup[]      = ['Quick_Win','Strategic','Housekeeping'];
