// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/platform/users/platform-users.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';

import {
  type PlatformUserListQuery,
  type PlatformUserListResponse,
  type PlatformUserListSummary,
  type CreatePlatformUserDto,
} from '@shared/types/platform-users.types';
import { environment } from '@env/environment';
import { ErrorService } from '@core/errors/error.service';
import { catchError } from 'rxjs/operators';

// ── Mock data ────────────────────────────────────────────────────────────────
// SWAP TO REAL: replace mock$ returns with http.get<T>(...) calls.
const MOCK_USERS: PlatformUserListResponse = {
  data: [
    { userId: 'u-001', email: 'ahmed.hassan@company.ae',    displayName: 'Ahmed Hassan',    avatarInitials: 'AH', role: 'Platform_Admin',  status: 'Active',      mfaStatus: 'Enabled',  tenantCount: 12, lastLoginAt: new Date(Date.now() - 1_800_000).toISOString(),  createdAt: '2024-01-10T08:00:00Z' },
    { userId: 'u-002', email: 'sara.ali@company.ae',         displayName: 'Sara Ali',         avatarInitials: 'SA', role: 'FinOps_Analyst',  status: 'Active',      mfaStatus: 'Enabled',  tenantCount: 8,  lastLoginAt: new Date(Date.now() - 3_600_000).toISOString(),  createdAt: '2024-02-14T09:15:00Z' },
    { userId: 'u-003', email: 'omar.khalid@company.ae',      displayName: 'Omar Khalid',      avatarInitials: 'OK', role: 'Tenant_Admin',    status: 'Active',      mfaStatus: 'Disabled', tenantCount: 3,  lastLoginAt: new Date(Date.now() - 86_400_000).toISOString(), createdAt: '2024-03-01T10:30:00Z' },
    { userId: 'u-004', email: 'layla.mansoor@company.ae',    displayName: 'Layla Mansoor',    avatarInitials: 'LM', role: 'Executive',       status: 'Active',      mfaStatus: 'Enforced', tenantCount: 1,  lastLoginAt: new Date(Date.now() - 7_200_000).toISOString(),  createdAt: '2024-01-20T11:00:00Z' },
    { userId: 'u-005', email: 'rashed.ibrahim@company.ae',   displayName: 'Rashed Ibrahim',   avatarInitials: 'RI', role: 'FinOps_Analyst',  status: 'Invited',     mfaStatus: 'Disabled', tenantCount: 0,  lastLoginAt: null,                                             createdAt: '2025-04-10T13:00:00Z' },
    { userId: 'u-006', email: 'nour.abdulla@company.ae',     displayName: 'Nour Abdulla',     avatarInitials: 'NA', role: 'Read_Only',       status: 'Active',      mfaStatus: 'Disabled', tenantCount: 5,  lastLoginAt: new Date(Date.now() - 172_800_000).toISOString(),createdAt: '2024-06-01T08:45:00Z' },
    { userId: 'u-007', email: 'khalid.salem@company.ae',     displayName: 'Khalid Salem',     avatarInitials: 'KS', role: 'Platform_Admin',  status: 'Suspended',   mfaStatus: 'Enabled',  tenantCount: 4,  lastLoginAt: new Date(Date.now() - 1_209_600_000).toISOString(),createdAt:'2023-12-01T07:00:00Z' },
    { userId: 'u-008', email: 'fatima.jaber@company.ae',     displayName: 'Fatima Jaber',     avatarInitials: 'FJ', role: 'Tenant_Admin',    status: 'Active',      mfaStatus: 'Enabled',  tenantCount: 2,  lastLoginAt: new Date(Date.now() - 900_000).toISOString(),    createdAt: '2024-08-15T10:00:00Z' },
    { userId: 'u-009', email: 'majid.nasser@company.ae',     displayName: 'Majid Nasser',     avatarInitials: 'MN', role: 'FinOps_Analyst',  status: 'Deactivated', mfaStatus: 'Disabled', tenantCount: 0,  lastLoginAt: new Date(Date.now() - 5_184_000_000).toISOString(),createdAt:'2023-10-01T09:00:00Z' },
    { userId: 'u-010', email: 'hessa.almaktoum@company.ae',  displayName: 'Hessa Al Maktoum', avatarInitials: 'HM', role: 'Executive',       status: 'Active',      mfaStatus: 'Enforced', tenantCount: 1,  lastLoginAt: new Date(Date.now() - 10_800_000).toISOString(), createdAt: '2024-04-05T12:00:00Z' },
  ],
  pagination: { total: 10, page: 0, limit: 20 },
};

const MOCK_SUMMARY: PlatformUserListSummary = {
  totalUsers:     10,
  activeUsers:    7,
  pendingInvites: 1,
  suspendedUsers: 1,
  mfaAdoptionPct: 60,
};

@Injectable({ providedIn: 'root' })
export class PlatformUsersService {
  readonly #http = inject(HttpClient);
  readonly #errors = inject(ErrorService);

  // SWAP TO REAL: return this.#http.get<PlatformUserListResponse>(`${environment.apiUrl}/platform/users`, { params })
  list(query: PlatformUserListQuery): Observable<PlatformUserListResponse> {
    return of(MOCK_USERS).pipe(delay(600));
  }

  // SWAP TO REAL: return this.#http.get<PlatformUserListSummary>(`${environment.apiUrl}/platform/users/summary`)
  summary(): Observable<PlatformUserListSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }

  // SWAP TO REAL: return this.#http.post<void>(`${environment.apiUrl}/platform/users/invite`, dto)
  invite(dto: CreatePlatformUserDto): Observable<void> {
    return of(undefined as void).pipe(delay(800));
  }

  // SWAP TO REAL: return this.#http.patch<void>(`${environment.apiUrl}/platform/users/${userId}/suspend`, {})
  suspend(userId: string): Observable<void> {
    return of(undefined as void).pipe(delay(600));
  }

  // SWAP TO REAL: return this.#http.delete<void>(`${environment.apiUrl}/platform/users/${userId}`)
  deactivate(userId: string): Observable<void> {
    return of(undefined as void).pipe(delay(600));
  }

  // SWAP TO REAL: return this.#http.post<void>(`${environment.apiUrl}/platform/users/${userId}/reinvite`, {})
  resendInvite(userId: string): Observable<void> {
    return of(undefined as void).pipe(delay(500));
  }
}
