// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/platform/tenants/tenant-detail.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type TenantDetail, type TenantDetailPatch } from '@shared/types/tenant-detail.types';
import { environment } from '@env/environment';

const MOCK: TenantDetail = {
  tenantId:                'ten-001',
  tenantCode:              'ACME-AE',
  displayName:             'Acme Corporation',
  legalName:               'Acme Corporation LLC',
  industry:                'Financial Services',
  status:                  'Active',
  tierCode:                'Enterprise',
  billingStatus:           'Current',
  primaryCurrencyCode:     'AED',
  dataResidencyRegion:     'me-central-1',
  onboardedAt:             '2024-02-01T08:00:00Z',
  subscriptionRenewsAt:    '2026-01-31T23:59:00Z',
  billingContactEmail:     'billing@acme.ae',
  billingContactPhone:     '+971-4-000-0001',
  technicalContactEmail:   'devops@acme.ae',
  technicalContactPhone:   '+971-4-000-0002',
  maxUsers:                200,
  maxConnectors:           20,
  storageQuotaGb:          5000,
  fpQuotaMonthly:          1000000,
  agentAutonomyCeiling:    'L4',
  anomalyAlertSensitivity: 'High',
  autoRemediationEnabled:  true,
  dataRetentionPeriod:     '2y',
  spendThisMonth:          { amount: 1_482_340, currency: 'AED' },
  userCount:               87,
  activeConnectors:        12,
  criticalAlerts:          2,
  lastActivityAt:          new Date(Date.now() - 1_800_000).toISOString(),
  etag:                    'etag-ten-001-v8',
};

@Injectable({ providedIn: 'root' })
export class TenantDetailService {
  readonly #http = inject(HttpClient);

  // SWAP TO REAL: return this.#http.get<TenantDetail>(`${environment.apiUrl}/platform/tenants/${tenantId}`)
  get(tenantId: string): Observable<TenantDetail> {
    return of({ ...MOCK, tenantId }).pipe(delay(600));
  }

  // SWAP TO REAL: return this.#http.patch<TenantDetail>(`${environment.apiUrl}/platform/tenants/${tenantId}`, patch, { headers: { 'If-Match': etag } })
  update(tenantId: string, patch: TenantDetailPatch, etag: string): Observable<TenantDetail> {
    return of({ ...MOCK, ...patch, etag: 'etag-ten-001-v9' }).pipe(delay(700));
  }

  // SWAP TO REAL: return this.#http.post<void>(`${environment.apiUrl}/platform/tenants/${tenantId}/suspend`, {})
  suspend(tenantId: string): Observable<void> {
    return of(undefined as void).pipe(delay(600));
  }
}
