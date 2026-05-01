// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Shared envelope types.
// Location: libs/shared/src/lib/types/envelope.types.ts
//
// Per 05_API_Conventions.md §5 and §10. Every service and every route uses these.
// Duplicating envelope types in feature folders is a contract violation.
// ─────────────────────────────────────────────────────────────────────────────

// ── Pagination metadata (per 05 §5.1) ───────────────────────────────────────
export interface Pagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

// ── List response (per 05 §5.1) ─────────────────────────────────────────────
export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

// ── Single-resource response (per 05 §5.2) ──────────────────────────────────
export interface SingleResponse<T> {
  data: T;
}

// ── Money (per 05 §7.4) ─────────────────────────────────────────────────────
/**
 * Monetary value. Amount is a decimal string to preserve precision;
 * currency is ISO 4217. Always a composite — never a bare number.
 */
export interface Money {
  amount: string;
  currency: string;
}

// ── RFC 7807 Problem Details (per 05 §6) ────────────────────────────────────
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: ValidationError[];
  correlationId?: string;
  /** Non-RFC extension — allows backend to add action hints for the client */
  actions?: Array<{ label: string; url: string }>;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

// ── Standard sort / filter query parameters (per 05 §4) ─────────────────────
export interface SortClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface BaseListQuery extends PaginationQuery {
  sort?: SortClause[];
  q?: string;
}
