// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Platform Health Service.
// Location: apps/frontend/src/app/features/platform/health/platform-health.service.ts
//
// This file follows the service pattern from 05_API_Conventions.md §11.
// The implementation currently returns mock data for the reference screen —
// swap the inner `of(...)` body for `this.http.get<SingleResponse<T>>(...)`
// when wiring to the real backend.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, map, catchError } from 'rxjs';
import type { SingleResponse, ListResponse } from '@shared/types/envelope.types';
import type {
  PlatformHealthOverview,
  ActiveTenantRow,
  TimeRange,
} from '@shared/types/platform-health.types';
import { ErrorService } from '@shared/services/error.service';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class PlatformHealthService {
  readonly #http = inject(HttpClient);
  readonly #errors = inject(ErrorService);
  readonly #apiBase = `${environment.apiBaseUrl}/platform/health`;

  // When backend is ready, uncomment and remove mock body:
  //
  //   return this.#http
  //     .get<SingleResponse<PlatformHealthOverview>>(
  //       `${this.#apiBase}/overview`,
  //       { params: { range } })
  //     .pipe(map(r => r.data), catchError(e => this.#errors.handle(e)));

  getOverview(range: TimeRange): Observable<PlatformHealthOverview> {
    return of(this.#mockOverview(range)).pipe(delay(350));
  }

  getActiveTenants(range: TimeRange): Observable<ActiveTenantRow[]> {
    return of(this.#mockTenants()).pipe(delay(450));
  }

  // ── Mock data generation (remove when backend is wired) ──────────────────

  #mockOverview(range: TimeRange): PlatformHealthOverview {
    const now = new Date();
    const buckets = this.#buildTrendBuckets(range, now);
    return {
      generatedAt: now.toISOString(),
      timeRange: range,
      kpis: {
        activeTenants: {
          value: 47,
          deltaPercent: 6.8,
          deltaDirection: 'up',
          sparkline: [38, 40, 41, 43, 44, 45, 47],
        },
        fpProcessedToday: {
          value: 184_523,
          deltaPercent: 12.4,
          deltaDirection: 'up',
          sparkline: [142000, 158000, 151000, 163000, 171000, 178000, 184523],
        },
        platformSloPercent: {
          value: 99.92,
          deltaPercent: 0.04,
          deltaDirection: 'up',
          sparkline: [99.82, 99.85, 99.88, 99.91, 99.90, 99.93, 99.92],
        },
        criticalAlertsOpen: {
          value: 3,
          deltaPercent: -40,
          deltaDirection: 'down',
          sparkline: [8, 7, 5, 6, 5, 4, 3],
        },
      },
      narrative: {
        content:
          'Platform health is within target bands across all service categories. ' +
          'FP throughput climbed 12 percent week-over-week, driven mainly by three ' +
          'new Enterprise tenants that completed onboarding on Monday. Critical ' +
          'alerts decreased from 5 to 3 as yesterday\u2019s ingestion lag for ' +
          'tenant Demo Tenant resolved after the connector retry window. SLO is ' +
          'comfortably above the 99.9 percent target with no degradation expected ' +
          'in the next 24 hours.',
        sourceAgentCode: 'A29',
        sourceAgentName: 'Explainability Agent',
        generatedAt: now.toISOString(),
      },
      fpTrend: buckets.map((b, i) => ({
        periodStart: b.toISOString(),
        fpProcessed: 140_000 + i * 4800 + Math.round(Math.random() * 8000),
        fpBilled: 125_000 + i * 4200 + Math.round(Math.random() * 6000),
      })),
      fpByAgentCategory: [
        { category: 'Understand',  fpProcessed: 58_420, agentCount: 5 },
        { category: 'Quantify',    fpProcessed: 31_980, agentCount: 4 },
        { category: 'Optimize',    fpProcessed: 47_210, agentCount: 9 },
        { category: 'Manage',      fpProcessed: 22_840, agentCount: 6 },
        { category: 'Coordinate',  fpProcessed: 15_673, agentCount: 5 },
        { category: 'Foundation',  fpProcessed:  8_400, agentCount: 3 },
      ],
      tenantTierDistribution: [
        { tierCode: 'STARTER',      tierName: 'Starter',      tenantCount: 18 },
        { tierCode: 'PROFESSIONAL', tierName: 'Professional', tenantCount: 21 },
        { tierCode: 'ENTERPRISE',   tierName: 'Enterprise',   tenantCount:  8 },
      ],
      sloSummary: {
        overallPercent: 99.92,
        targetPercent: 99.9,
        ingestionPercent: 99.87,
        apiPercent: 99.98,
        agentExecutionPercent: 99.91,
      },
    };
  }

  #mockTenants(): ActiveTenantRow[] {
    const now = new Date();
    const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();
    return [
      { tenantId: '33333333-3333-3333-3333-333333333333', tenantCode: 'DEMO-TENANT',    displayName: 'Demo Tenant',           tierCode: 'ENTERPRISE',   tierName: 'Enterprise',   status: 'Active',      fpProcessedToday: 18_420, fpQuotaPercent: 42, spendThisPeriod: { amount: '48213.5000', currency: 'AED' }, activeAlerts: 2, criticalAlerts: 0, lastActivityAt: ago(4) },
      { tenantId: 'a0000000-0000-0000-0000-000000000002', tenantCode: 'ACME-CORP',      displayName: 'Acme Corp',             tierCode: 'PROFESSIONAL', tierName: 'Professional', status: 'Active',      fpProcessedToday: 12_104, fpQuotaPercent: 58, spendThisPeriod: { amount: '22840.0000', currency: 'AED' }, activeAlerts: 1, criticalAlerts: 0, lastActivityAt: ago(12) },
      { tenantId: 'b0000000-0000-0000-0000-000000000003', tenantCode: 'GLOBEX',         displayName: 'Globex Industries',     tierCode: 'ENTERPRISE',   tierName: 'Enterprise',   status: 'Degraded',    fpProcessedToday:  9_842, fpQuotaPercent: 31, spendThisPeriod: { amount: '34192.2500', currency: 'AED' }, activeAlerts: 4, criticalAlerts: 1, lastActivityAt: ago(2) },
      { tenantId: 'c0000000-0000-0000-0000-000000000004', tenantCode: 'WAYNE',          displayName: 'Wayne Enterprises',     tierCode: 'ENTERPRISE',   tierName: 'Enterprise',   status: 'Active',      fpProcessedToday: 21_530, fpQuotaPercent: 67, spendThisPeriod: { amount: '61205.7500', currency: 'AED' }, activeAlerts: 0, criticalAlerts: 0, lastActivityAt: ago(1) },
      { tenantId: 'd0000000-0000-0000-0000-000000000005', tenantCode: 'STARK',          displayName: 'Stark Industries',      tierCode: 'PROFESSIONAL', tierName: 'Professional', status: 'Active',      fpProcessedToday:  7_812, fpQuotaPercent: 22, spendThisPeriod: { amount: '14280.5000', currency: 'AED' }, activeAlerts: 1, criticalAlerts: 0, lastActivityAt: ago(18) },
      { tenantId: 'e0000000-0000-0000-0000-000000000006', tenantCode: 'UMBRELLA',       displayName: 'Umbrella Biotech',      tierCode: 'STARTER',      tierName: 'Starter',      status: 'Onboarding',  fpProcessedToday:    840, fpQuotaPercent:  8, spendThisPeriod: { amount: '1250.0000',  currency: 'AED' }, activeAlerts: 0, criticalAlerts: 0, lastActivityAt: ago(32) },
      { tenantId: 'f0000000-0000-0000-0000-000000000007', tenantCode: 'CYBERDYNE',      displayName: 'Cyberdyne Systems',     tierCode: 'PROFESSIONAL', tierName: 'Professional', status: 'Active',      fpProcessedToday: 14_205, fpQuotaPercent: 71, spendThisPeriod: { amount: '28420.5000', currency: 'AED' }, activeAlerts: 3, criticalAlerts: 1, lastActivityAt: ago(6) },
      { tenantId: 'aa000000-0000-0000-0000-000000000008', tenantCode: 'INITECH',        displayName: 'Initech',               tierCode: 'STARTER',      tierName: 'Starter',      status: 'Active',      fpProcessedToday:  2_145, fpQuotaPercent: 18, spendThisPeriod: { amount: '3820.0000',  currency: 'AED' }, activeAlerts: 1, criticalAlerts: 0, lastActivityAt: ago(45) },
      { tenantId: 'bb000000-0000-0000-0000-000000000009', tenantCode: 'PIED-PIPER',     displayName: 'Pied Piper',            tierCode: 'PROFESSIONAL', tierName: 'Professional', status: 'Active',      fpProcessedToday: 11_480, fpQuotaPercent: 49, spendThisPeriod: { amount: '19420.7500', currency: 'AED' }, activeAlerts: 0, criticalAlerts: 0, lastActivityAt: ago(8) },
      { tenantId: 'cc000000-0000-0000-0000-000000000010', tenantCode: 'HOOLI',          displayName: 'Hooli',                 tierCode: 'ENTERPRISE',   tierName: 'Enterprise',   status: 'Active',      fpProcessedToday: 19_870, fpQuotaPercent: 53, spendThisPeriod: { amount: '52140.5000', currency: 'AED' }, activeAlerts: 2, criticalAlerts: 1, lastActivityAt: ago(3) },
      { tenantId: 'dd000000-0000-0000-0000-000000000011', tenantCode: 'DUNDER-MIFFLIN', displayName: 'Dunder Mifflin',        tierCode: 'STARTER',      tierName: 'Starter',      status: 'Suspended',   fpProcessedToday:      0, fpQuotaPercent:  0, spendThisPeriod: { amount: '0.0000',     currency: 'AED' }, activeAlerts: 0, criticalAlerts: 0, lastActivityAt: ago(1440) },
      { tenantId: 'ee000000-0000-0000-0000-000000000012', tenantCode: 'MASSIVE-DYN',    displayName: 'Massive Dynamic',       tierCode: 'ENTERPRISE',   tierName: 'Enterprise',   status: 'Active',      fpProcessedToday: 23_120, fpQuotaPercent: 78, spendThisPeriod: { amount: '68420.2500', currency: 'AED' }, activeAlerts: 5, criticalAlerts: 0, lastActivityAt: ago(2) },
    ];
  }

  #buildTrendBuckets(range: TimeRange, now: Date): Date[] {
    const bucketCount = range === '24h' ? 24 : range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 12 : 12;
    const stepMs = range === '24h' ? 3_600_000 : range === '7d' ? 86_400_000 : range === '30d' ? 86_400_000 : 7 * 86_400_000;
    return Array.from({ length: bucketCount }, (_, i) =>
      new Date(now.getTime() - (bucketCount - 1 - i) * stepMs),
    );
  }
}
