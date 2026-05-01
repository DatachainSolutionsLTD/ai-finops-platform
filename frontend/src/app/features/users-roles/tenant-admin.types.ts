// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/tenant-admin.types.ts
// Covers: UsersRoles, Integrations, FeatureFlags, Notifications, Billing, Support

// ═══════════════════════════════════════════════════════════════════════════
// USERS & ROLES
// ═══════════════════════════════════════════════════════════════════════════

export type TenantUserRole   = 'Tenant_Admin' | 'FinOps_Analyst' | 'Finance' | 'Engineering' | 'Executive_Viewer' | 'Auditor' | 'Read_Only';
export type TenantUserStatus = 'Active' | 'Invited' | 'Suspended' | 'Deactivated';
export type MfaStatus        = 'Enabled' | 'Disabled' | 'Enforced';

export interface TenantUserRow {
  userId:       string;
  fullName:     string;
  email:        string;
  role:         TenantUserRole;
  status:       TenantUserStatus;
  mfaStatus:    MfaStatus;
  lastLoginAt:  string | null;
  invitedAt:    string | null;
  createdAt:    string;
  businessUnit: string | null;
}

export interface UserListSummary {
  total:     number;
  active:    number;
  invited:   number;
  suspended: number;
  mfaEnabled:number;
}

export const TENANT_USER_ROLE_OPTIONS:   TenantUserRole[]   = ['Tenant_Admin','FinOps_Analyst','Finance','Engineering','Executive_Viewer','Auditor','Read_Only'];
export const TENANT_USER_STATUS_OPTIONS: TenantUserStatus[] = ['Active','Invited','Suspended','Deactivated'];

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════

export type IntegrationCategory = 'Cloud_Provider' | 'SaaS_Platform' | 'ITSM' | 'ERP_Finance' | 'Monitoring' | 'Identity' | 'Data_Warehouse' | 'CI_CD';
export type IntegrationStatus   = 'Connected' | 'Degraded' | 'Disconnected' | 'Pending' | 'Error';

export interface IntegrationRow {
  integrationId:  string;
  name:           string;
  provider:       string;
  category:       IntegrationCategory;
  status:         IntegrationStatus;
  lastSyncAt:     string | null;
  nextSyncAt:     string | null;
  syncFrequency:  string;
  recordsIngested:number;
  errorCount:     number;
  configuredBy:   string;
  connectedAt:    string;
}

export interface IntegrationSummary {
  total:       number;
  connected:   number;
  degraded:    number;
  disconnected:number;
  errors:      number;
}

export const INTEGRATION_CATEGORY_OPTIONS: IntegrationCategory[] = ['Cloud_Provider','SaaS_Platform','ITSM','ERP_Finance','Monitoring','Identity','Data_Warehouse','CI_CD'];
export const INTEGRATION_STATUS_OPTIONS:   IntegrationStatus[]   = ['Connected','Degraded','Disconnected','Pending','Error'];

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════════════

export type FlagType   = 'Boolean_Toggle' | 'Percentage_Rollout' | 'Tenant_Allowlist' | 'Kill_Switch' | 'Environment_Scoped' | 'Multi_Variant';
export type FlagStatus = 'Active' | 'Draft' | 'Paused' | 'Archived' | 'Deprecated';

export interface FeatureFlagRow {
  flagId:          string;
  flagKey:         string;
  displayName:     string;
  description:     string;
  flagType:        FlagType;
  status:          FlagStatus;
  isKillSwitch:    boolean;
  currentValue:    boolean | number | string;   // enabled/rollout%/variant
  rolloutPct:      number | null;
  ownerName:       string;
  tags:            string[];
  lastModifiedAt:  string;
  isPermanent:     boolean;
}

export interface FeatureFlagSummary {
  total:    number;
  active:   number;
  paused:   number;
  killSwitches: number;
}

export const FLAG_TYPE_OPTIONS:   FlagType[]   = ['Boolean_Toggle','Percentage_Rollout','Tenant_Allowlist','Kill_Switch','Environment_Scoped','Multi_Variant'];
export const FLAG_STATUS_OPTIONS: FlagStatus[] = ['Active','Draft','Paused','Archived','Deprecated'];

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS  (Detail/Edit — all channel configs for the tenant)
// ═══════════════════════════════════════════════════════════════════════════

export type NotificationChannel = 'Email' | 'Webhook' | 'Slack' | 'MS_Teams' | 'PagerDuty' | 'SMS';
export type NotificationEventType =
  | 'Budget_Alert_Warning' | 'Budget_Alert_Critical' | 'Budget_Breach'
  | 'Anomaly_Detected' | 'Anomaly_Confirmed'
  | 'Governance_Violation' | 'Governance_SLA_Breach'
  | 'Approval_Required' | 'Approval_Reminder'
  | 'Agent_Degraded' | 'Agent_Failed'
  | 'Chargeback_Ready' | 'Chargeback_Disputed'
  | 'Tag_Compliance_Alert' | 'Renewal_Alert';

export interface NotificationChannelConfig {
  channelId:   string;
  channel:     NotificationChannel;
  isEnabled:   boolean;
  destination: string;    // email addr, webhook URL, channel name, etc.
  events:      NotificationEventType[];
  minSeverity: 'Critical' | 'High' | 'Medium' | 'Low' | 'All';
  rateLimitPerHour: number;
  updatedAt:   string;
}

export interface NotificationSettings {
  tenantId:           string;
  globalEnabled:      boolean;
  quietHoursEnabled:  boolean;
  quietHoursStart:    string;   // HH:mm
  quietHoursEnd:      string;
  quietHoursDays:     number[]; // 0=Sun … 6=Sat
  channels:           NotificationChannelConfig[];
  updatedAt:          string;
  updatedBy:          string;
}

// ═══════════════════════════════════════════════════════════════════════════
// BILLING & SUBSCRIPTION  (Dashboard)
// ═══════════════════════════════════════════════════════════════════════════

export type BillingStatus = 'Current' | 'Trial' | 'Grace_Period' | 'Overdue' | 'Suspended';
export type SubscriptionTier = 'Starter' | 'Professional' | 'Enterprise';

export interface BillingKpis {
  currentMonthSpend:  { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  fpConsumed:         { value: number; quota: number; pct: number; sparkline: number[] };
  activeUsers:        { value: number; quota: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  daysToRenewal:      { value: number; sparkline: number[] };
}

export interface BillingUsagePoint { month: string; compute: number; storage: number; network: number; support: number; }
export interface BillingInvoiceRow {
  invoiceId:   string;
  period:      string;
  amount:      number;
  currency:    string;
  status:      string;
  dueDate:     string;
  paidDate:    string | null;
  downloadUrl: string | null;
}
export interface BillingDashboardData {
  tier:             SubscriptionTier;
  billingStatus:    BillingStatus;
  renewalDate:      string;
  kpis:             BillingKpis;
  usageTrend:       BillingUsagePoint[];
  invoices:         BillingInvoiceRow[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPORT CENTER
// ═══════════════════════════════════════════════════════════════════════════

export type CaseCategory = 'Technical_Issue' | 'Billing_Question' | 'Feature_Request' | 'Bug_Report' | 'Access_Request' | 'Integration_Help' | 'Other';
export type CaseStatus   = 'Open' | 'Pending_Customer' | 'In_Progress' | 'Waiting_On_Engineering' | 'Resolved' | 'Closed' | 'Reopened';
export type CasePriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface SupportCaseRow {
  caseId:       string;
  caseNumber:   string;
  title:        string;
  category:     CaseCategory;
  priority:     CasePriority;
  status:       CaseStatus;
  createdBy:    string;
  assignedTo:   string | null;
  createdAt:    string;
  updatedAt:    string;
  resolvedAt:   string | null;
  slaBreached:  boolean;
}

export interface SupportCaseSummary {
  total:     number;
  open:      number;
  inProgress:number;
  resolved:  number;
  breached:  number;
}

export const CASE_CATEGORY_OPTIONS: CaseCategory[] = ['Technical_Issue','Billing_Question','Feature_Request','Bug_Report','Access_Request','Integration_Help','Other'];
export const CASE_STATUS_OPTIONS:   CaseStatus[]   = ['Open','Pending_Customer','In_Progress','Waiting_On_Engineering','Resolved','Closed','Reopened'];
export const CASE_PRIORITY_OPTIONS: CasePriority[] = ['Critical','High','Medium','Low'];
