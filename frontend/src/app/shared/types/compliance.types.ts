// FinOps Platform Design System v1.1 — Updated v2
// Severity4, KpiMetric, AgentNarrative, SlaStatus, DeltaDirection
// → now imported from '@shared/types/common.types' (see MIGRATION_GUIDE.md §2a)
// Local re-declarations of these types below should be removed and replaced with imports.
// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/compliance.types.ts
// Covers: AuditConsole, RetentionPolicies, LegalHolds, DSRRequests, ComplianceReports

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT CONSOLE  (au_audit_event)
// ═══════════════════════════════════════════════════════════════════════════

export type AuditEventCategory =
  | 'Authentication' | 'Authorization' | 'Data_Access' | 'Data_Modification'
  | 'Configuration_Change' | 'Agent_Action' | 'Policy_Evaluation'
  | 'Workflow_Transition' | 'Approval_Decision' | 'System_Event'
  | 'Security_Event' | 'Compliance_Event' | 'Financial_Transaction';

export type AuditEventOutcome = 'Success' | 'Failure' | 'Partial' | 'Blocked' | 'Error';
export type AuditActorType    = 'Human_User' | 'Agent' | 'Service_Account' | 'API_Key' | 'System' | 'External_System';

export interface AuditEventRow {
  auditEventId:     string;
  eventCategory:    AuditEventCategory;
  eventType:        string;
  eventOutcome:     AuditEventOutcome;
  actorType:        AuditActorType;
  actorDisplayName: string;
  targetEntityType: string | null;
  targetDisplayName:string | null;
  actionPerformed:  string;
  severity:         string;
  requiresReview:   boolean;
  clientIp:         string | null;
  occurredAt:       string;
}

export interface AuditConsoleSummary {
  totalToday:       number;
  failures:         number;
  securityEvents:   number;
  requiresReview:   number;
}

export const AUDIT_CATEGORY_OPTIONS: AuditEventCategory[] = ['Authentication','Authorization','Data_Access','Data_Modification','Configuration_Change','Agent_Action','Policy_Evaluation','Workflow_Transition','Approval_Decision','System_Event','Security_Event','Compliance_Event','Financial_Transaction'];
export const AUDIT_OUTCOME_OPTIONS:   AuditEventOutcome[] = ['Success','Failure','Partial','Blocked','Error'];
export const AUDIT_ACTOR_OPTIONS:     AuditActorType[]   = ['Human_User','Agent','Service_Account','API_Key','System','External_System'];

// ═══════════════════════════════════════════════════════════════════════════
// RETENTION POLICIES  (dl_retention_policy)
// ═══════════════════════════════════════════════════════════════════════════

export type DataCategory    = 'Operational_Data' | 'Cost_Data' | 'Metering_Data' | 'Billing_Data' | 'Audit_Log' | 'Agent_Reasoning' | 'User_Activity' | 'Notification_History' | 'Configuration_History' | 'Report_Output' | 'Personal_Data' | 'Financial_Records' | 'Communication_Content' | 'Telemetry_Metric';
export type RetentionAction = 'Delete_Hard' | 'Anonymize' | 'Archive_Cold_Storage' | 'Move_To_Slower_Tier' | 'Aggregate_And_Purge' | 'No_Action_Legal_Hold';
export type RetentionStatus = 'Active' | 'Draft' | 'Paused' | 'Archived';

export interface RetentionPolicyRow {
  policyId:          string;
  policyName:        string;
  dataCategory:      DataCategory;
  retentionDays:     number;
  retentionAction:   RetentionAction;
  status:            RetentionStatus;
  isRegulatory:      boolean;
  minRetentionDays:  number | null;   // regulatory minimum
  lastRunAt:         string | null;
  nextRunAt:         string | null;
  recordsAffected:   number;
  createdBy:         string;
  updatedAt:         string;
}

export interface RetentionSummary {
  total:     number;
  active:    number;
  draft:     number;
  regulatory:number;
}

export const DATA_CATEGORY_OPTIONS:    DataCategory[]    = ['Operational_Data','Cost_Data','Metering_Data','Billing_Data','Audit_Log','Agent_Reasoning','User_Activity','Notification_History','Configuration_History','Report_Output','Personal_Data','Financial_Records','Communication_Content','Telemetry_Metric'];
export const RETENTION_ACTION_OPTIONS: RetentionAction[] = ['Delete_Hard','Anonymize','Archive_Cold_Storage','Move_To_Slower_Tier','Aggregate_And_Purge','No_Action_Legal_Hold'];
export const RETENTION_STATUS_OPTIONS: RetentionStatus[] = ['Active','Draft','Paused','Archived'];

// ═══════════════════════════════════════════════════════════════════════════
// LEGAL HOLDS  (dl_legal_hold)
// ═══════════════════════════════════════════════════════════════════════════

export type LegalHoldStatus = 'Active' | 'Released' | 'Expired';

export interface LegalHoldRow {
  legalHoldId:          string;
  holdName:             string;
  holdReason:           string;
  holdCategory:         string | null;
  status:               LegalHoldStatus;
  externalCaseRef:      string | null;
  dataCategories:       DataCategory[];
  dateRangeStart:       string | null;
  dateRangeEnd:         string | null;
  affectedUserCount:    number;
  placedBy:             string;
  placedAt:             string;
  releasedBy:           string | null;
  releasedAt:           string | null;
  expiresAt:            string | null;
  blockedPolicies:      number;
}

export interface LegalHoldSummary {
  total:    number;
  active:   number;
  released: number;
  blocking: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DSR REQUESTS  (dsr_request)
// ═══════════════════════════════════════════════════════════════════════════

export type DsrRequestType   = 'Access_Request' | 'Erasure_Right_To_Be_Forgotten' | 'Rectification' | 'Portability' | 'Restriction_Of_Processing' | 'Objection_To_Processing' | 'Automated_Decision_Explanation' | 'Consent_Withdrawal';
export type DsrRequestStatus = 'Submitted' | 'Identity_Verification_Pending' | 'Identity_Verified' | 'In_Progress' | 'Pending_Legal_Review' | 'Completed' | 'Partially_Completed' | 'Rejected' | 'Withdrawn' | 'Overdue';

export interface DsrRequestRow {
  requestId:          string;
  requestNumber:      string;
  requestType:        DsrRequestType;
  status:             DsrRequestStatus;
  dataSubjectName:    string;
  dataSubjectEmail:   string;
  submittedAt:        string;
  deadlineAt:         string;    // 30 days from submission per seed config
  completedAt:        string | null;
  assignedTo:         string | null;
  isOverdue:          boolean;
  daysRemaining:      number | null;
  regulatoryBasis:    string;   // GDPR / PDPL / Both
}

export interface DsrSummary {
  total:      number;
  open:       number;
  overdue:    number;
  completed:  number;
  slaDays:    number;
}

export const DSR_TYPE_OPTIONS:   DsrRequestType[]   = ['Access_Request','Erasure_Right_To_Be_Forgotten','Rectification','Portability','Restriction_Of_Processing','Objection_To_Processing','Automated_Decision_Explanation','Consent_Withdrawal'];
export const DSR_STATUS_OPTIONS: DsrRequestStatus[] = ['Submitted','Identity_Verification_Pending','Identity_Verified','In_Progress','Pending_Legal_Review','Completed','Partially_Completed','Rejected','Withdrawn','Overdue'];

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE REPORTS  (report schedule + outputs)
// ═══════════════════════════════════════════════════════════════════════════

export type ReportFormat    = 'PDF' | 'CSV' | 'XLSX';
export type ReportSchedule  = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'On_Demand';
export type ReportStatus    = 'Scheduled' | 'Generating' | 'Ready' | 'Failed' | 'Expired';
export type ComplianceReportType =
  | 'Audit_Trail_Export' | 'GDPR_PDPL_Activity' | 'Data_Retention_Summary'
  | 'Legal_Hold_Inventory' | 'DSR_Processing_Report' | 'Access_Control_Review'
  | 'Agent_Action_Audit' | 'Governance_Compliance_Summary' | 'SOC2_Evidence_Pack';

export interface ComplianceReportRow {
  reportId:      string;
  reportName:    string;
  reportType:    ComplianceReportType;
  format:        ReportFormat;
  schedule:      ReportSchedule;
  status:        ReportStatus;
  periodStart:   string | null;
  periodEnd:     string | null;
  generatedAt:   string | null;
  expiresAt:     string | null;
  fileSizeKb:    number | null;
  createdBy:     string;
  downloadUrl:   string | null;
}

export interface ComplianceReportSummary {
  total:      number;
  ready:      number;
  generating: number;
  failed:     number;
}

export const REPORT_TYPE_OPTIONS: ComplianceReportType[] = ['Audit_Trail_Export','GDPR_PDPL_Activity','Data_Retention_Summary','Legal_Hold_Inventory','DSR_Processing_Report','Access_Control_Review','Agent_Action_Audit','Governance_Compliance_Summary','SOC2_Evidence_Pack'];
export const REPORT_SCHEDULE_OPTIONS: ReportSchedule[]  = ['Daily','Weekly','Monthly','Quarterly','On_Demand'];
