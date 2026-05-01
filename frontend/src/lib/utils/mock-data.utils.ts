// Mock-data utilities used by service stubs during development.
import { of } from 'rxjs';

/** Default currency code — resolved from tenant config at runtime. */
export const DEFAULT_CURRENCY = 'USD';
export const CUR = DEFAULT_CURRENCY;

/** Generate a small sparkline-style array of random numbers. */
export const sparks = (len = 7, max = 100): number[] =>
  Array.from({ length: len }, () => Math.round(Math.random() * max));

/** Build a lightweight mock list response (Observable). */
export const mockList = <T>(items: T[]): any =>
  of({
    data: items,
    pagination: { total: items.length, page: 1, limit: items.length },
    total: items.length,
    page: 1,
    pageSize: items.length,
  });

/** Build a mock summary response (Observable). */
export const mockSummary = (overrides: any = {}): any =>
  of({
    totalItems: 0,
    totalCost: 0,
    savingsOpportunity: 0,
    ...overrides,
  });

/** Build a mock mutation response (Observable). */
export const mockMutation = (id = 'mock', action = 'update'): any =>
  of({
    success: true,
    id,
    action,
    timestamp: new Date().toISOString(),
  });
