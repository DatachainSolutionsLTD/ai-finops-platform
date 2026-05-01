// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Onboarding Wizard Service.
// Location: apps/frontend/src/app/features/onboarding/onboarding.service.ts
// Follows 05_API_Conventions.md §11 service pattern.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, map, catchError, throwError } from 'rxjs';
import type { SingleResponse } from '@shared/types/envelope.types';
import type {
  OnboardingDraft,
  OnboardingSubmitResponse,
  TenantCodeAvailability,
} from '@shared/types/onboarding.types';
import { ErrorService } from '@shared/services/error.service';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  readonly #http = inject(HttpClient);
  readonly #errors = inject(ErrorService);
  readonly #apiBase = `${environment.apiBaseUrl}/onboarding`;

  // Mock in-memory draft store (remove when backend is ready)
  #mockDraft: OnboardingDraft | null = null;

  /**
   * Load or create a draft for the current user.
   *
   * Real API:
   *   return this.#http
   *     .get<SingleResponse<OnboardingDraft>>(`${this.#apiBase}/draft`)
   *     .pipe(map(r => r.data), catchError(e => this.#errors.handle(e)));
   */
  getOrCreateDraft(): Observable<OnboardingDraft> {
    if (!this.#mockDraft) {
      this.#mockDraft = {
        draftId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStep: 'organization',
        completedSteps: [],
      };
    }
    return of({ ...this.#mockDraft }).pipe(delay(250));
  }

  /**
   * Save draft state (auto-called on step advance, manual save, or dirty timeout).
   *
   * Real API:
   *   return this.#http
   *     .patch<SingleResponse<OnboardingDraft>>(`${this.#apiBase}/draft/${draft.draftId}`, draft)
   *     .pipe(map(r => r.data), catchError(e => this.#errors.handle(e)));
   */
  saveDraft(draft: OnboardingDraft): Observable<OnboardingDraft> {
    this.#mockDraft = { ...draft, updatedAt: new Date().toISOString() };
    return of({ ...this.#mockDraft }).pipe(delay(200));
  }

  /**
   * Discard the draft entirely (Cancel button at wizard level).
   *
   * Real API:
   *   return this.#http
   *     .delete<void>(`${this.#apiBase}/draft/${draftId}`)
   *     .pipe(catchError(e => this.#errors.handle(e)));
   */
  discardDraft(draftId: string): Observable<void> {
    this.#mockDraft = null;
    return of(undefined).pipe(delay(200));
  }

  /**
   * Submit finalized wizard state to provision the tenant.
   *
   * Real API (per 05 §8.2 Idempotency-Key required):
   *   return this.#http
   *     .post<SingleResponse<OnboardingSubmitResponse>>(
   *       `${this.#apiBase}/submit`,
   *       draft,
   *       { headers: { 'Idempotency-Key': crypto.randomUUID() } },
   *     )
   *     .pipe(map(r => r.data), catchError(e => this.#errors.handle(e)));
   */
  submit(draft: OnboardingDraft): Observable<OnboardingSubmitResponse> {
    // Mock: pretend provisioning takes 45s
    const result: OnboardingSubmitResponse = {
      tenantId: crypto.randomUUID(),
      tenantCode: draft.organization?.tenantCode ?? 'NEW-TENANT',
      provisioningJobId: crypto.randomUUID(),
      estimatedCompletionSeconds: 45,
      status: 'Provisioning',
    };
    this.#mockDraft = null;
    return of(result).pipe(delay(1200));
  }

  /**
   * Check whether a proposed tenant code is available.
   * Debounced in the component (don't call on every keystroke).
   *
   * Real API:
   *   return this.#http
   *     .get<SingleResponse<TenantCodeAvailability>>(
   *       `${this.#apiBase}/tenant-code/check`, { params: { code } },
   *     )
   *     .pipe(map(r => r.data), catchError(e => this.#errors.handle(e)));
   */
  checkTenantCodeAvailability(code: string): Observable<TenantCodeAvailability> {
    const normalized = code.toUpperCase().trim();
    const taken = ['DEMO-TENANT', 'ACME-CORP', 'GLOBEX', 'WAYNE', 'HOOLI'];
    const result: TenantCodeAvailability = taken.includes(normalized)
      ? {
          code: normalized,
          available: false,
          reason: 'This tenant code is already in use.',
          suggestions: [`${normalized}-1`, `${normalized}-2`, `NEW-${normalized}`],
        }
      : { code: normalized, available: true };
    return of(result).pipe(delay(400));
  }
}
