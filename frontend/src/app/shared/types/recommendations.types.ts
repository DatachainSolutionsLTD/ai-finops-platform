// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/recommendations.types.ts

export type RecommendationStatus    = 'Pending' | 'Approved' | 'Rejected' | 'Executed' | 'Failed' | 'Expired' | 'Superseded';
export type RecommendationType      = 'Rightsizing' | 'Idle_Shutdown' | 'Orphan_Cleanup' | 'Commitment_Purchase' | 'Spot_Migration' | 'Schedule_Automation' | 'K8s_Limit_Adjustment' | 'Architecture_Change';
export type RecommendationPriority  = 'Critical' | 'High' | 'Medium' | 'Low';
export type RecommendationRisk      = 'Low' | 'Medium' | 'High';
export type RecommendationSource    = 'A11' | 'A12' | 'A13' | 'A14' | 'A16' | 'A17' | 'A18' | 'A19';

export interface RecommendationListRow {
  recommendationId: string;
  title:            string;
  description:      string;
  type:             RecommendationType;
  priority:         RecommendationPriority;
  status:           RecommendationStatus;
  risk:             RecommendationRisk;
  source:           RecommendationSource;
  provider:         string;
  resourceId:       string;
  resourceType:     string;
  businessUnit:     string;
  environment:      string;
  estimatedSavings: number;
  currency:         string;
  savingsPeriod:    'monthly' | 'annual';
  confidenceScore:  number;   // 0-100
  createdAt:        string;
  expiresAt:        string | null;
  assignedTo:       string | null;
}

export interface RecommendationListSummary {
  total:           number;
  pending:         number;
  totalSavings:    number;
  currency:        string;
  highPriority:    number;
  avgConfidence:   number;
}

export const REC_STATUS_OPTIONS:   RecommendationStatus[]   = ['Pending', 'Approved', 'Rejected', 'Executed', 'Failed', 'Expired', 'Superseded'];
export const REC_TYPE_OPTIONS:     RecommendationType[]     = ['Rightsizing', 'Idle_Shutdown', 'Orphan_Cleanup', 'Commitment_Purchase', 'Spot_Migration', 'Schedule_Automation', 'K8s_Limit_Adjustment', 'Architecture_Change'];
export const REC_PRIORITY_OPTIONS: RecommendationPriority[] = ['Critical', 'High', 'Medium', 'Low'];
export const REC_SOURCE_LABELS: Record<RecommendationSource, string> = {
  A11: 'Workload Optimizer',
  A12: 'Rate Optimizer',
  A13: 'Architecture Advisor',
  A14: 'Sustainability',
  A16: 'GPU Optimizer',
  A17: 'Container Optimizer',
  A18: 'Network Optimizer',
  A19: 'Storage Optimizer',
};
