// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// ErrorService — converts RFC 7807 problem details into user-facing feedback.
// Location: apps/frontend/src/app/shared/services/error.service.ts
//
// Per 05_API_Conventions.md §6. Every service's catchError pipeline passes
// errors through this service to ensure consistent user-facing behavior:
//   - 400 / 422: inline field errors via the returned ProblemDetails
//   - 401: handled by AuthInterceptor (refresh-then-retry), never reaches here
//   - 403: toast with detail, no redirect
//   - 404: returned as a typed error for the component to handle
//   - 409: toast with detail (component may also handle for ETag conflicts)
//   - 429: toast with retry-after hint
//   - 5xx: generic error toast with correlationId for support
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastController } from '@ionic/angular/standalone';
import { Observable, throwError } from 'rxjs';

import type { ProblemDetails, ValidationError } from '@shared/types/envelope.types';

/**
 * Normalized error shape surfaced to components. Components can pattern-match
 * on `status` for specific handling (409 conflict, 422 business rule, etc.)
 * and read `validationErrors` to display inline field errors.
 */
export interface NormalizedError {
  status: number;
  title: string;
  detail?: string;
  correlationId?: string;
  validationErrors?: ValidationError[];
  /** Raw problem details for consumers that want them. */
  problemDetails?: ProblemDetails;
}

@Injectable({ providedIn: 'root' })
export class ErrorService {
  readonly #toastCtrl = inject(ToastController);

  /**
   * Default handler for service catchError pipelines.
   *
   * Usage:
   *   return this.http.get<...>(...).pipe(
   *     catchError(err => this.errorService.handle(err))
   *   );
   *
   * The returned observable is a throwError with the normalized shape, so
   * components can subscribe to the error branch and handle specifics.
   */
  handle(err: unknown): Observable<never> {
    const normalized = this.normalize(err);
    this.#showToastIfAppropriate(normalized);
    return throwError(() => normalized);
  }

  /**
   * Normalize an HttpErrorResponse (or other error) into the standard shape.
   * Exposed publicly so components can call it for manual error handling.
   */
  normalize(err: unknown): NormalizedError {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as Partial<ProblemDetails> | null;

      return {
        status: err.status,
        title: body?.title ?? this.#defaultTitleForStatus(err.status),
        detail: body?.detail,
        correlationId: body?.correlationId,
        validationErrors: body?.errors,
        problemDetails: body && typeof body === 'object' && 'type' in body
          ? body as ProblemDetails
          : undefined,
      };
    }

    // Unknown error shape (network error, typo, etc.)
    if (err && typeof err === 'object' && 'message' in err) {
      return {
        status: 0,
        title: String((err as { message: unknown }).message) || 'Unexpected error',
      };
    }

    return {
      status: 0,
      title: 'Unexpected error',
    };
  }

  #defaultTitleForStatus(status: number): string {
    switch (status) {
      case 400: return 'Invalid request';
      case 403: return 'Permission denied';
      case 404: return 'Not found';
      case 409: return 'Conflict';
      case 422: return 'Action not allowed';
      case 429: return 'Too many requests';
      case 0:   return 'Connection error';
      default:
        if (status >= 500) return 'Server error';
        return 'Error';
    }
  }

  async #showToastIfAppropriate(err: NormalizedError): Promise<void> {
    // Don't toast for validation errors — those show inline on the form.
    if (err.status === 400 || err.status === 422) return;

    // Don't toast 404s — components show empty states instead.
    if (err.status === 404) return;

    // Don't toast 409s — components handle these contextually (ETag conflicts, etc.)
    if (err.status === 409) return;

    const message = err.detail ? `${err.title}: ${err.detail}` : err.title;

    const color = err.status >= 500 || err.status === 0 ? 'danger'
                : err.status === 403                      ? 'warning'
                : err.status === 429                      ? 'warning'
                : 'medium';

    const toast = await this.#toastCtrl.create({
      message: err.correlationId
        ? `${message} (ref: ${err.correlationId.slice(0, 8)})`
        : message,
      duration: 4000,
      position: 'top',
      color,
    });
    await toast.present();
  }
}
