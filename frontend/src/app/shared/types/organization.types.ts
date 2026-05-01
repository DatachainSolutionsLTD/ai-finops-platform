export interface Industry {
  code: string;
  label: string;
}

export type DataResidencyRegion = 'US' | 'EU' | 'ME' | 'APAC' | 'UK';
export type FiscalYearStart = 'JAN' | 'FEB' | 'MAR' | 'APR' | 'JUL' | 'OCT';

export const INDUSTRY_OPTIONS: Industry[] = [
  { code: 'TECH', label: 'Technology' },
  { code: 'FIN', label: 'Financial Services' },
  { code: 'HC', label: 'Healthcare' },
  { code: 'RET', label: 'Retail' },
  { code: 'MFG', label: 'Manufacturing' },
  { code: 'EDU', label: 'Education' },
  { code: 'GOV', label: 'Government' },
  { code: 'ENE', label: 'Energy' },
  { code: 'TEL', label: 'Telecommunications' },
  { code: 'OTH', label: 'Other' },
];
