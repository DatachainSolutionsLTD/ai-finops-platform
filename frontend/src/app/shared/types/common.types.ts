export type DeltaDirection = 'up' | 'down' | 'flat' | 'neutral';

export interface KpiMetric {
  label?: string;
  value?: number | string;
  previousValue?: number | string;
  delta?: number;
  deltaPercent?: number;
  deltaDirection?: DeltaDirection;
  unit?: string;
  icon?: string;
  color?: string;
  sparkline?: number[];
  currency?: string;
  [key: string]: any;
}

export interface AgentNarrative {
  agentId?: string;
  agentName?: string;
  title?: string;
  summary?: string;
  confidence?: number;
  timestamp?: string;
  details?: string;
  actions?: { label: string; route?: string; handler?: string }[];
  [key: string]: any;
}
