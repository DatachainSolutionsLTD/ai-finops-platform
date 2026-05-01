export interface SummaryStat {
  label: string;
  value: string | number;
  delta?: number;
  deltaDirection?: 'up' | 'down' | 'flat';
  icon?: string;
  color?: string;
}
