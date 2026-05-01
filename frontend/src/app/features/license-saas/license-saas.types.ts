// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/license-saas.types.ts

export type LicenseType        = 'Perpetual' | 'Subscription' | 'Consumption' | 'SaaS_Seat' | 'BYOL' | 'Enterprise_Agreement';
export type LicenseCompliance  = 'Compliant' | 'Over_Deployed' | 'Under_Deployed' | 'True_Up_Risk' | 'Unknown';
export type LicenseGroup       = 'Quick_Win' | 'Strategic' | 'Housekeeping';

export interface LicenseEntitlementRow {
  entitlementId:   string;
  vendor:          string;
  product:         string;
  licenseType:     LicenseType;
  entitledQty:     number;
  deployedQty:     number;
  activeQty:       number;
  utilizationPct:  number;    // activeQty / entitledQty * 100
  complianceStatus:LicenseCompliance;
  contractEndDate: string | null;
  annualCostSar:   number;
  currency:        string;
  wasteAmount:     number;    // (entitledQty - activeQty) * unitCost
  renewalAlertDays:number | null;  // days until contract end
  byolEligible:    boolean;
  ahbApplied:      boolean;
  group:           LicenseGroup;
}

export interface LicenseSummary {
  totalLicenseSpend: number;
  totalSaasSpend:    number;
  totalWaste:        number;
  complianceScore:   number;    // 0-100
  pendingRecs:       number;
  currency:          string;
  ahbCoverageRate:   number;    // %
}

export const LICENSE_TYPE_OPTIONS:       LicenseType[]       = ['Perpetual','Subscription','Consumption','SaaS_Seat','BYOL','Enterprise_Agreement'];
export const LICENSE_COMPLIANCE_OPTIONS: LicenseCompliance[] = ['Compliant','Over_Deployed','Under_Deployed','True_Up_Risk','Unknown'];
export const LICENSE_GROUP_OPTIONS:      LicenseGroup[]      = ['Quick_Win','Strategic','Housekeeping'];
