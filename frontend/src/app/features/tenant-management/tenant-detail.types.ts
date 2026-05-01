// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/tenant-detail.types.ts

export type TenantStatus       = 'Active' | 'Onboarding' | 'Suspended' | 'Archived' | 'Degraded';
export type TenantTierCode     = 'Starter' | 'Professional' | 'Enterprise' | 'Strategic';
export type BillingStatus      = 'Current' | 'Trial' | 'Grace_Period' | 'Overdue' | 'Pre_Paid';
export type DataResidencyRegion = 'me-central-1' | 'eu-west-1' | 'us-east-1' | 'ap-southeast-1';

export interface TenantDetail {
  tenantId:         string;
  tenantCode:       string;
  displayName:      string;
  legalName:        string;
  industry:         string;
  status:           TenantStatus;
  tierCode:         TenantTierCode;
  billingStatus:    BillingStatus;
  primaryCurrencyCode: string;
  dataResidencyRegion: DataResidencyRegion;
  onboardedAt:      string;        // ISO 8601
  subscriptionRenewsAt: string | null;

  // Contact
  billingContactEmail:    string;
  billingContactPhone:    string;
  technicalContactEmail:  string;
  technicalContactPhone:  string;

  // Quotas
  maxUsers:           number;
  maxConnectors:      number;
  storageQuotaGb:     number;
  fpQuotaMonthly:     number;        // Feature Points

  // Platform settings
  agentAutonomyCeiling: string;
  anomalyAlertSensitivity: string;
  autoRemediationEnabled: boolean;
  dataRetentionPeriod:  string;

  // Metadata
  spendThisMonth:    { amount: number; currency: string };
  userCount:         number;
  activeConnectors:  number;
  criticalAlerts:    number;
  lastActivityAt:    string;
  etag:              string;
}

export interface TenantDetailPatch {
  displayName?:           string;
  legalName?:             string;
  industry?:              string;
  status?:                TenantStatus;
  tierCode?:              TenantTierCode;
  billingStatus?:         BillingStatus;
  primaryCurrencyCode?:   string;
  dataResidencyRegion?:   DataResidencyRegion;
  subscriptionRenewsAt?:  string | null;
  billingContactEmail?:   string;
  billingContactPhone?:   string;
  technicalContactEmail?: string;
  technicalContactPhone?: string;
  maxUsers?:              number;
  maxConnectors?:         number;
  storageQuotaGb?:        number;
  fpQuotaMonthly?:        number;
  agentAutonomyCeiling?:  string;
  anomalyAlertSensitivity?: string;
  autoRemediationEnabled?:  boolean;
  dataRetentionPeriod?:   string;
}

export type TenantDetailTabId = 'overview' | 'contact' | 'quotas' | 'platform';

export const TENANT_STATUS_OPTIONS:   TenantStatus[]        = ['Active', 'Onboarding', 'Suspended', 'Archived', 'Degraded'];
export const TENANT_TIER_OPTIONS:     TenantTierCode[]      = ['Starter', 'Professional', 'Enterprise', 'Strategic'];
export const BILLING_STATUS_OPTIONS:  BillingStatus[]       = ['Current', 'Trial', 'Grace_Period', 'Overdue', 'Pre_Paid'];
export const DATA_RESIDENCY_OPTIONS:  DataResidencyRegion[] = ['me-central-1', 'eu-west-1', 'us-east-1', 'ap-southeast-1'];
export const AUTONOMY_OPTIONS                                = ['L1', 'L2', 'L3', 'L4'];
export const SENSITIVITY_OPTIONS                             = ['Low', 'Medium', 'High', 'Critical'];
export const RETENTION_OPTIONS                               = ['30d', '90d', '180d', '1y', '2y', '3y', '5y'];
