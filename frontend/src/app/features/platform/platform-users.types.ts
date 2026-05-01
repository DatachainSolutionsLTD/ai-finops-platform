// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/platform-users.types.ts

export type PlatformUserStatus = 'Active' | 'Invited' | 'Suspended' | 'Deactivated';
export type PlatformUserRole   = 'Platform_Admin' | 'FinOps_Analyst' | 'Tenant_Admin' | 'Executive' | 'Read_Only';
export type MfaStatus          = 'Enabled' | 'Disabled' | 'Enforced';

export interface PlatformUserListRow {
  userId:        string;
  email:         string;
  displayName:   string;
  avatarInitials: string;
  role:          PlatformUserRole;
  status:        PlatformUserStatus;
  mfaStatus:     MfaStatus;
  tenantCount:   number;
  lastLoginAt:   string | null; // ISO 8601 UTC
  createdAt:     string;        // ISO 8601 UTC
}

export interface PlatformUserListQuery {
  search?:  string;
  status?:  PlatformUserStatus[];
  role?:    PlatformUserRole[];
  page?:    number;
  limit?:   number;
}

export interface PlatformUserListResponse {
  data:       PlatformUserListRow[];
  pagination: { total: number; page: number; limit: number };
}

export interface PlatformUserListSummary {
  totalUsers:      number;
  activeUsers:     number;
  pendingInvites:  number;
  suspendedUsers:  number;
  mfaAdoptionPct:  number; // 0-100
}

export interface CreatePlatformUserDto {
  email:       string;
  displayName: string;
  role:        PlatformUserRole;
}

export const ROLE_LABELS: Record<PlatformUserRole, string> = {
  Platform_Admin:  'Platform Admin',
  FinOps_Analyst:  'FinOps Analyst',
  Tenant_Admin:    'Tenant Admin',
  Executive:       'Executive',
  Read_Only:       'Read Only',
};

export const USER_STATUS_OPTIONS: PlatformUserStatus[] = ['Active', 'Invited', 'Suspended', 'Deactivated'];
export const USER_ROLE_OPTIONS:   PlatformUserRole[]   = ['Platform_Admin', 'FinOps_Analyst', 'Tenant_Admin', 'Executive', 'Read_Only'];
