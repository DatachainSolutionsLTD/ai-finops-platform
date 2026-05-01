// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// MfaComponent — 6-digit code verification after successful password entry.
// Location: apps/frontend/src/app/features/auth/mfa/mfa.component.ts
//
// Flow:
//   1. User arrives with challengeId passed via router state (from login)
//   2. Enters 6-digit code
//   3. Call AuthService.verifyMfa()
//   4. On success: navigate to returnUrl or /
//   5. On failure: show error, allow retry
//   6. Challenge expires after ~5 min — countdown visible
//   7. If expired: offer "Start over" link back to login
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewChild,
  ElementRef,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';

import { interval, map, takeWhile } from 'rxjs';

import { AuthLayoutComponent } from '../shared/auth-layout.component';
import { AuthService } from '@core/auth/auth.service';

interface MfaNavigationState {
  challengeId: string;
  method: 'TOTP' | 'SMS' | 'Email';
  expiresAt: string;
  returnUrl: string | null;
}

@Component({
  selector: 'app-mfa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
    AuthLayoutComponent,
  ],
  templateUrl: './mfa.component.html',
  styleUrl: './mfa.component.scss',
})
export class MfaComponent implements OnInit {
  readonly #fb = inject(FormBuilder);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #title = inject(Title);
  readonly #destroyRef = inject(DestroyRef);

  constructor() {
    this.#title.setTitle('Verify your identity · FinOps');
  }

  // ── State ────────────────────────────────────────────────────────────────
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly secondsRemaining = signal<number>(300);
  readonly challengeData = signal<MfaNavigationState | null>(null);

  // ── Form ─────────────────────────────────────────────────────────────────
  readonly form = this.#fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly canSubmit = computed(() =>
    !this.isSubmitting() &&
    this.secondsRemaining() > 0 &&
    this.form.valid,
  );

  readonly methodLabel = computed(() => {
    const data = this.challengeData();
    if (!data) return '';
    switch (data.method) {
      case 'TOTP':  return 'your authenticator app';
      case 'SMS':   return 'the text message sent to your phone';
      case 'Email': return 'the email sent to your inbox';
      default:      return 'your verification method';
    }
  });

  readonly formattedTimer = computed(() => {
    const total = this.secondsRemaining();
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  readonly hasExpired = computed(() => this.secondsRemaining() === 0);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Read challenge data from navigation state (passed by login component)
    const state = history.state as MfaNavigationState | null;
    if (!state?.challengeId) {
      // No challenge data — bounce back to login
      this.#router.navigate(['/login']);
      return;
    }
    this.challengeData.set(state);

    // Start countdown based on challenge expiry
    const expiresAt = new Date(state.expiresAt).getTime();
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      this.secondsRemaining.set(remaining);
    };
    updateTimer();
    interval(1000)
      .pipe(
        map(() => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))),
        takeWhile(s => s >= 0, true),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe(s => this.secondsRemaining.set(s));
  }

  // ── Event handlers ───────────────────────────────────────────────────────
  submit() {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    const data = this.challengeData();
    if (!data) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.#auth.verifyMfa({
      challengeId: data.challengeId,
      code: this.form.value.code!,
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        const returnUrl = data.returnUrl ?? '/';
        this.#router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err.status === 401 || err.status === 400) {
          this.errorMessage.set('The verification code is incorrect or has expired.');
          this.form.get('code')?.reset();
        } else if (err.status === 429) {
          this.errorMessage.set('Too many attempts. Please wait a few minutes and try again.');
        } else if (err.status === 0) {
          this.errorMessage.set('Connection error. Please check your internet and try again.');
        } else {
          this.errorMessage.set(err.detail ?? err.title ?? 'Unable to verify. Please try again.');
        }
      },
    });
  }

  startOver() {
    this.#router.navigate(['/login']);
  }

  // Handle direct code paste (e.g., from password manager) — accept and submit
  onCodeInput(value: string | number | null | undefined) {
    const str = String(value ?? '').replace(/\D/g, '').slice(0, 6);
    this.form.get('code')?.setValue(str);
    if (str.length === 6 && !this.isSubmitting()) {
      this.submit();
    }
  }

  fieldError(path: string): string | null {
    const ctrl = this.form.get(path);
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required']) return 'Please enter your verification code.';
    if (ctrl.errors['pattern'])  return 'The code must be exactly 6 digits.';
    return 'Invalid code.';
  }
}
