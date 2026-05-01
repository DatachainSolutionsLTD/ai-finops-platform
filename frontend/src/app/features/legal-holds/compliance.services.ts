// FinOps Platform Design System v1.1 — Updated v2
// Uses shared mock-data utilities: mockList, mockSummary, mockMutation, sparks, DEFAULT_CURRENCY
// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Consolidated services for Batch 9 — Compliance.

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import {
  type AuditEventRow,       type AuditConsoleSummary,
  type RetentionPolicyRow,  type RetentionSummary,
  type LegalHoldRow,        type LegalHoldSummary,
  type DsrRequestRow,       type DsrSummary,
  type ComplianceReportRow, type ComplianceReportSummary,
} from '@shared/types/compliance.types';
import { environment } from '@env/environment';
import { sparks, DEFAULT_CURRENCY, mockList, mockSummary, mockMutation } from '@lib/utils/mock-data.utils';

// ─────────────────────────────────────────────────────────────────────────────
// Audit Console
// ─────────────────────────────────────────────────────────────────────────────
const AUDIT_ROWS: AuditEventRow[] = [
  { auditEventId:'ae-001', eventCategory:'Authentication',      eventType:'User_Login_Success',              eventOutcome:'Success', actorType:'Human_User',      actorDisplayName:'Ahmed Hassan',    targetEntityType:'Session',           targetDisplayName:'Session #12841',          actionPerformed:'POST /v1/auth/login',        severity:'Informational', requiresReview:false, clientIp:'10.0.1.42',   occurredAt:'2026-04-13T08:00:00Z' },
  { auditEventId:'ae-002', eventCategory:'Approval_Decision',   eventType:'Recommendation_Approved',         eventOutcome:'Success', actorType:'Human_User',      actorDisplayName:'Ahmed Hassan',    targetEntityType:'Escalation_Record', targetDisplayName:'esc-002: AWS Savings Plan', actionPerformed:'POST /v1/approvals/esc-002/approve', severity:'Informational', requiresReview:false, clientIp:'10.0.1.42',   occurredAt:'2026-04-13T07:58:00Z' },
  { auditEventId:'ae-003', eventCategory:'Agent_Action',        eventType:'GPU_Rightsizing_Executed',        eventOutcome:'Success', actorType:'Agent',           actorDisplayName:'A16: GPU Optimizer',targetEntityType:'GPU_Cluster',       targetDisplayName:'gpu-cluster-01',          actionPerformed:'gpu_optimizer.execute_rightsize',severity:'Informational', requiresReview:false, clientIp:null,          occurredAt:'2026-04-13T07:45:00Z' },
  { auditEventId:'ae-004', eventCategory:'Security_Event',      eventType:'MFA_Bypass_Attempt',              eventOutcome:'Blocked', actorType:'Human_User',      actorDisplayName:'Unknown (Rami Yousef attempt)', targetEntityType:'Auth',  targetDisplayName:'MFA gate',           actionPerformed:'POST /v1/auth/mfa/verify',   severity:'High',          requiresReview:true,  clientIp:'185.234.12.4', occurredAt:'2026-04-13T07:30:00Z' },
  { auditEventId:'ae-005', eventCategory:'Configuration_Change',eventType:'Notification_Settings_Updated',   eventOutcome:'Success', actorType:'Human_User',      actorDisplayName:'Ahmed Hassan',    targetEntityType:'NotificationConfig',targetDisplayName:'Tenant notification config', actionPerformed:'PUT /v1/admin/notifications', severity:'Informational', requiresReview:false, clientIp:'10.0.1.42',   occurredAt:'2026-04-13T07:15:00Z' },
  { auditEventId:'ae-006', eventCategory:'Data_Access',         eventType:'Cost_Report_Exported',            eventOutcome:'Success', actorType:'Human_User',      actorDisplayName:'Fatima Jaber',    targetEntityType:'Report',            targetDisplayName:'Mar 2026 Chargeback Statement',actionPerformed:'GET /v1/reports/export',    severity:'Informational', requiresReview:false, clientIp:'10.0.2.18',   occurredAt:'2026-04-13T07:00:00Z' },
  { auditEventId:'ae-007', eventCategory:'Policy_Evaluation',   eventType:'Governance_Scan_Completed',       eventOutcome:'Success', actorType:'Agent',           actorDisplayName:'A20: Governance Agent',targetEntityType:'PolicyScan',   targetDisplayName:'All Resources',           actionPerformed:'governance_agent.run_scan',  severity:'Informational', requiresReview:false, clientIp:null,          occurredAt:'2026-04-13T06:00:00Z' },
  { auditEventId:'ae-008', eventCategory:'Authorization',       eventType:'Permission_Denied',               eventOutcome:'Failure', actorType:'Human_User',      actorDisplayName:'Khalid Nasser',   targetEntityType:'PlatformResource',  targetDisplayName:'Platform admin panel',     actionPerformed:'GET /v1/platform/tenants',  severity:'Medium',        requiresReview:false, clientIp:'10.0.3.99',   occurredAt:'2026-04-12T22:14:00Z' },
  { auditEventId:'ae-009', eventCategory:'Data_Modification',   eventType:'Tag_Auto_Applied',                eventOutcome:'Success', actorType:'Agent',           actorDisplayName:'A24: Tagging Hygiene',targetEntityType:'Resource',    targetDisplayName:'EC2 p4d.24xlarge (AI Research)', actionPerformed:'tagging_agent.auto_tag', severity:'Informational', requiresReview:false, clientIp:null,          occurredAt:'2026-04-12T21:00:00Z' },
  { auditEventId:'ae-010', eventCategory:'Financial_Transaction',eventType:'Chargeback_Statement_Distributed',eventOutcome:'Success', actorType:'Agent',          actorDisplayName:'A22: Chargeback Agent',targetEntityType:'ChargebackStatement',targetDisplayName:'cb-2026-04-001',      actionPerformed:'chargeback_agent.distribute', severity:'Informational', requiresReview:false, clientIp:null,         occurredAt:'2026-04-13T06:01:00Z' },
];
const AUDIT_SUMMARY: AuditConsoleSummary = { totalToday: 842, failures: 18, securityEvents: 3, requiresReview: 1 };

@Injectable({ providedIn: 'root' })
export class AuditConsoleService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/compliance/audit`, { params })
  list(q: Record<string, unknown>): Observable<{ data: AuditEventRow[]; pagination: { total: number; page: number; limit: number } }> {
    return mockList(AUDIT_ROWS);
  }
  summary(): Observable<AuditConsoleSummary> { return mockSummary(AUDIT_SUMMARY); }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/compliance/audit/export`, { format, dateRange })
  exportAudit(format: 'CSV' | 'PDF'): Observable<void> { return mockMutation(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Retention Policies
// ─────────────────────────────────────────────────────────────────────────────
const RETENTION_ROWS: RetentionPolicyRow[] = [
  { policyId:'ret-001', policyName:'Audit Log 7-Year Retention',        dataCategory:'Audit_Log',           retentionDays:2555, retentionAction:'Archive_Cold_Storage', status:'Active', isRegulatory:true, minRetentionDays:2555, lastRunAt:'2026-04-01T02:00:00Z', nextRunAt:'2026-05-01T02:00:00Z', recordsAffected:0,          createdBy:'System',          updatedAt:'2026-01-01T00:00:00Z' },
  { policyId:'ret-002', policyName:'Financial Records 7-Year',          dataCategory:'Financial_Records',   retentionDays:2555, retentionAction:'Archive_Cold_Storage', status:'Active', isRegulatory:true, minRetentionDays:2555, lastRunAt:'2026-04-01T02:00:00Z', nextRunAt:'2026-05-01T02:00:00Z', recordsAffected:0,          createdBy:'System',          updatedAt:'2026-01-01T00:00:00Z' },
  { policyId:'ret-003', policyName:'Cost Data 3-Year Retention',        dataCategory:'Cost_Data',           retentionDays:1095, retentionAction:'Move_To_Slower_Tier',  status:'Active', isRegulatory:false,minRetentionDays:null, lastRunAt:'2026-04-01T02:00:00Z', nextRunAt:'2026-05-01T02:00:00Z', recordsAffected:284_420,    createdBy:'Ahmed Hassan',    updatedAt:'2026-02-01T00:00:00Z' },
  { policyId:'ret-004', policyName:'Notification History 90-Day Purge', dataCategory:'Notification_History',retentionDays:90,   retentionAction:'Delete_Hard',         status:'Active', isRegulatory:false,minRetentionDays:null, lastRunAt:'2026-04-12T02:00:00Z', nextRunAt:'2026-04-13T02:00:00Z', recordsAffected:124_800,    createdBy:'Ahmed Hassan',    updatedAt:'2026-03-01T00:00:00Z' },
  { policyId:'ret-005', policyName:'Agent Reasoning 1-Year',            dataCategory:'Agent_Reasoning',     retentionDays:365,  retentionAction:'Anonymize',           status:'Active', isRegulatory:false,minRetentionDays:null, lastRunAt:'2026-04-01T02:00:00Z', nextRunAt:'2026-05-01T02:00:00Z', recordsAffected:48_200,     createdBy:'System',          updatedAt:'2026-01-01T00:00:00Z' },
  { policyId:'ret-006', policyName:'Personal Data PDPL Compliance',     dataCategory:'Personal_Data',       retentionDays:1825, retentionAction:'Delete_Hard',         status:'Active', isRegulatory:true, minRetentionDays:0,   lastRunAt:'2026-04-01T02:00:00Z', nextRunAt:'2026-07-01T02:00:00Z', recordsAffected:0,          createdBy:'System',          updatedAt:'2026-01-01T00:00:00Z' },
  { policyId:'ret-007', policyName:'Report Output 90-Day Expiry',       dataCategory:'Report_Output',       retentionDays:90,   retentionAction:'Delete_Hard',         status:'Active', isRegulatory:false,minRetentionDays:null, lastRunAt:'2026-04-12T02:00:00Z', nextRunAt:'2026-04-13T02:00:00Z', recordsAffected:8_420,      createdBy:'Ahmed Hassan',    updatedAt:'2026-03-01T00:00:00Z' },
  { policyId:'ret-008', policyName:'Telemetry Metrics 6-Month Roll-up', dataCategory:'Telemetry_Metric',    retentionDays:180,  retentionAction:'Aggregate_And_Purge', status:'Draft',  isRegulatory:false,minRetentionDays:null, lastRunAt:null,                    nextRunAt:null,                    recordsAffected:0,          createdBy:'Omar Khalid',     updatedAt:'2026-04-10T00:00:00Z' },
];
const RETENTION_SUMMARY: RetentionSummary = { total: 8, active: 7, draft: 1, regulatory: 3 };

@Injectable({ providedIn: 'root' })
export class RetentionPoliciesService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/compliance/retention`, { params })
  list(q: Record<string, unknown>): Observable<{ data: RetentionPolicyRow[]; pagination: { total: number; page: number; limit: number } }> {
    return mockList(RETENTION_ROWS);
  }
  summary(): Observable<RetentionSummary> { return mockSummary(RETENTION_SUMMARY); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legal Holds
// ─────────────────────────────────────────────────────────────────────────────
const LEGAL_HOLD_ROWS: LegalHoldRow[] = [
  { legalHoldId:'lh-001', holdName:'Q4 2025 Procurement Audit Hold',     holdReason:'External auditors require all financial transaction and billing records for Q4 2025 to be preserved for regulatory audit.',   holdCategory:'Regulatory_Audit', status:'Active',   externalCaseRef:'EXT-AUDIT-2025-Q4', dataCategories:['Financial_Records','Billing_Data'],           dateRangeStart:'2025-10-01', dateRangeEnd:'2025-12-31', affectedUserCount:0,  placedBy:'Ahmed Hassan',  placedAt:'2026-01-15T00:00:00Z', releasedBy:null,         releasedAt:null,                   expiresAt:'2026-07-15T00:00:00Z', blockedPolicies:2 },
  { legalHoldId:'lh-002', holdName:'AI Research Budget Dispute Hold',     holdReason:'Legal dispute filed by AI Research BU regarding Q1 2026 chargeback statement. All cost allocation records must be preserved.', holdCategory:'Legal_Dispute',    status:'Active',   externalCaseRef:'LEGAL-2026-0014',   dataCategories:['Cost_Data','Billing_Data','Audit_Log'],       dateRangeStart:'2026-01-01', dateRangeEnd:'2026-03-31', affectedUserCount:3,  placedBy:'Fatima Jaber',  placedAt:'2026-04-08T00:00:00Z', releasedBy:null,         releasedAt:null,                   expiresAt:null,                   blockedPolicies:3 },
  { legalHoldId:'lh-003', holdName:'PDPL Data Subject Access Hold',       holdReason:'Pending resolution of DSR-2026-0003 (erasure request). Hold prevents archival until request is fully actioned.',               holdCategory:'PDPL_DSR',         status:'Active',   externalCaseRef:'DSR-2026-0003',     dataCategories:['Personal_Data','User_Activity'],              dateRangeStart:null,         dateRangeEnd:null,         affectedUserCount:1,  placedBy:'System',        placedAt:'2026-04-02T00:00:00Z', releasedBy:null,         releasedAt:null,                   expiresAt:'2026-05-02T00:00:00Z', blockedPolicies:1 },
  { legalHoldId:'lh-004', holdName:'FY 2024 Annual Audit Hold',           holdReason:'Annual statutory audit of FY 2024 financial records. Released following audit completion.',                                    holdCategory:'Regulatory_Audit', status:'Released', externalCaseRef:'AUDIT-FY2024',      dataCategories:['Financial_Records','Audit_Log','Cost_Data'],  dateRangeStart:'2024-01-01', dateRangeEnd:'2024-12-31', affectedUserCount:0,  placedBy:'Ahmed Hassan',  placedAt:'2025-01-20T00:00:00Z', releasedBy:'Ahmed Hassan',releasedAt:'2025-10-15T00:00:00Z', expiresAt:null,                   blockedPolicies:0 },
];
const LEGAL_HOLD_SUMMARY: LegalHoldSummary = { total: 4, active: 3, released: 1, blocking: 6 };

@Injectable({ providedIn: 'root' })
export class LegalHoldsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/compliance/legal-holds`, { params })
  list(q: Record<string, unknown>): Observable<{ data: LegalHoldRow[]; pagination: { total: number; page: number; limit: number } }> {
    return mockList(LEGAL_HOLD_ROWS);
  }
  summary(): Observable<LegalHoldSummary> { return mockSummary(LEGAL_HOLD_SUMMARY); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DSR Requests
// ─────────────────────────────────────────────────────────────────────────────
const DSR_ROWS: DsrRequestRow[] = [
  { requestId:'dsr-001', requestNumber:'DSR-2026-0005', requestType:'Access_Request',              status:'In_Progress',             dataSubjectName:'Rami Yousef',   dataSubjectEmail:'rami.yousef@elm.sa',   submittedAt:'2026-04-08T10:00:00Z', deadlineAt:'2026-05-08T10:00:00Z', completedAt:null,                  assignedTo:'Mona Al-Hamad', isOverdue:false, daysRemaining:25, regulatoryBasis:'PDPL' },
  { requestId:'dsr-002', requestNumber:'DSR-2026-0004', requestType:'Rectification',               status:'Identity_Verified',       dataSubjectName:'Sara Ali',      dataSubjectEmail:'sara.ali@elm.sa',      submittedAt:'2026-04-06T09:00:00Z', deadlineAt:'2026-05-06T09:00:00Z', completedAt:null,                  assignedTo:'Mona Al-Hamad', isOverdue:false, daysRemaining:23, regulatoryBasis:'PDPL' },
  { requestId:'dsr-003', requestNumber:'DSR-2026-0003', requestType:'Erasure_Right_To_Be_Forgotten',status:'Pending_Legal_Review',   dataSubjectName:'Tariq Ibrahim', dataSubjectEmail:'tariq@external.com',   submittedAt:'2026-04-02T14:00:00Z', deadlineAt:'2026-05-02T14:00:00Z', completedAt:null,                  assignedTo:'Mona Al-Hamad', isOverdue:false, daysRemaining:19, regulatoryBasis:'GDPR / PDPL' },
  { requestId:'dsr-004', requestNumber:'DSR-2026-0002', requestType:'Portability',                  status:'Completed',              dataSubjectName:'Dana Karimi',   dataSubjectEmail:'dana@external.com',    submittedAt:'2026-03-15T11:00:00Z', deadlineAt:'2026-04-14T11:00:00Z', completedAt:'2026-04-10T16:00:00Z', assignedTo:'Mona Al-Hamad', isOverdue:false, daysRemaining:null,regulatoryBasis:'GDPR' },
  { requestId:'dsr-005', requestNumber:'DSR-2026-0001', requestType:'Automated_Decision_Explanation',status:'Overdue',              dataSubjectName:'External User', dataSubjectEmail:'user@external.com',    submittedAt:'2026-03-01T08:00:00Z', deadlineAt:'2026-03-31T08:00:00Z', completedAt:null,                  assignedTo:null,            isOverdue:true,  daysRemaining:-13,regulatoryBasis:'GDPR' },
];
const DSR_SUMMARY: DsrSummary = { total: 5, open: 4, overdue: 1, completed: 1, slaDays: 30 };

@Injectable({ providedIn: 'root' })
export class DsrRequestsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/compliance/dsr`, { params })
  list(q: Record<string, unknown>): Observable<{ data: DsrRequestRow[]; pagination: { total: number; page: number; limit: number } }> {
    return mockList(DSR_ROWS);
  }
  summary(): Observable<DsrSummary> { return mockSummary(DSR_SUMMARY); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compliance Reports
// ─────────────────────────────────────────────────────────────────────────────
const REPORT_ROWS: ComplianceReportRow[] = [
  { reportId:'cr-001', reportName:'Monthly Audit Trail — March 2026',      reportType:'Audit_Trail_Export',         format:'PDF',  schedule:'Monthly',   status:'Ready',      periodStart:'2026-03-01', periodEnd:'2026-03-31', generatedAt:'2026-04-01T06:00:00Z', expiresAt:'2026-07-01T06:00:00Z', fileSizeKb:2_840, createdBy:'System',       downloadUrl:'/reports/cr-001.pdf' },
  { reportId:'cr-002', reportName:'GDPR/PDPL Activity Report — Q1 2026',   reportType:'GDPR_PDPL_Activity',         format:'PDF',  schedule:'Quarterly', status:'Ready',      periodStart:'2026-01-01', periodEnd:'2026-03-31', generatedAt:'2026-04-02T06:00:00Z', expiresAt:'2026-10-02T06:00:00Z', fileSizeKb:1_240, createdBy:'System',       downloadUrl:'/reports/cr-002.pdf' },
  { reportId:'cr-003', reportName:'Data Retention Compliance Summary',      reportType:'Data_Retention_Summary',     format:'XLSX', schedule:'Monthly',   status:'Ready',      periodStart:'2026-03-01', periodEnd:'2026-03-31', generatedAt:'2026-04-01T06:00:00Z', expiresAt:'2026-07-01T06:00:00Z', fileSizeKb:420,   createdBy:'System',       downloadUrl:'/reports/cr-003.xlsx' },
  { reportId:'cr-004', reportName:'Legal Hold Inventory — April 2026',      reportType:'Legal_Hold_Inventory',       format:'PDF',  schedule:'Monthly',   status:'Ready',      periodStart:'2026-04-01', periodEnd:'2026-04-30', generatedAt:'2026-04-13T07:00:00Z', expiresAt:'2026-07-13T07:00:00Z', fileSizeKb:180,   createdBy:'System',       downloadUrl:'/reports/cr-004.pdf' },
  { reportId:'cr-005', reportName:'DSR Processing Report — Q1 2026',        reportType:'DSR_Processing_Report',      format:'PDF',  schedule:'Quarterly', status:'Ready',      periodStart:'2026-01-01', periodEnd:'2026-03-31', generatedAt:'2026-04-02T06:00:00Z', expiresAt:'2026-10-02T06:00:00Z', fileSizeKb:240,   createdBy:'Mona Al-Hamad',downloadUrl:'/reports/cr-005.pdf' },
  { reportId:'cr-006', reportName:'SOC2 Evidence Pack — FY 2025',           reportType:'SOC2_Evidence_Pack',         format:'PDF',  schedule:'On_Demand', status:'Ready',      periodStart:'2025-01-01', periodEnd:'2025-12-31', generatedAt:'2026-02-15T10:00:00Z', expiresAt:'2027-02-15T10:00:00Z', fileSizeKb:18_420,createdBy:'Ahmed Hassan', downloadUrl:'/reports/cr-006.pdf' },
  { reportId:'cr-007', reportName:'Monthly Audit Trail — April 2026',       reportType:'Audit_Trail_Export',         format:'PDF',  schedule:'Monthly',   status:'Generating', periodStart:'2026-04-01', periodEnd:'2026-04-13', generatedAt:null,                   expiresAt:null,                   fileSizeKb:null,  createdBy:'System',       downloadUrl:null },
  { reportId:'cr-008', reportName:'Governance Compliance Summary — Apr 26', reportType:'Governance_Compliance_Summary',format:'XLSX',schedule:'Monthly',  status:'Scheduled',  periodStart:'2026-04-01', periodEnd:'2026-04-30', generatedAt:null,                   expiresAt:null,                   fileSizeKb:null,  createdBy:'System',       downloadUrl:null },
];
const REPORT_SUMMARY: ComplianceReportSummary = { total: 8, ready: 6, generating: 1, failed: 0 };

@Injectable({ providedIn: 'root' })
export class ComplianceReportsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/compliance/reports`, { params })
  list(q: Record<string, unknown>): Observable<{ data: ComplianceReportRow[]; pagination: { total: number; page: number; limit: number } }> {
    return mockList(REPORT_ROWS);
  }
  summary(): Observable<ComplianceReportSummary> { return mockSummary(REPORT_SUMMARY); }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/compliance/reports/generate`, { type, period })
  generate(reportType: string): Observable<void> { return mockMutation(); }
}
