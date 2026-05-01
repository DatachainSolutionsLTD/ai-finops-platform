// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/manage.types.ts
// Contains types for: GovernancePolicies, PolicyViolations, TaggingHygiene,
//                     Chargeback, Assessment, Education

// ═══════════════════════════════════════════════════════════════════════════
// GOVERNANCE POLICIES  (Agent A20)
// ═══════════════════════════════════════════════════════════════════════════

export type PolicyType       = 'Tagging' | 'Budget_Guardrail' | 'Naming_Convention' | 'Access_Control' | 'Automation_Boundary';
export type PolicyStatus     = 'Active' | 'Draft' | 'Archived';
export type PolicySeverity   = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
export type PolicyEnforcement = 'Alert_Only' | 'Auto_Remediate' | 'Block_Provisioning';

export interface PolicyListRow {
  policyId:        string;
  name:            string;
  policyType:      PolicyType;
  severity:        PolicySeverity;
  scope:           string;
  status:          PolicyStatus;
  enforcement:     PolicyEnforcement;
  autoRemediation: boolean;
  violationCount:  number;
  affectedResources: number;
  createdBy:       string;
  updatedAt:       string;
}

export interface PolicyListSummary {
  total:           number;
  active:          number;
  draft:           number;
  withViolations:  number;
  autoRemediated:  number;
}

export const POLICY_TYPE_OPTIONS:       PolicyType[]       = ['Tagging','Budget_Guardrail','Naming_Convention','Access_Control','Automation_Boundary'];
export const POLICY_STATUS_OPTIONS:     PolicyStatus[]     = ['Active','Draft','Archived'];
export const POLICY_SEVERITY_OPTIONS:   PolicySeverity[]   = ['Critical','High','Medium','Low','Informational'];

// ═══════════════════════════════════════════════════════════════════════════
// POLICY VIOLATIONS  (Agent A20)
// ═══════════════════════════════════════════════════════════════════════════

export type ViolationStatus    = 'Open' | 'Acknowledged' | 'In_Remediation' | 'Remediated' | 'Waived';
export type ViolationSlaStatus = 'Within_SLA' | 'Approaching' | 'Breached';

export interface ViolationListRow {
  violationId:    string;
  policyName:     string;
  policyType:     PolicyType;
  severity:       PolicySeverity;
  status:         ViolationStatus;
  slaStatus:      ViolationSlaStatus;
  resourceId:     string;
  resourceType:   string;
  provider:       string;
  businessUnit:   string;
  environment:    string;
  costImpact:     number;
  currency:       string;
  detectedAt:     string;
  slaRemainingHours: number | null;
  assignedTo:     string | null;
}

export interface ViolationListSummary {
  total:          number;
  open:           number;
  critical:       number;
  slaBreached:    number;
  unacknowledged: number;
  totalCostImpact:number;
  currency:       string;
}

export const VIOLATION_STATUS_OPTIONS:   ViolationStatus[]   = ['Open','Acknowledged','In_Remediation','Remediated','Waived'];
export const VIOLATION_SEVERITY_OPTIONS: PolicySeverity[]    = ['Critical','High','Medium','Low','Informational'];

// ═══════════════════════════════════════════════════════════════════════════
// TAGGING HYGIENE DASHBOARD  (Agent A24)
// ═══════════════════════════════════════════════════════════════════════════

export interface TaggingKpis {
  overallComplianceRate: { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  nonCompliantResources: { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  untaggedCost:          { value: number; currency: string; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  autoTaggedToday:       { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
}

export interface TagComplianceTrendPoint { period: string; rate: number; }
export interface TagComplianceByBuItem   { bu: string; complianceRate: number; nonCompliantCount: number; }

export interface TagRemediationRow {
  resourceId:      string;
  resourceName:    string;
  resourceType:    string;
  provider:        string;
  businessUnit:    string;
  environment:     string;
  missingTags:     string[];
  monthlyCost:     number;
  currency:        string;
  priority:        string;
  daysOpen:        number;
}

export interface TaggingDashboardData {
  kpis:            TaggingKpis;
  complianceTrend: TagComplianceTrendPoint[];
  complianceByBu:  TagComplianceByBuItem[];
  remediation:     TagRemediationRow[];
  narrative: { summary: string; agentId: string; agentName: string; generatedAt: string; highlights: string[] };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEBACK  (Agent A22)
// ═══════════════════════════════════════════════════════════════════════════

export type ChargebackStatementStatus = 'Draft' | 'Pending_Review' | 'Approved' | 'Distributed' | 'Disputed' | 'Adjusted' | 'Finalized';
export type ChargebackStatementType   = 'Chargeback_Binding' | 'Showback_Advisory' | 'Hybrid_Display';

export interface ChargebackStatementRow {
  statementId:     string;
  billingPeriod:   string;
  statementType:   ChargebackStatementType;
  businessUnit:    string;
  totalAmount:     number;
  currency:        string;
  status:          ChargebackStatementStatus;
  disputeCount:    number;
  hasAnomaly:      boolean;
  generatedAt:     string;
  distributedAt:   string | null;
  approvedBy:      string | null;
}

export interface ChargebackListSummary {
  totalCharged:   number;
  currency:       string;
  openDisputes:   number;
  pendingApproval:number;
  reconStatus:    'Passed' | 'Warning' | 'Failed' | 'Pending';
  lastPeriod:     string;
}

export const CB_STATUS_OPTIONS: ChargebackStatementStatus[] = ['Draft','Pending_Review','Approved','Distributed','Disputed','Adjusted','Finalized'];
export const CB_TYPE_OPTIONS:   ChargebackStatementType[]   = ['Chargeback_Binding','Showback_Advisory','Hybrid_Display'];

// ═══════════════════════════════════════════════════════════════════════════
// ASSESSMENT DASHBOARD  (Agent A21)
// ═══════════════════════════════════════════════════════════════════════════

export type MaturityLevel = 'Crawl' | 'Walk' | 'Run';

export interface AssessmentKpis {
  overallMaturityScore: { value: number; deltaPercent: number; deltaDirection: 'up'|'down'|'neutral'; sparkline: number[] };
  crawlCount:           { value: number; sparkline: number[] };
  walkCount:            { value: number; sparkline: number[] };
  runCount:             { value: number; sparkline: number[] };
}

export interface MaturityRadarPoint  { capability: string; score: number; }
export interface MaturityCapabilityRow {
  capabilityId:    string;
  capabilityName:  string;
  domain:          string;
  maturityLevel:   MaturityLevel;
  score:           number;
  deltaScore:      number;
  agentId:         string;
  keyKpis:         string;
}

export interface AssessmentDashboardData {
  kpis:         AssessmentKpis;
  radarData:    MaturityRadarPoint[];
  capabilities: MaturityCapabilityRow[];
  narrative: { summary: string; agentId: string; agentName: string; generatedAt: string; highlights: string[] };
}

// ═══════════════════════════════════════════════════════════════════════════
// EDUCATION & TRAINING  (Agent A25)
// ═══════════════════════════════════════════════════════════════════════════

export type ContentType      = 'Video' | 'Article' | 'Interactive_Tutorial' | 'Walkthrough' | 'Certification_Module' | 'Quick_Tip';
export type ContentStatus    = 'Published' | 'Draft' | 'Archived' | 'Deprecated';
export type ProficiencyLevel = 'Novice' | 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export interface EducationContentRow {
  contentId:        string;
  title:            string;
  contentType:      ContentType;
  proficiencyLevel: ProficiencyLevel;
  status:           ContentStatus;
  targetRole:       string;
  enrollmentCount:  number;
  completionRate:   number;   // 0-100
  avgRating:        number;   // 0-5
  durationMinutes:  number;
  publishedAt:      string | null;
  lastUpdatedAt:    string;
}

export interface EducationListSummary {
  totalContent:    number;
  published:       number;
  totalEnrollments:number;
  avgCompletionRate:number;
  avgRating:       number;
}

export const CONTENT_TYPE_OPTIONS:      ContentType[]      = ['Video','Article','Interactive_Tutorial','Walkthrough','Certification_Module','Quick_Tip'];
export const CONTENT_STATUS_OPTIONS:    ContentStatus[]    = ['Published','Draft','Archived','Deprecated'];
export const PROFICIENCY_LEVEL_OPTIONS: ProficiencyLevel[] = ['Novice','Beginner','Intermediate','Advanced','Expert'];
