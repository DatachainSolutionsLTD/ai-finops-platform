// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// ForgotPasswordComponent — request a password reset link.
// Location: apps/frontend/src/app/features/auth/forgot-password/forgot-password.component.ts
//
// Flow:
//   1. User enters their email address
//   2. Call AuthService.requestPasswordReset()
//   3. Regardless of whether the email exists, show a generic confirmation
//      ("If that email is on file, you'll receive a reset link") to avoid
//      enumeration attacks
//   4. On connection error, show retry option
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of, catchError, delay } from 'rxjs';

import {
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';

import { AuthLayoutComponent } from '../shared/auth-layout.component';
import { environment } from '@env/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
    AuthLayoutComponent,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  readonly #fb = inject(FormBuilder);
  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);
  readonly #title = inject(Title);

  constructor() {
    this.#title.setTitle('Reset password · FinOps');
  }

  // ── State ────────────────────────────────────────────────────────────────
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly submitted = signal<boolean>(false);
  readonly submittedEmail = signal<string>('');

  // ── Form ─────────────────────────────────────────────────────────────────
  readonly form = this.#fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly canSubmit = computed(() => !this.isSubmitting());

  // ── Event handlers ───────────────────────────────────────────────────────
  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.value.email!;
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    // Real API:
    //   this.#http.post(`${environment.apiBaseUrl}/auth/forgot-password`, { email })
    //     .pipe(catchError(err => of(undefined)))  // swallow errors — always show generic confirmation
    //     .subscribe(...)
    of(undefined).pipe(delay(600)).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.submittedEmail.set(email);
        this.submitted.set(true);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Unable to send reset link. Please check your connection and try again.');
      },
    });
  }

  tryAnotherEmail() {
    this.submitted.set(false);
    this.form.reset();
  }

  fieldError(path: string): string | null {
    const ctrl = this.form.get(path);
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required']) return 'Please enter your email address.';
    if (ctrl.errors['email'])    return 'Please enter a valid email address.';
    return 'Invalid email.';
  }
}
