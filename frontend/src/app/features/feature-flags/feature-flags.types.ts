// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/feature-flags.types.ts

export type FeatureFlagStatus   = 'Enabled' | 'Disabled' | 'Partial';
export type FeatureFlagAudience = 'All' | 'Platform_Admin' | 'FinOps_Analyst' | 'Tenant_Admin' | 'Beta' | 'Internal';
export type FeatureFlagCategory = 'Agent' | 'UI' | 'API' | 'Billing' | 'Security' | 'Experimental';

export interface FeatureFlagRow {
  flagId:       string;
  key:          string;           // e.g. "agent.gpu_optimizer.enabled"
  name:         string;
  description:  string;
  category:     FeatureFlagCategory;
  enabled:      boolean;
  audience:     FeatureFlagAudience;
  rolloutPct:   number;           // 0-100 (for partial rollouts)
  updatedBy:    string;
  updatedAt:    string;           // ISO 8601
}

export interface FeatureFlagListQuery {
  search?:   string;
  category?: FeatureFlagCategory[];
  enabled?:  boolean;
  page?:     number;
  limit?:    number;
}

export interface FeatureFlagListResponse {
  data:       FeatureFlagRow[];
  pagination: { total: number; page: number; limit: number };
}

export interface FeatureFlagListSummary {
  total:    number;
  enabled:  number;
  disabled: number;
  partial:  number;
}

export const FEATURE_FLAG_CATEGORY_OPTIONS: FeatureFlagCategory[] = ['Agent', 'UI', 'API', 'Billing', 'Security', 'Experimental'];
