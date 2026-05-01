// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Tenant Management Service.
// Location: apps/frontend/src/app/features/platform/tenants/tenant-management.service.ts
// Follows 05_API_Conventions.md §11 service pattern.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay, map, catchError } from 'rxjs';
import type { ListResponse, SingleResponse } from '@shared/types/envelope.types';
import type {
  TenantListRow,
  TenantListQuery,
  TenantListSummary,
  TenantBulkActionRequest,
} from '@shared/types/tenant-management.types';
import { ErrorService } from '@shared/services/error.service';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class TenantManagementService {
  readonly #http = inject(HttpClient);
  readonly #errors = inject(ErrorService);
  readonly #apiBase = `${environment.apiBaseUrl}/platform/tenants`;

  /**
   * List tenants with filtering, sorting, pagination.
   *
   * Real API call when backend is ready (replace mock body):
   *   return this.#http
   *     .get<ListResponse<TenantListRow>>(this.#apiBase, { params: this.#toParams(query) })
   *     .pipe(catchError(e => this.#errors.handle(e)));
   */
  list(query: TenantListQuery): Observable<ListResponse<TenantListRow>> {
    return of(this.#mockList(query)).pipe(delay(350));
  }

  /**
   * Summary stats shown above the grid.
   *
   *   return this.#http
   *     .get<SingleResponse<TenantListSummary>>(`${this.#apiBase}/summary`)
   *     .pipe(map(r => r.data), catchError(e => this.#errors.handle(e)));
   */
  summary(): Observable<TenantListSummary> {
    return of(this.#mockSummary()).pipe(delay(250));
  }

  /**
   * Bulk action on selected tenant rows.
   *
   *   return this.#http
   *     .post<SingleResponse<{ affected: number }>>(`${this.#apiBase}/bulk-action`, req,
   *       { headers: { 'Idempotency-Key': crypto.randomUUID() } })
   *     .pipe(map(r => r.data.affected), catchError(e => this.#errors.handle(e)));
   */
  bulkAction(req: TenantBulkActionRequest): Observable<number> {
    return of(req.tenantIds.length).pipe(delay(600));
  }

  // ── Mock data generation (remove when backend is wired) ──────────────────

  #mockList(query: TenantListQuery): ListResponse<TenantListRow> {
    let rows = this.#buildMockRows();

    // Apply filters
    const f = query.filters;
    if (f) {
      if (f.status?.length)        rows = rows.filter(r => f.status!.includes(r.status));
      if (f.tierCode?.length)      rows = rows.filter(r => f.tierCode!.includes(r.tierCode));
      if (f.region?.length)        rows = rows.filter(r => f.region!.includes(r.region));
      if (f.billingStatus?.length) rows = rows.filter(r => f.billingStatus!.includes(r.billingStatus));
      if (f.search) {
        const q = f.search.toLowerCase();
        rows = rows.filter(r =>
          r.displayName.toLowerCase().includes(q) ||
          r.legalName.toLowerCase().includes(q) ||
          r.tenantCode.toLowerCase().includes(q),
        );
      }
    }

    // Apply sort
    if (query.sort) {
      const { field, direction } = query.sort;
      const mult = direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const av = a[field]; const bv = b[field];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return -1 * mult;
        if (av > bv) return  1 * mult;
        return 0;
      });
    }

    const total = rows.length;
    const paged = rows.slice(query.offset, query.offset + query.limit);

    return {
      data: paged,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total,
        hasMore: query.offset + query.limit < total,
      },
    };
  }

  #mockSummary(): TenantListSummary {
    const rows = this.#buildMockRows();
    const active = rows.filter(r => r.status === 'Active').length;
    const onboarding = rows.filter(r => r.status === 'Onboarding').length;
    const degradedOrSuspended = rows.filter(r => r.status === 'Degraded' || r.status === 'Suspended').length;
    const totalFp = rows.reduce((s, r) => s + r.fpConsumedThisMonth, 0);
    const totalSpend = rows.reduce((s, r) => s + Number(r.spendThisMonth.amount), 0);
    return {
      totalTenants: rows.length,
      activeTenants: active,
      onboardingTenants: onboarding,
      degradedOrSuspended,
      totalMonthlyFp: totalFp,
      totalMonthlySpend: { amount: totalSpend.toFixed(4), currency: 'AED' },
    };
  }

  #buildMockRows(): TenantListRow[] {
    const now = new Date();
    const iso = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();
    const isoDaysAhead = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
    const isoDaysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

    return [
      {
        tenantId: '33333333-3333-3333-3333-333333333333',
        tenantCode: 'DEMO-TENANT', legalName: 'Demo Tenant Ltd', displayName: 'Demo Tenant',
        tierCode: 'ENTERPRISE', tierName: 'Enterprise', status: 'Active',
        primaryCurrencyCode: 'AED', primaryLocale: 'en-AE', primaryTimezone: 'Asia/Dubai', region: 'UAE',
        userCount: 47, agentCount: 28, integrationCount: 12,
        fpConsumedThisMonth: 184_523, fpQuotaMonthly: 500_000, fpQuotaPercent: 37,
        spendThisMonth: { amount: '48213.5000', currency: 'AED' },
        activeAlerts: 2, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(142), lastActivityAt: iso(4), subscriptionRenewsAt: isoDaysAhead(218),
        billingStatus: 'Current',
      },
      {
        tenantId: 'a0000000-0000-0000-0000-000000000002',
        tenantCode: 'ACME-CORP', legalName: 'Acme Corporation', displayName: 'Acme Corp',
        tierCode: 'PROFESSIONAL', tierName: 'Professional', status: 'Active',
        primaryCurrencyCode: 'USD', primaryLocale: 'en-US', primaryTimezone: 'America/New_York', region: 'North America',
        userCount: 22, agentCount: 20, integrationCount: 8,
        fpConsumedThisMonth: 28_912, fpQuotaMonthly: 50_000, fpQuotaPercent: 58,
        spendThisMonth: { amount: '6217.5000', currency: 'USD' },
        activeAlerts: 1, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(98), lastActivityAt: iso(12), subscriptionRenewsAt: isoDaysAhead(98),
        billingStatus: 'Current',
      },
      {
        tenantId: 'b0000000-0000-0000-0000-000000000003',
        tenantCode: 'GLOBEX', legalName: 'Globex Industries PLC', displayName: 'Globex Industries',
        tierCode: 'ENTERPRISE', tierName: 'Enterprise', status: 'Degraded',
        primaryCurrencyCode: 'GBP', primaryLocale: 'en-GB', primaryTimezone: 'Europe/London', region: 'Europe',
        userCount: 63, agentCount: 32, integrationCount: 18,
        fpConsumedThisMonth: 156_420, fpQuotaMonthly: 500_000, fpQuotaPercent: 31,
        spendThisMonth: { amount: '28142.2500', currency: 'GBP' },
        activeAlerts: 4, criticalAlerts: 1,
        onboardedAt: isoDaysAgo(312), lastActivityAt: iso(2), subscriptionRenewsAt: isoDaysAhead(52),
        billingStatus: 'Current',
      },
      {
        tenantId: 'c0000000-0000-0000-0000-000000000004',
        tenantCode: 'WAYNE', legalName: 'Wayne Enterprises Inc', displayName: 'Wayne Enterprises',
        tierCode: 'ENTERPRISE', tierName: 'Enterprise', status: 'Active',
        primaryCurrencyCode: 'USD', primaryLocale: 'en-US', primaryTimezone: 'America/Chicago', region: 'North America',
        userCount: 84, agentCount: 32, integrationCount: 22,
        fpConsumedThisMonth: 412_830, fpQuotaMonthly: 500_000, fpQuotaPercent: 83,
        spendThisMonth: { amount: '82450.7500', currency: 'USD' },
        activeAlerts: 0, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(428), lastActivityAt: iso(1), subscriptionRenewsAt: isoDaysAhead(12),
        billingStatus: 'Current',
      },
      {
        tenantId: 'd0000000-0000-0000-0000-000000000005',
        tenantCode: 'STARK', legalName: 'Stark Industries Ltd', displayName: 'Stark Industries',
        tierCode: 'PROFESSIONAL', tierName: 'Professional', status: 'Active',
        primaryCurrencyCode: 'USD', primaryLocale: 'en-US', primaryTimezone: 'America/Los_Angeles', region: 'North America',
        userCount: 18, agentCount: 18, integrationCount: 6,
        fpConsumedThisMonth: 11_420, fpQuotaMonthly: 50_000, fpQuotaPercent: 22,
        spendThisMonth: { amount: '3820.5000', currency: 'USD' },
        activeAlerts: 1, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(56), lastActivityAt: iso(18), subscriptionRenewsAt: isoDaysAhead(304),
        billingStatus: 'Current',
      },
      {
        tenantId: 'e0000000-0000-0000-0000-000000000006',
        tenantCode: 'UMBRELLA', legalName: 'Umbrella Biotech SARL', displayName: 'Umbrella Biotech',
        tierCode: 'STARTER', tierName: 'Starter', status: 'Onboarding',
        primaryCurrencyCode: 'EUR', primaryLocale: 'fr-FR', primaryTimezone: 'Europe/Paris', region: 'Europe',
        userCount: 3, agentCount: 5, integrationCount: 2,
        fpConsumedThisMonth: 840, fpQuotaMonthly: 5_000, fpQuotaPercent: 17,
        spendThisMonth: { amount: '320.0000', currency: 'EUR' },
        activeAlerts: 0, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(3), lastActivityAt: iso(32), subscriptionRenewsAt: isoDaysAhead(362),
        billingStatus: 'Trial',
      },
      {
        tenantId: 'f0000000-0000-0000-0000-000000000007',
        tenantCode: 'CYBERDYNE', legalName: 'Cyberdyne Systems KK', displayName: 'Cyberdyne Systems',
        tierCode: 'PROFESSIONAL', tierName: 'Professional', status: 'Active',
        primaryCurrencyCode: 'JPY', primaryLocale: 'ja-JP', primaryTimezone: 'Asia/Tokyo', region: 'Asia Pacific',
        userCount: 15, agentCount: 22, integrationCount: 9,
        fpConsumedThisMonth: 35_600, fpQuotaMonthly: 50_000, fpQuotaPercent: 71,
        spendThisMonth: { amount: '480000', currency: 'JPY' },
        activeAlerts: 3, criticalAlerts: 1,
        onboardedAt: isoDaysAgo(186), lastActivityAt: iso(6), subscriptionRenewsAt: isoDaysAhead(132),
        billingStatus: 'Grace_Period',
      },
      {
        tenantId: 'aa000000-0000-0000-0000-000000000008',
        tenantCode: 'INITECH', legalName: 'Initech LLC', displayName: 'Initech',
        tierCode: 'STARTER', tierName: 'Starter', status: 'Active',
        primaryCurrencyCode: 'USD', primaryLocale: 'en-US', primaryTimezone: 'America/New_York', region: 'North America',
        userCount: 7, agentCount: 10, integrationCount: 3,
        fpConsumedThisMonth: 2_145, fpQuotaMonthly: 5_000, fpQuotaPercent: 43,
        spendThisMonth: { amount: '380.0000', currency: 'USD' },
        activeAlerts: 1, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(74), lastActivityAt: iso(45), subscriptionRenewsAt: isoDaysAhead(286),
        billingStatus: 'Current',
      },
      {
        tenantId: 'bb000000-0000-0000-0000-000000000009',
        tenantCode: 'PIED-PIPER', legalName: 'Pied Piper Inc', displayName: 'Pied Piper',
        tierCode: 'PROFESSIONAL', tierName: 'Professional', status: 'Active',
        primaryCurrencyCode: 'USD', primaryLocale: 'en-US', primaryTimezone: 'America/Los_Angeles', region: 'North America',
        userCount: 11, agentCount: 16, integrationCount: 5,
        fpConsumedThisMonth: 23_480, fpQuotaMonthly: 50_000, fpQuotaPercent: 47,
        spendThisMonth: { amount: '4210.7500', currency: 'USD' },
        activeAlerts: 0, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(128), lastActivityAt: iso(8), subscriptionRenewsAt: isoDaysAhead(240),
        billingStatus: 'Current',
      },
      {
        tenantId: 'cc000000-0000-0000-0000-000000000010',
        tenantCode: 'HOOLI', legalName: 'Hooli Technologies', displayName: 'Hooli',
        tierCode: 'ENTERPRISE', tierName: 'Enterprise', status: 'Active',
        primaryCurrencyCode: 'USD', primaryLocale: 'en-US', primaryTimezone: 'America/Los_Angeles', region: 'North America',
        userCount: 72, agentCount: 32, integrationCount: 20,
        fpConsumedThisMonth: 385_920, fpQuotaMonthly: 500_000, fpQuotaPercent: 77,
        spendThisMonth: { amount: '72140.5000', currency: 'USD' },
        activeAlerts: 2, criticalAlerts: 1,
        onboardedAt: isoDaysAgo(502), lastActivityAt: iso(3), subscriptionRenewsAt: isoDaysAhead(168),
        billingStatus: 'Current',
      },
      {
        tenantId: 'dd000000-0000-0000-0000-000000000011',
        tenantCode: 'DUNDER-MIFFLIN', legalName: 'Dunder Mifflin Paper Company', displayName: 'Dunder Mifflin',
        tierCode: 'STARTER', tierName: 'Starter', status: 'Suspended',
        primaryCurrencyCode: 'USD', primaryLocale: 'en-US', primaryTimezone: 'America/New_York', region: 'North America',
        userCount: 5, agentCount: 10, integrationCount: 2,
        fpConsumedThisMonth: 0, fpQuotaMonthly: 5_000, fpQuotaPercent: 0,
        spendThisMonth: { amount: '0.0000', currency: 'USD' },
        activeAlerts: 0, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(210), lastActivityAt: iso(1440), subscriptionRenewsAt: null,
        billingStatus: 'Overdue',
      },
      {
        tenantId: 'ee000000-0000-0000-0000-000000000012',
        tenantCode: 'MASSIVE-DYN', legalName: 'Massive Dynamic GmbH', displayName: 'Massive Dynamic',
        tierCode: 'ENTERPRISE', tierName: 'Enterprise', status: 'Active',
        primaryCurrencyCode: 'EUR', primaryLocale: 'de-DE', primaryTimezone: 'Europe/Berlin', region: 'Europe',
        userCount: 58, agentCount: 30, integrationCount: 16,
        fpConsumedThisMonth: 298_420, fpQuotaMonthly: 500_000, fpQuotaPercent: 60,
        spendThisMonth: { amount: '52180.2500', currency: 'EUR' },
        activeAlerts: 5, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(672), lastActivityAt: iso(2), subscriptionRenewsAt: isoDaysAhead(4),
        billingStatus: 'Current',
      },
      {
        tenantId: 'ff000000-0000-0000-0000-000000000013',
        tenantCode: 'WONKA', legalName: 'Wonka Industries Ltd', displayName: 'Wonka Industries',
        tierCode: 'PROFESSIONAL', tierName: 'Professional', status: 'Active',
        primaryCurrencyCode: 'GBP', primaryLocale: 'en-GB', primaryTimezone: 'Europe/London', region: 'Europe',
        userCount: 24, agentCount: 22, integrationCount: 10,
        fpConsumedThisMonth: 38_210, fpQuotaMonthly: 50_000, fpQuotaPercent: 76,
        spendThisMonth: { amount: '7120.0000', currency: 'GBP' },
        activeAlerts: 2, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(84), lastActivityAt: iso(15), subscriptionRenewsAt: isoDaysAhead(281),
        billingStatus: 'Current',
      },
      {
        tenantId: 'gg000000-0000-0000-0000-000000000014',
        tenantCode: 'VEHEMENT', legalName: 'Vehement Capital Partners', displayName: 'Vehement Capital',
        tierCode: 'ENTERPRISE', tierName: 'Enterprise', status: 'Onboarding',
        primaryCurrencyCode: 'SGD', primaryLocale: 'en-SG', primaryTimezone: 'Asia/Singapore', region: 'Asia Pacific',
        userCount: 12, agentCount: 15, integrationCount: 4,
        fpConsumedThisMonth: 8_420, fpQuotaMonthly: 500_000, fpQuotaPercent: 2,
        spendThisMonth: { amount: '2180.5000', currency: 'SGD' },
        activeAlerts: 0, criticalAlerts: 0,
        onboardedAt: isoDaysAgo(8), lastActivityAt: iso(22), subscriptionRenewsAt: isoDaysAhead(357),
        billingStatus: 'Trial',
      },
      {
        tenantId: 'hh000000-0000-0000-0000-000000000015',
        tenantCode: 'OCEANIC', legalName: 'Oceanic Airlines PJSC', displayName: 'Oceanic Airlines',
        tierCode: 'ENTERPRISE', tierName: 'Enterprise', status: 'Active',
        primaryCurrencyCode: 'AED', primaryLocale: 'en-AE', primaryTimezone: 'Asia/Dubai', region: 'UAE',
        userCount: 94, agentCount: 32, integrationCount: 24,
        fpConsumedThisMonth: 462_180, fpQuotaMonthly: 500_000, fpQuotaPercent: 92,
        spendThisMonth: { amount: '124820.7500', currency: 'AED' },
        activeAlerts: 7, criticalAlerts: 2,
        onboardedAt: isoDaysAgo(392), lastActivityAt: iso(1), subscriptionRenewsAt: isoDaysAhead(78),
        billingStatus: 'Current',
      },
    ];
  }

  #toParams(query: TenantListQuery): HttpParams {
    let params = new HttpParams()
      .set('limit', query.limit.toString())
      .set('offset', query.offset.toString());
    if (query.sort) {
      params = params.set('sort', `${query.sort.field},${query.sort.direction}`);
    }
    if (query.filters) {
      query.filters.status?.forEach(s => { params = params.append('status', s); });
      query.filters.tierCode?.forEach(t => { params = params.append('tierCode', t); });
      query.filters.region?.forEach(r => { params = params.append('region', r); });
      query.filters.billingStatus?.forEach(b => { params = params.append('billingStatus', b); });
      if (query.filters.search) params = params.set('q', query.filters.search);
    }
    return params;
  }
}
