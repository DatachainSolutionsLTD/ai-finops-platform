// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Shared DTOs for Tenant Onboarding Wizard.
// Location: libs/shared/src/lib/types/onboarding.types.ts
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DataResidencyRegion,
  FiscalYearStart,
  Industry,
} from './organization.types';

// ── Step identifiers (order-sensitive) ──────────────────────────────────────
export type OnboardingStepId =
  | 'organization'
  | 'localization'
  | 'residency'
  | 'primary-admin'
  | 'integrations'
  | 'agent-defaults'
  | 'review';

export interface OnboardingStep {
  id: OnboardingStepId;
  order: number;
  title: string;
  description: string;
  icon: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'organization',   order: 1, title: 'Organization',      description: 'Legal name, tier, industry',                icon: 'business-outline' },
  { id: 'localization',   order: 2, title: 'Localization',      description: 'Currency, locale, timezone, fiscal year',   icon: 'globe-outline' },
  { id: 'residency',      order: 3, title: 'Data residency',    description: 'Region and compliance frameworks',          icon: 'shield-checkmark-outline' },
  { id: 'primary-admin',  order: 4, title: 'Primary admin',     description: 'First tenant administrator',                icon: 'person-outline' },
  { id: 'integrations',   order: 5, title: 'Integrations',      description: 'Cloud and SaaS connections (optional)',     icon: 'link-outline' },
  { id: 'agent-defaults', order: 6, title: 'Agent defaults',    description: 'Autonomy ceiling, approval SLA, automation', icon: 'hardware-chip-outline' },
  { id: 'review',         order: 7, title: 'Review & submit',   description: 'Confirm and provision tenant',              icon: 'checkmark-circle-outline' },
];

// ── Per-step form values ────────────────────────────────────────────────────
export interface OrganizationStepValue {
  legalName: string;
  displayName: string;
  tenantCode: string;                  // unique code, will be validated against backend
  tierCode: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  industry: Industry | null;
  websiteUrl: string | null;
  taxId: string | null;
}

export interface LocalizationStepValue {
  primaryCurrencyCode: string;
  primaryLocale: string;
  primaryTimezone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  fiscalYearStart: FiscalYearStart;
}

export interface ResidencyStepValue {
  dataResidencyRegion: DataResidencyRegion;
  gdprApplicable: boolean;
  pdplApplicable: boolean;
  hipaaApplicable: boolean;
  soxApplicable: boolean;
}

export interface PrimaryAdminStepValue {
  email: string;
  displayName: string;
  phone: string | null;
  sendInviteEmail: boolean;
  requireMfa: boolean;
}

export type IntegrationProvider =
  | 'AWS' | 'Azure' | 'GCP' | 'OCI'
  | 'Snowflake' | 'Databricks'
  | 'Salesforce' | 'ServiceNow'
  | 'Slack' | 'Teams' | 'Jira' | 'PagerDuty';

export interface IntegrationsStepValue {
  selectedProviders: IntegrationProvider[];
  skipForNow: boolean;                  // user can defer integration setup
}

export interface AgentDefaultsStepValue {
  agentAutonomyCeiling: 'L1_Suggest' | 'L2_Approve_To_Act' | 'L3_Act_With_Notify' | 'L4_Fully_Autonomous';
  defaultApprovalSla: number;           // hours
  anomalyAlertSensitivity: 'Low' | 'Medium' | 'High';
  autoRemediationEnabled: boolean;
}

// ── Full wizard state ───────────────────────────────────────────────────────
export interface OnboardingDraft {
  draftId: string;                      // UUID
  createdAt: string;
  updatedAt: string;
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  organization?:  Partial<OrganizationStepValue>;
  localization?:  Partial<LocalizationStepValue>;
  residency?:     Partial<ResidencyStepValue>;
  primaryAdmin?:  Partial<PrimaryAdminStepValue>;
  integrations?:  Partial<IntegrationsStepValue>;
  agentDefaults?: Partial<AgentDefaultsStepValue>;
}

// ── Submit / provisioning response ──────────────────────────────────────────
export interface OnboardingSubmitResponse {
  tenantId: string;
  tenantCode: string;
  provisioningJobId: string;
  estimatedCompletionSeconds: number;
  status: 'Provisioning' | 'Completed';
}

// ── Validation availability check ───────────────────────────────────────────
export interface TenantCodeAvailability {
  code: string;
  available: boolean;
  reason?: string;
  suggestions?: string[];
}
