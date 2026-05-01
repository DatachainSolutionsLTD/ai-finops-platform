// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/coordinate.types.ts
// Covers: ApprovalsQueue (A30), AgentActivity (A27), Conflicts (A28), Explanations (A29)

// ═══════════════════════════════════════════════════════════════════════════
// APPROVALS QUEUE  (Agent A30 — Human-in-the-Loop)
// ═══════════════════════════════════════════════════════════════════════════

export type ApprovalPriority  = 'Critical' | 'High' | 'Medium' | 'Low';
export type ApprovalStatus    = 'Pending' | 'In_Review' | 'Approved' | 'Rejected' | 'Deferred' | 'Delegated' | 'Expired';
export type ApprovalDomain    = 'Workload' | 'Rate' | 'Architecture' | 'Governance' | 'Sustainability' | 'License' | 'GPU' | 'Container' | 'Network' | 'Storage' | 'Other';
export type ApprovalSlaStatus = 'Within_SLA' | 'At_Risk' | 'Breached';

export interface ApprovalQueueRow {
  escalationId:     string;
  title:            string;
  originatingAgent: string;
  agentId:          string;
  domain:           ApprovalDomain;
  priority:         ApprovalPriority;
  environment:      string;
  financialImpact:  number;   // monthly AED
  currency:         string;
  status:           ApprovalStatus;
  slaStatus:        ApprovalSlaStatus;
  slaRemainingHours:number | null;
  assignedTo:       string | null;
  businessUnit:     string;
  riskLevel:        string;
  confidenceScore:  number;
  createdAt:        string;
}

export interface ApprovalQueueSummary {
  pending:          number;
  slaAtRisk:        number;
  decidedToday:     number;
  approvalRate:     number;
  avgDecisionHours: number;
}

export const APPROVAL_PRIORITY_OPTIONS: ApprovalPriority[] = ['Critical','High','Medium','Low'];
export const APPROVAL_STATUS_OPTIONS:   ApprovalStatus[]   = ['Pending','In_Review','Approved','Rejected','Deferred','Delegated','Expired'];
export const APPROVAL_DOMAIN_OPTIONS:   ApprovalDomain[]   = ['Workload','Rate','Architecture','Governance','Sustainability','License','GPU','Container','Network','Storage','Other'];

// ═══════════════════════════════════════════════════════════════════════════
// AGENT ACTIVITY  (Agent A27 — Orchestrator)
// ═══════════════════════════════════════════════════════════════════════════

export type AgentStatus     = 'Healthy' | 'Degraded' | 'Busy' | 'Failed' | 'Suspended' | 'Updating';
export type AgentTier       = 'Orchestration' | 'Understand' | 'Quantify' | 'Optimize' | 'Manage' | 'Coordinate';

export interface AgentActivityRow {
  agentId:          string;
  agentCode:        string;   // e.g. 'A11'
  agentName:        string;
  tier:             AgentTier;
  status:           AgentStatus;
  version:          string;
  queueDepth:       number;
  activeActions:    number;
  lastHeartbeatAt:  string;
  uptimePct:        number;
  cpuPct:           number;
  memoryPct:        number;
  errorRatePct:     number;   // last 1hr
  actionsLast24h:   number;
}

export interface AgentActivitySummary {
  totalAgents:    number;
  healthy:        number;
  degraded:       number;
  failed:         number;
  suspended:      number;
  totalQueueDepth:number;
}

export const AGENT_STATUS_OPTIONS: AgentStatus[] = ['Healthy','Degraded','Busy','Failed','Suspended','Updating'];
export const AGENT_TIER_OPTIONS:   AgentTier[]   = ['Orchestration','Understand','Quantify','Optimize','Manage','Coordinate'];

// ═══════════════════════════════════════════════════════════════════════════
// CONFLICTS  (Agent A28 — Conflict Resolution)
// ═══════════════════════════════════════════════════════════════════════════

export type ConflictType       = 'Resource_Action' | 'Policy_Boundary' | 'Financial_Impact' | 'Scheduling' | 'Multi_Party';
export type ConflictStatus     = 'Intake' | 'Analyzing' | 'Pending_Human' | 'Resolved_Auto' | 'Resolved_Human' | 'Escalated' | 'Cancelled';
export type ConflictResolution = 'Algorithmic' | 'Human_Decision' | 'Policy_Override' | 'Deferred' | 'Cancelled';

export interface ConflictListRow {
  conflictId:         string;
  conflictType:       ConflictType;
  status:             ConflictStatus;
  resolution:         ConflictResolution | null;
  agentA:             string;
  agentB:             string;
  resourceId:         string;
  resourceType:       string;
  combinedImpact:     number;
  currency:           string;
  chosenSavings:      number | null;
  confidenceScore:    number | null;
  detectedAt:         string;
  resolvedAt:         string | null;
  resolutionDurationSec: number | null;
  businessUnit:       string;
  requiresHuman:      boolean;
}

export interface ConflictListSummary {
  total:          number;
  open:           number;
  pendingHuman:   number;
  resolvedAuto:   number;
  avgResolutionMin:number;
}

export const CONFLICT_TYPE_OPTIONS:   ConflictType[]   = ['Resource_Action','Policy_Boundary','Financial_Impact','Scheduling','Multi_Party'];
export const CONFLICT_STATUS_OPTIONS: ConflictStatus[] = ['Intake','Analyzing','Pending_Human','Resolved_Auto','Resolved_Human','Escalated','Cancelled'];

// ═══════════════════════════════════════════════════════════════════════════
// AGENT EXPLANATIONS  (Agent A29 — Explainability)
// ═══════════════════════════════════════════════════════════════════════════

export type ExplanationAudience = 'Executive' | 'FinOps_Analyst' | 'Engineering' | 'Finance' | 'All';
export type ExplanationStatus   = 'Generated' | 'Delivered' | 'Viewed' | 'Archived';

export interface ExplanationRow {
  explanationId:  string;
  title:          string;
  summary:        string;    // first 120 chars of NL explanation
  originatingAgent: string;
  agentId:        string;
  audience:       ExplanationAudience;
  status:         ExplanationStatus;
  relatedActionId:string | null;
  businessUnit:   string;
  financialImpact:number;
  currency:       string;
  confidenceScore:number;
  generatedAt:    string;
  viewCount:      number;
}

export interface ExplanationListSummary {
  total:         number;
  generatedToday:number;
  avgConfidence: number;
  uniqueViewers: number;
}

export const EXPLANATION_AUDIENCE_OPTIONS: ExplanationAudience[] = ['Executive','FinOps_Analyst','Engineering','Finance','All'];
export const EXPLANATION_STATUS_OPTIONS:   ExplanationStatus[]   = ['Generated','Delivered','Viewed','Archived'];
