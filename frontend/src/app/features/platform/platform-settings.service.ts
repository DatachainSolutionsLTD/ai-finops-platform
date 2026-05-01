// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/platform/settings/platform-settings.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type PlatformSettings, type PlatformSettingsPatch } from '@shared/types/platform-settings.types';
import { environment } from '@env/environment';

const MOCK_SETTINGS: PlatformSettings = {
  platformId:           'plt-prod-001',
  platformVersion:      '3.2.1',
  deploymentRegion:     'me-central-1',
  deployedAt:           '2024-01-10T08:00:00Z',
  platformName:         'FinOps Platform',
  platformUrl:          'https://finops.company.ae',
  supportEmail:         'finops-support@company.ae',
  maxTenantsAllowed:    50,
  globalAutonomyCeiling: 'L4',
  defaultRetryLimit:    3,
  defaultRetryBackoffSec: 120,
  dataRetentionPeriod:  '1y',
  enableAuditLog:       true,
  auditLogRetentionDays: 365,
  enforceGlobalMfa:     false,
  sessionTimeoutMinutes: 60,
  maxConcurrentSessionsPerUser: 3,
  passwordMinLength:    12,
  allowedIpRanges:      '10.0.0.0/8\n192.168.0.0/16',
  alertEmailEnabled:    true,
  alertEmailFrom:       'alerts@finops.company.ae',
  alertWebhookUrl:      'https://hooks.company.ae/finops-alerts',
  maintenanceMode:      'Off',
  maintenanceMessage:   '',
  etag:                 'etag-settings-v12',
};

@Injectable({ providedIn: 'root' })
export class PlatformSettingsService {
  readonly #http = inject(HttpClient);

  // SWAP TO REAL: return this.#http.get<PlatformSettings>(`${environment.apiUrl}/platform/settings`)
  get(): Observable<PlatformSettings> {
    return of(MOCK_SETTINGS).pipe(delay(600));
  }

  // SWAP TO REAL: return this.#http.patch<PlatformSettings>(`${environment.apiUrl}/platform/settings`, patch, { headers: { 'If-Match': etag } })
  update(patch: PlatformSettingsPatch, etag: string): Observable<PlatformSettings> {
    return of({ ...MOCK_SETTINGS, ...patch, etag: 'etag-settings-v13' }).pipe(delay(700));
  }
}
