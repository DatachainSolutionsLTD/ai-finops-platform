// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: libs/shared/src/lib/types/metering-engine.types.ts

export type MeteringEventStatus = 'Processed' | 'Pending' | 'Failed' | 'Retrying';
export type MeteringPipelineStatus = 'Healthy' | 'Degraded' | 'Down';

export interface MeteringKpis {
  eventsProcessed24h:    { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  eventsPending:         { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  processingLagSec:      { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
  failureRate24hPct:     { value: number; deltaPercent: number; deltaDirection: 'up' | 'down' | 'neutral'; sparkline: number[] };
}

export interface MeteringThroughputSeries {
  timestamps: string[];
  processed:  number[];
  failed:     number[];
}

export interface MeteringQueueDepthSeries {
  timestamps: string[];
  depth:      number[];
}

export interface MeteringPipelineHealth {
  pipelineId:    string;
  pipelineName:  string;
  status:        MeteringPipelineStatus;
  lagSec:        number;
  throughputEph: number; // events per hour
  errorRate:     number; // percentage
  lastEventAt:   string;
}

export interface MeteringNarrative {
  summary:     string;
  agentId:     string;
  agentName:   string;
  generatedAt: string;
  highlights:  string[];
}

export interface MeteringDashboardData {
  kpis:             MeteringKpis;
  throughputSeries: MeteringThroughputSeries;
  queueSeries:      MeteringQueueDepthSeries;
  pipelines:        MeteringPipelineHealth[];
  narrative:        MeteringNarrative;
}

export type MeteringTimeRange = '1h' | '6h' | '24h' | '7d';
