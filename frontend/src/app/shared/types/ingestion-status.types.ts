// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/ingestion-status.types.ts

export type ConnectorStatus  = 'Healthy' | 'Degraded' | 'Failed' | 'Stale' | 'Disabled';
export type IngestionRunStatus = 'Completed' | 'Partial' | 'Failed' | 'Running' | 'Queued';
export type SourceType = 'AWS' | 'Azure' | 'GCP' | 'OCI' | 'VMware' | 'Kubernetes' | 'GPU_DCGM' | 'Manual' | 'ERP';

export interface IngestionKpis {
  totalConnectors:   { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  healthyConnectors: { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  recordsToday:      { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  avgQualityScore:   { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
}

export interface ConnectorHealthRow {
  connectorId:      string;
  connectorName:    string;
  sourceType:       SourceType;
  status:           ConnectorStatus;
  lastRunAt:        string | null;
  lastRunStatus:    IngestionRunStatus | null;
  recordsLastRun:   number;
  qualityScore:     number;   // 0-100
  freshnessHours:   number;   // hours since last successful data
  retryCount:       number;
  errorMessage:     string | null;
}

export interface IngestionThroughputPoint {
  date:    string;
  records: number;
}

export interface IngestionStatusDashboardData {
  kpis:               IngestionKpis;
  connectors:         ConnectorHealthRow[];
  throughputHistory:  IngestionThroughputPoint[];   // last 14 days
  qualityBySource:    Array<{ source: string; score: number }>;
  narrative: {
    summary: string; agentId: string; agentName: string;
    generatedAt: string; highlights: string[];
  };
}
