// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/

// ═══════════════════════════════════════════════════════════════════════════
// ALLOCATIONS  (libs/shared/src/lib/types/allocations.types.ts)
// ═══════════════════════════════════════════════════════════════════════════
export type AllocationStatus      = 'Applied' | 'Pending' | 'Failed' | 'Partial' | 'Superseded';
export type AllocationModel       = 'Direct' | 'Proportional' | 'Fixed_Ratio' | 'Even_Split' | 'Idle_Tax';
export type AllocationScope       = 'Cloud' | 'On-Premises' | 'All';

export interface AllocationListRow {
  allocationId:   string;
  ruleName:       string;
  description:    string;
  model:          AllocationModel;
  status:         AllocationStatus;
  scope:          AllocationScope;
  sourcePool:     string;
  targetBu:       string;
  totalAmount:    number;
  currency:       string;
  coverageRate:   number;   // 0-100
  billingPeriod:  string;   // e.g. "2026-03"
  appliedAt:      string | null;
  createdBy:      string;
  updatedAt:      string;
}

export interface AllocationListSummary {
  totalRules:          number;
  activeRules:         number;
  coverageRate:        number;  // 0-100
  unattributedCostPct: number;  // 0-100
  totalAllocated:      number;
  currency:            string;
}

export type AllocationStatusOption = AllocationStatus;
export type AllocationModelOption  = AllocationModel;

export const ALLOCATION_STATUS_OPTIONS: AllocationStatus[] = ['Applied', 'Pending', 'Failed', 'Partial', 'Superseded'];
export const ALLOCATION_MODEL_OPTIONS:  AllocationModel[]  = ['Direct', 'Proportional', 'Fixed_Ratio', 'Even_Split', 'Idle_Tax'];

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS  (libs/shared/src/lib/types/reports.types.ts)
// ═══════════════════════════════════════════════════════════════════════════
export type ReportStatus   = 'Ready' | 'Generating' | 'Scheduled' | 'Failed' | 'Expired';
export type ReportCategory = 'Cost' | 'Allocation' | 'Compliance' | 'Anomaly' | 'Forecast' | 'Executive' | 'Custom';
export type ReportFormat   = 'PDF' | 'XLSX' | 'CSV';

export interface ReportListRow {
  reportId:      string;
  name:          string;
  description:   string;
  category:      ReportCategory;
  status:        ReportStatus;
  format:        ReportFormat;
  billingPeriod: string;
  generatedAt:   string | null;
  scheduledAt:   string | null;
  fileSize:      string | null;
  createdBy:     string;
  downloadUrl:   string | null;
}

export interface ReportListSummary {
  total:      number;
  ready:      number;
  scheduled:  number;
  generating: number;
}

export const REPORT_STATUS_OPTIONS:   ReportStatus[]   = ['Ready', 'Generating', 'Scheduled', 'Failed', 'Expired'];
export const REPORT_CATEGORY_OPTIONS: ReportCategory[] = ['Cost', 'Allocation', 'Compliance', 'Anomaly', 'Forecast', 'Executive', 'Custom'];

// ═══════════════════════════════════════════════════════════════════════════
// ANOMALIES  (libs/shared/src/lib/types/anomalies.types.ts)
// ═══════════════════════════════════════════════════════════════════════════
export type AnomalySeverity       = 'Critical' | 'Warning' | 'Informational';
export type AnomalyLifecycle      = 'New' | 'Acknowledged' | 'Investigating' | 'Resolved' | 'False_Positive' | 'Expected_Change';
export type AnomalyDetectionMethod = 'Statistical' | 'ML_Isolation_Forest' | 'ML_LSTM' | 'Rule_Based' | 'Manual';

export interface AnomalyListRow {
  anomalyId:       string;
  title:           string;
  provider:        string;
  serviceName:     string;
  businessUnit:    string;
  region:          string;
  severity:        AnomalySeverity;
  lifecycle:       AnomalyLifecycle;
  detectionMethod: AnomalyDetectionMethod;
  deviationAmount: number;
  deviationPct:    number;
  currency:        string;
  detectedAt:      string;
  acknowledgedAt:  string | null;
  resolvedAt:      string | null;
  assignedTo:      string | null;
}

export interface AnomalyListSummary {
  total:          number;
  critical:       number;
  warning:        number;
  informational:  number;
  unacknowledged: number;
}

export const ANOMALY_SEVERITY_OPTIONS:  AnomalySeverity[]        = ['Critical', 'Warning', 'Informational'];
export const ANOMALY_LIFECYCLE_OPTIONS: AnomalyLifecycle[]       = ['New', 'Acknowledged', 'Investigating', 'Resolved', 'False_Positive', 'Expected_Change'];
export const ANOMALY_PROVIDER_OPTIONS                            = ['AWS', 'Azure', 'GCP', 'OCI', 'On-Premises'];
