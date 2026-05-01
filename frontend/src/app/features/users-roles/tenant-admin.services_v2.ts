// FinOps Platform Design System v1.1 — Updated v2
// Uses shared mock-data utilities: mockList, mockSummary, mockMutation, sparks, DEFAULT_CURRENCY
// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Consolidated services for Batch 8 — Tenant Admin.

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import {
  type TenantUserRow,       type UserListSummary,
  type IntegrationRow,      type IntegrationSummary,
  type FeatureFlagRow,      type FeatureFlagSummary,
  type NotificationSettings,
  type BillingDashboardData,
  type SupportCaseRow,      type SupportCaseSummary,
} from '@shared/types/tenant-admin.types';
import { environment } from '@env/environment';
import { sparks, DEFAULT_CURRENCY, mockList, mockSummary, mockMutation } from '@lib/utils/mock-data.utils';

function sparks(b: number) { return Array.from({ length: 8 }, () => Math.round(b + (Math.random() - 0.5) * b * 0.15)); }

// ─────────────────────────────────────────────────────────────────────────────
// Users & Roles
// ─────────────────────────────────────────────────────────────────────────────
const USER_ROWS: TenantUserRow[] = [
  { userId:'u-001', fullName:'Ahmed Hassan',    email:'ahmed.hassan@elm.sa',    role:'Tenant_Admin',      status:'Active',    mfaStatus:'Enabled',   lastLoginAt:'2026-04-13T08:00:00Z', invitedAt:null,                  createdAt:'2025-10-01T00:00:00Z', businessUnit:null },
  { userId:'u-002', fullName:'Sara Ali',        email:'sara.ali@elm.sa',        role:'FinOps_Analyst',    status:'Active',    mfaStatus:'Enabled',   lastLoginAt:'2026-04-13T07:30:00Z', invitedAt:null,                  createdAt:'2025-10-01T00:00:00Z', businessUnit:'Platform' },
  { userId:'u-003', fullName:'Omar Khalid',     email:'omar.khalid@elm.sa',     role:'Engineering',       status:'Active',    mfaStatus:'Enabled',   lastLoginAt:'2026-04-12T16:00:00Z', invitedAt:null,                  createdAt:'2025-10-15T00:00:00Z', businessUnit:'Data Platform' },
  { userId:'u-004', fullName:'Fatima Jaber',    email:'fatima.jaber@elm.sa',    role:'Finance',           status:'Active',    mfaStatus:'Enabled',   lastLoginAt:'2026-04-11T09:00:00Z', invitedAt:null,                  createdAt:'2025-10-15T00:00:00Z', businessUnit:'Finance' },
  { userId:'u-005', fullName:'Khalid Nasser',   email:'khalid.nasser@elm.sa',   role:'FinOps_Analyst',    status:'Active',    mfaStatus:'Disabled',  lastLoginAt:'2026-04-10T14:00:00Z', invitedAt:null,                  createdAt:'2025-11-01T00:00:00Z', businessUnit:'AI Research' },
  { userId:'u-006', fullName:'Hind Al-Rashid',  email:'hind.alrashid@elm.sa',   role:'Executive_Viewer',  status:'Active',    mfaStatus:'Enabled',   lastLoginAt:'2026-04-08T11:00:00Z', invitedAt:null,                  createdAt:'2025-11-01T00:00:00Z', businessUnit:null },
  { userId:'u-007', fullName:'Rami Yousef',     email:'rami.yousef@elm.sa',     role:'Engineering',       status:'Invited',   mfaStatus:'Disabled',  lastLoginAt:null,                   invitedAt:'2026-04-12T00:00:00Z', createdAt:'2026-04-12T00:00:00Z', businessUnit:'Risk Analytics' },
  { userId:'u-008', fullName:'Mona Al-Hamad',   email:'mona.alhamad@elm.sa',    role:'Auditor',           status:'Active',    mfaStatus:'Enabled',   lastLoginAt:'2026-04-09T10:00:00Z', invitedAt:null,                  createdAt:'2025-12-01T00:00:00Z', businessUnit:null },
  { userId:'u-009', fullName:'Tariq Ibrahim',   email:'tariq.ibrahim@elm.sa',   role:'Read_Only',         status:'Suspended', mfaStatus:'Disabled',  lastLoginAt:'2026-02-28T08:00:00Z', invitedAt:null,                  createdAt:'2026-01-01T00:00:00Z', businessUnit:'Core Banking' },
  { userId:'u-010', fullName:'Dana Karimi',     email:'dana.karimi@elm.sa',     role:'FinOps_Analyst',    status:'Invited',   mfaStatus:'Disabled',  lastLoginAt:null,                   invitedAt:'2026-04-13T00:00:00Z', createdAt:'2026-04-13T00:00:00Z', businessUnit:'Digital Products' },
];
const USER_SUMMARY: UserListSummary = { total: 10, active: 7, invited: 2, suspended: 1, mfaEnabled: 7 };

@Injectable({ providedIn: 'root' })
export class UsersRolesService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/admin/users`, { params })
  list(q: Record<string, unknown>): Observable<{ data: TenantUserRow[]; pagination: { total: number; page: number; limit: number } }> {
    return mockList(USER_ROWS);
  }
  summary(): Observable<UserListSummary> { return mockSummary(USER_SUMMARY); }
  // SWAP TO REAL: this.#http.post<void>(`${environment.apiUrl}/admin/users/invite`, { email, role })
  invite(email: string, role: string): Observable<void> { return mockMutation(); }
  suspendUser(id: string): Observable<void> { return mockMutation(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Integrations
// ─────────────────────────────────────────────────────────────────────────────
const INTEGRATION_ROWS: IntegrationRow[] = [
  { integrationId:'int-001', name:'AWS Master Billing',    provider:'Amazon Web Services', category:'Cloud_Provider', status:'Connected',    lastSyncAt:'2026-04-13T06:00:00Z', nextSyncAt:'2026-04-13T12:00:00Z', syncFrequency:'Every 6h',  recordsIngested:284_420, errorCount:0, configuredBy:'Ahmed Hassan', connectedAt:'2025-10-01T00:00:00Z' },
  { integrationId:'int-002', name:'Azure EA Enrollment',   provider:'Microsoft Azure',     category:'Cloud_Provider', status:'Connected',    lastSyncAt:'2026-04-13T05:00:00Z', nextSyncAt:'2026-04-13T11:00:00Z', syncFrequency:'Every 6h',  recordsIngested:198_640, errorCount:0, configuredBy:'Ahmed Hassan', connectedAt:'2025-10-01T00:00:00Z' },
  { integrationId:'int-003', name:'GCP Billing Export',    provider:'Google Cloud',        category:'Cloud_Provider', status:'Degraded',     lastSyncAt:'2026-04-12T18:00:00Z', nextSyncAt:'2026-04-13T00:00:00Z', syncFrequency:'Every 6h',  recordsIngested:84_210,  errorCount:3, configuredBy:'Omar Khalid',  connectedAt:'2025-10-15T00:00:00Z' },
  { integrationId:'int-004', name:'Microsoft 365 Usage',   provider:'Microsoft',           category:'SaaS_Platform',  status:'Connected',    lastSyncAt:'2026-04-13T04:00:00Z', nextSyncAt:'2026-04-14T04:00:00Z', syncFrequency:'Daily',     recordsIngested:48_000,  errorCount:0, configuredBy:'Sara Ali',     connectedAt:'2025-11-01T00:00:00Z' },
  { integrationId:'int-005', name:'Salesforce CRM',        provider:'Salesforce',          category:'SaaS_Platform',  status:'Connected',    lastSyncAt:'2026-04-13T02:00:00Z', nextSyncAt:'2026-04-14T02:00:00Z', syncFrequency:'Daily',     recordsIngested:12_840,  errorCount:0, configuredBy:'Sara Ali',     connectedAt:'2025-11-15T00:00:00Z' },
  { integrationId:'int-006', name:'ServiceNow ITSM',       provider:'ServiceNow',          category:'ITSM',           status:'Connected',    lastSyncAt:'2026-04-13T08:00:00Z', nextSyncAt:'2026-04-13T14:00:00Z', syncFrequency:'Every 6h',  recordsIngested:8_420,   errorCount:0, configuredBy:'Ahmed Hassan', connectedAt:'2025-12-01T00:00:00Z' },
  { integrationId:'int-007', name:'SAP S/4HANA',           provider:'SAP',                 category:'ERP_Finance',    status:'Connected',    lastSyncAt:'2026-04-12T23:00:00Z', nextSyncAt:'2026-04-13T23:00:00Z', syncFrequency:'Daily',     recordsIngested:24_800,  errorCount:0, configuredBy:'Fatima Jaber', connectedAt:'2026-01-01T00:00:00Z' },
  { integrationId:'int-008', name:'Datadog APM',           provider:'Datadog',             category:'Monitoring',     status:'Error',        lastSyncAt:'2026-04-11T00:00:00Z', nextSyncAt:null,                   syncFrequency:'Every 15m', recordsIngested:0,       errorCount:48,configuredBy:'Omar Khalid',  connectedAt:'2026-01-15T00:00:00Z' },
  { integrationId:'int-009', name:'Azure Active Directory', provider:'Microsoft',          category:'Identity',       status:'Connected',    lastSyncAt:'2026-04-13T07:00:00Z', nextSyncAt:'2026-04-13T13:00:00Z', syncFrequency:'Every 6h',  recordsIngested:2_400,   errorCount:0, configuredBy:'Ahmed Hassan', connectedAt:'2025-10-01T00:00:00Z' },
  { integrationId:'int-010', name:'Snowflake Data Warehouse',provider:'Snowflake',         category:'Data_Warehouse', status:'Pending',      lastSyncAt:null,                   nextSyncAt:null,                   syncFrequency:'Daily',     recordsIngested:0,       errorCount:0, configuredBy:'Omar Khalid',  connectedAt:'2026-04-12T00:00:00Z' },
];
const INTEGRATION_SUMMARY: IntegrationSummary = { total: 10, connected: 7, degraded: 1, disconnected: 0, errors: 1 };

@Injectable({ providedIn: 'root' })
export class IntegrationsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/admin/integrations`, { params })
  list(q: Record<string, unknown>): Observable<{ data: IntegrationRow[]; pagination: { total: number; page: number; limit: number } }> {
    return mockList(INTEGRATION_ROWS);
  }
  summary(): Observable<IntegrationSummary> { return mockSummary(INTEGRATION_SUMMARY); }
  syncNow(id: string): Observable<void> { return mockMutation(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Flags
// ─────────────────────────────────────────────────────────────────────────────
const FLAG_ROWS: FeatureFlagRow[] = [
  { flagId:'ff-001', flagKey:'anomaly-detection-v2',        displayName:'Anomaly Detection v2 (ML)', description:'Use new ML-based anomaly model instead of rule engine.', flagType:'Boolean_Toggle',    status:'Active',  isKillSwitch:false, currentValue:true,  rolloutPct:null, ownerName:'Sara Ali',    tags:['ml','anomaly'],           lastModifiedAt:'2026-04-01T00:00:00Z', isPermanent:false },
  { flagId:'ff-002', flagKey:'gpu-mig-optimizer',           displayName:'GPU MIG Optimizer',         description:'Enable MIG partition recommendations for A100 nodes.',  flagType:'Boolean_Toggle',    status:'Active',  isKillSwitch:false, currentValue:true,  rolloutPct:null, ownerName:'Sara Ali',    tags:['gpu','optimize'],         lastModifiedAt:'2026-03-15T00:00:00Z', isPermanent:false },
  { flagId:'ff-003', flagKey:'new-cost-explorer-ui',        displayName:'Cost Explorer UI v2',       description:'Gradual rollout of redesigned cost explorer.',           flagType:'Percentage_Rollout',status:'Active',  isKillSwitch:false, currentValue:30,    rolloutPct:30,   ownerName:'Ahmed Hassan',tags:['ui','cost-explorer'],     lastModifiedAt:'2026-04-10T00:00:00Z', isPermanent:false },
  { flagId:'ff-004', flagKey:'real-time-anomaly-alerts',    displayName:'Real-time Anomaly Alerts',  description:'Enable WebSocket-based real-time alert delivery.',        flagType:'Tenant_Allowlist',  status:'Active',  isKillSwitch:false, currentValue:true,  rolloutPct:null, ownerName:'Ahmed Hassan',tags:['alerts','websocket'],     lastModifiedAt:'2026-03-20T00:00:00Z', isPermanent:false },
  { flagId:'ff-005', flagKey:'disable-agent-a16',           displayName:'Kill Switch: GPU Optimizer',description:'Emergency disable for GPU Optimizer agent (A16).',       flagType:'Kill_Switch',       status:'Paused',  isKillSwitch:true,  currentValue:false, rolloutPct:null, ownerName:'Ahmed Hassan',tags:['kill-switch','gpu'],      lastModifiedAt:'2026-04-12T00:00:00Z', isPermanent:true  },
  { flagId:'ff-006', flagKey:'chargeback-erp-export-v2',   displayName:'Chargeback ERP Export v2',  description:'New XML-based ERP export format for SAP S/4HANA.',       flagType:'Environment_Scoped',status:'Draft',   isKillSwitch:false, currentValue:false, rolloutPct:null, ownerName:'Fatima Jaber',tags:['chargeback','erp'],       lastModifiedAt:'2026-04-05T00:00:00Z', isPermanent:false },
  { flagId:'ff-007', flagKey:'arabic-ui-rtl',               displayName:'Arabic RTL Interface',      description:'Right-to-left UI layout for Arabic locale users.',        flagType:'Boolean_Toggle',    status:'Active',  isKillSwitch:false, currentValue:true,  rolloutPct:null, ownerName:'Ahmed Hassan',tags:['i18n','rtl'],             lastModifiedAt:'2026-02-01T00:00:00Z', isPermanent:true  },
  { flagId:'ff-008', flagKey:'ai-narrative-blocks',         displayName:'AI Narrative Blocks',       description:'Enable GPT-powered NL narrative in dashboards.',          flagType:'Percentage_Rollout',status:'Active',  isKillSwitch:false, currentValue:80,    rolloutPct:80,   ownerName:'Sara Ali',    tags:['ai','narrative'],         lastModifiedAt:'2026-04-08T00:00:00Z', isPermanent:false },
];
const FLAG_SUMMARY: FeatureFlagSummary = { total: 8, active: 5, paused: 1, killSwitches: 1 };

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/admin/features`, { params })
  list(q: Record<string, unknown>): Observable<{ data: FeatureFlagRow[]; pagination: { total: number; page: number; limit: number } }> {
    return mockList(FLAG_ROWS);
  }
  summary(): Observable<FeatureFlagSummary> { return mockSummary(FLAG_SUMMARY); }
  // SWAP TO REAL: this.#http.patch<void>(`${environment.apiUrl}/admin/features/${id}/toggle`, { enabled })
  toggle(id: string, enabled: boolean): Observable<void> { return mockMutation(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────
const NOTIFICATION_MOCK: NotificationSettings = {
  tenantId: 'elm-tenant-001',
  globalEnabled: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  quietHoursDays: [5, 6],
  updatedAt: '2026-04-01T10:00:00Z',
  updatedBy: 'Ahmed Hassan',
  channels: [
    { channelId:'ch-001', channel:'Email',    isEnabled:true,  destination:'finops-alerts@elm.sa',           events:['Budget_Alert_Warning','Budget_Alert_Critical','Budget_Breach','Anomaly_Detected','Governance_Violation','Approval_Required','Chargeback_Ready'], minSeverity:'Medium', rateLimitPerHour:20, updatedAt:'2026-04-01T10:00:00Z' },
    { channelId:'ch-002', channel:'Slack',    isEnabled:true,  destination:'#finops-alerts',                  events:['Anomaly_Detected','Anomaly_Confirmed','Budget_Alert_Critical','Agent_Degraded','Agent_Failed'],                                                 minSeverity:'High',   rateLimitPerHour:30, updatedAt:'2026-04-01T10:00:00Z' },
    { channelId:'ch-003', channel:'Webhook',  isEnabled:true,  destination:'https://hooks.elm.sa/finops/v1',  events:['Budget_Breach','Governance_SLA_Breach','Approval_Required','Agent_Failed'],                                                                    minSeverity:'Critical', rateLimitPerHour:100,updatedAt:'2026-03-15T10:00:00Z' },
    { channelId:'ch-004', channel:'MS_Teams', isEnabled:false, destination:'',                               events:[],                                                                                                                                                 minSeverity:'High',   rateLimitPerHour:20, updatedAt:'2026-01-01T00:00:00Z' },
    { channelId:'ch-005', channel:'PagerDuty',isEnabled:false, destination:'',                               events:[],                                                                                                                                                 minSeverity:'Critical',rateLimitPerHour:10, updatedAt:'2026-01-01T00:00:00Z' },
  ],
};

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<NotificationSettings>(`${environment.apiUrl}/admin/notifications`)
  get(): Observable<NotificationSettings> { return of(NOTIFICATION_MOCK).pipe(delay(500)); }
  // SWAP TO REAL: this.#http.put<NotificationSettings>(`${environment.apiUrl}/admin/notifications`, settings)
  save(settings: NotificationSettings): Observable<NotificationSettings> { return of({ ...settings, updatedAt: new Date().toISOString() }).pipe(delay(800)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing & Subscription
// ─────────────────────────────────────────────────────────────────────────────
const BILLING_MOCK: BillingDashboardData = {
  tier: 'Enterprise', billingStatus: 'Current', renewalDate: '2026-07-31',
  kpis: {
    currentMonthSpend: { value: 148_420, currency: DEFAULT_CURRENCY as CUR, deltaPercent: 8.4, deltaDirection: 'up', sparkline: sparks(140_000) },
    fpConsumed:        { value: 380_240, quota: 500_000, pct: 76.0, sparkline: sparks(360_000) },
    activeUsers:       { value: 8, quota: 100, deltaPercent: 14.3, deltaDirection: 'up', sparkline: sparks(7) },
    daysToRenewal:     { value: 109, sparkline: sparks(130) },
  },
  usageTrend: [
    { month:'Oct 25', compute:62_400, storage:8_200,  network:4_100, support:0 },
    { month:'Nov 25', compute:68_200, storage:9_100,  network:4_800, support:2_400 },
    { month:'Dec 25', compute:84_200, storage:10_200, network:5_200, support:0 },
    { month:'Jan 26', compute:92_400, storage:11_400, network:5_800, support:0 },
    { month:'Feb 26', compute:118_400,storage:13_200, network:7_200, support:4_800 },
    { month:'Mar 26', compute:136_800,storage:14_800, network:8_400, support:0 },
  ],
  invoices: [
    { invoiceId:'inv-2026-03', period:'March 2026',    amount:136_800, currency:CUR, status:'Paid',   dueDate:'2026-04-15', paidDate:'2026-04-03', downloadUrl:'/invoices/2026-03.pdf' },
    { invoiceId:'inv-2026-02', period:'February 2026', amount:118_400, currency:CUR, status:'Paid',   dueDate:'2026-03-15', paidDate:'2026-03-02', downloadUrl:'/invoices/2026-02.pdf' },
    { invoiceId:'inv-2026-01', period:'January 2026',  amount:92_400,  currency:CUR, status:'Paid',   dueDate:'2026-02-15', paidDate:'2026-02-08', downloadUrl:'/invoices/2026-01.pdf' },
    { invoiceId:'inv-2025-12', period:'December 2025', amount:84_200,  currency:CUR, status:'Paid',   dueDate:'2026-01-15', paidDate:'2026-01-06', downloadUrl:'/invoices/2025-12.pdf' },
    { invoiceId:'inv-2025-11', period:'November 2025', amount:68_200,  currency:CUR, status:'Paid',   dueDate:'2025-12-15', paidDate:'2025-12-04', downloadUrl:'/invoices/2025-11.pdf' },
  ],
};

@Injectable({ providedIn: 'root' })
export class BillingService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<BillingDashboardData>(`${environment.apiUrl}/admin/billing/dashboard`)
  getDashboard(): Observable<BillingDashboardData> { return of(BILLING_MOCK).pipe(delay(700)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Support Center
// ─────────────────────────────────────────────────────────────────────────────
const SUPPORT_ROWS: SupportCaseRow[] = [
  { caseId:'sc-001', caseNumber:'CASE-2026-0042', title:'GCP billing export connector failing since upgrade', category:'Technical_Issue', priority:'High',   status:'In_Progress',           createdBy:'Omar Khalid',  assignedTo:'ELM Support L2', createdAt:'2026-04-11T10:00:00Z', updatedAt:'2026-04-13T09:00:00Z', resolvedAt:null,                   slaBreached:false },
  { caseId:'sc-002', caseNumber:'CASE-2026-0041', title:'Invoice for Feb 2026 shows incorrect amounts',       category:'Billing_Question',priority:'Medium', status:'Pending_Customer',      createdBy:'Fatima Jaber', assignedTo:'ELM Finance',    createdAt:'2026-04-10T14:00:00Z', updatedAt:'2026-04-12T16:00:00Z', resolvedAt:null,                   slaBreached:false },
  { caseId:'sc-003', caseNumber:'CASE-2026-0040', title:'Anomaly detection false positives for weekend jobs', category:'Bug_Report',      priority:'Medium', status:'Waiting_On_Engineering',createdBy:'Sara Ali',      assignedTo:'ELM Engineering', createdAt:'2026-04-09T08:00:00Z', updatedAt:'2026-04-11T10:00:00Z', resolvedAt:null,                   slaBreached:true  },
  { caseId:'sc-004', caseNumber:'CASE-2026-0038', title:'Request: Add department-level cost allocation',      category:'Feature_Request', priority:'Low',    status:'Open',                  createdBy:'Ahmed Hassan', assignedTo:null,              createdAt:'2026-04-07T00:00:00Z', updatedAt:'2026-04-07T00:00:00Z', resolvedAt:null,                   slaBreached:false },
  { caseId:'sc-005', caseNumber:'CASE-2026-0035', title:'Datadog integration returns 401 after token rotation',category:'Integration_Help',priority:'High',  status:'Resolved',              createdBy:'Omar Khalid',  assignedTo:'ELM Support L2', createdAt:'2026-04-04T11:00:00Z', updatedAt:'2026-04-06T14:00:00Z', resolvedAt:'2026-04-06T14:00:00Z', slaBreached:false },
  { caseId:'sc-006', caseNumber:'CASE-2026-0032', title:'User invitation emails not received by external users',category:'Access_Request',priority:'Medium', status:'Resolved',              createdBy:'Ahmed Hassan', assignedTo:'ELM Support L1', createdAt:'2026-04-01T09:00:00Z', updatedAt:'2026-04-02T15:00:00Z', resolvedAt:'2026-04-02T15:00:00Z', slaBreached:false },
];
const SUPPORT_SUMMARY: SupportCaseSummary = { total: 6, open: 4, inProgress: 2, resolved: 2, breached: 1 };

@Injectable({ providedIn: 'root' })
export class SupportCenterService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<...>(`${environment.apiUrl}/admin/support`, { params })
  list(q: Record<string, unknown>): Observable<{ data: SupportCaseRow[]; pagination: { total: number; page: number; limit: number } }> {
    return mockList(SUPPORT_ROWS);
  }
  summary(): Observable<SupportCaseSummary> { return mockSummary(SUPPORT_SUMMARY); }
  // SWAP TO REAL: this.#http.post<SupportCaseRow>(`${environment.apiUrl}/admin/support`, { title, category, priority, description })
  create(payload: Record<string, unknown>): Observable<SupportCaseRow> { return of(SUPPORT_ROWS[0]).pipe(delay(800)); }
}
