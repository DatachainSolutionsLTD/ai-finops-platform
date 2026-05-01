// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/agent-config.types.ts

export type AgentStatus    = 'Running' | 'Idle' | 'Degraded' | 'Disabled' | 'Error';
export type AutonomyLevel  = 'L1' | 'L2' | 'L3' | 'L4';
export type AgentCategory  = 'Ingestion' | 'Normalization' | 'Optimization' | 'Analytics' | 'Governance' | 'Platform';

export interface AgentListRow {
  agentId:        string;    // e.g. "A01"
  agentCode:      string;    // e.g. "DI-01"
  displayName:    string;
  category:       AgentCategory;
  status:         AgentStatus;
  autonomyLevel:  AutonomyLevel;
  version:        string;
  lastRunAt:      string | null; // ISO 8601 UTC
  lastRunStatus:  'Success' | 'Partial' | 'Failed' | null;
  avgRunDurationSec: number;
  pendingJobCount: number;
  errorCount24h:   number;
  enabled:         boolean;
}

export interface AgentListQuery {
  search?:   string;
  status?:   AgentStatus[];
  category?: AgentCategory[];
  page?:     number;
  limit?:    number;
}

export interface AgentListResponse {
  data:       AgentListRow[];
  pagination: { total: number; page: number; limit: number };
}

export interface AgentListSummary {
  totalAgents:    number;
  runningAgents:  number;
  degradedAgents: number;
  disabledAgents: number;
  pendingJobs:    number;
}

export interface AgentDetail extends AgentListRow {
  description:         string;
  configJson:          string;            // raw JSON string for editing
  scheduleExpression:  string | null;     // cron or null
  retryLimit:          number;
  retryBackoffSec:     number;
  maxConcurrentJobs:   number;
  dependsOn:           string[];          // agentId list
  upstreamAgents:      string[];
  downstreamAgents:    string[];
  tags:                Record<string, string>;
  etag:                string;
}

export interface AgentConfigPatch {
  configJson?:         string;
  scheduleExpression?: string | null;
  retryLimit?:         number;
  retryBackoffSec?:    number;
  maxConcurrentJobs?:  number;
  autonomyLevel?:      AutonomyLevel;
  enabled?:            boolean;
}

export const AGENT_STATUS_OPTIONS:   AgentStatus[]   = ['Running', 'Idle', 'Degraded', 'Disabled', 'Error'];
export const AGENT_CATEGORY_OPTIONS: AgentCategory[] = ['Ingestion', 'Normalization', 'Optimization', 'Analytics', 'Governance', 'Platform'];
export const AUTONOMY_LEVEL_LABELS:  Record<AutonomyLevel, string> = {
  L1: 'L1 – Alert Only',
  L2: 'L2 – Recommend',
  L3: 'L3 – Auto-Apply',
  L4: 'L4 – Fully Autonomous',
};
