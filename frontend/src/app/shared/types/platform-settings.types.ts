// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/platform-settings.types.ts

export type LogLevel         = 'debug' | 'info' | 'warn' | 'error';
export type MaintenanceMode  = 'Off' | 'Scheduled' | 'Active';
export type AutonomyCeiling  = 'L1' | 'L2' | 'L3' | 'L4';
export type DataRetentionPeriod = '30d' | '90d' | '180d' | '1y' | '2y' | '3y' | '5y';

export interface PlatformSettings {
  // Identity (read-only)
  platformId:         string;
  platformVersion:    string;
  deploymentRegion:   string;
  deployedAt:         string; // ISO 8601

  // General
  platformName:       string;
  platformUrl:        string;
  supportEmail:       string;
  maxTenantsAllowed:  number;

  // Agent defaults
  globalAutonomyCeiling: AutonomyCeiling;
  defaultRetryLimit:     number;
  defaultRetryBackoffSec: number;

  // Data & retention
  dataRetentionPeriod:   DataRetentionPeriod;
  enableAuditLog:        boolean;
  auditLogRetentionDays: number;

  // Security
  enforceGlobalMfa:          boolean;
  sessionTimeoutMinutes:     number;
  maxConcurrentSessionsPerUser: number;
  passwordMinLength:         number;
  allowedIpRanges:           string; // newline-separated CIDR

  // Notifications
  alertEmailEnabled:       boolean;
  alertEmailFrom:          string;
  alertWebhookUrl:         string;

  // Maintenance
  maintenanceMode:         MaintenanceMode;
  maintenanceMessage:      string;

  etag: string;
}

export interface PlatformSettingsPatch {
  platformName?:            string;
  platformUrl?:             string;
  supportEmail?:            string;
  maxTenantsAllowed?:       number;
  globalAutonomyCeiling?:   AutonomyCeiling;
  defaultRetryLimit?:       number;
  defaultRetryBackoffSec?:  number;
  dataRetentionPeriod?:     DataRetentionPeriod;
  enableAuditLog?:          boolean;
  auditLogRetentionDays?:   number;
  enforceGlobalMfa?:        boolean;
  sessionTimeoutMinutes?:   number;
  maxConcurrentSessionsPerUser?: number;
  passwordMinLength?:       number;
  allowedIpRanges?:         string;
  alertEmailEnabled?:       boolean;
  alertEmailFrom?:          string;
  alertWebhookUrl?:         string;
  maintenanceMode?:         MaintenanceMode;
  maintenanceMessage?:      string;
}

export type PlatformSettingsTabId = 'general' | 'agents' | 'data' | 'security' | 'notifications' | 'maintenance';

export const DATA_RETENTION_OPTIONS: DataRetentionPeriod[] = ['30d', '90d', '180d', '1y', '2y', '3y', '5y'];
export const AUTONOMY_CEILING_OPTIONS: AutonomyCeiling[]   = ['L1', 'L2', 'L3', 'L4'];
export const LOG_LEVEL_OPTIONS: LogLevel[]                 = ['debug', 'info', 'warn', 'error'];
export const MAINTENANCE_MODE_OPTIONS: MaintenanceMode[]   = ['Off', 'Scheduled', 'Active'];
