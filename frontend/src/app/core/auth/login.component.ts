// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// LoginComponent — email + password authentication with MFA challenge routing.
// Location: apps/frontend/src/app/features/auth/login/login.component.ts
//
// Flow:
//   1. User enters email + password
//   2. Call AuthService.login()
//   3a. If MFA required: navigate to /mfa with challengeId in state
//   3b. If no MFA: landed authenticated — navigate to returnUrl or /
//   4. Error handling: 401 → inline message, 429 → rate limit message, 5xx → generic
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  IonInput,
  IonButton,
  IonIcon,
  IonCheckbox,
  IonSpinner,
} from '@ionic/angular/standalone';

import { AuthLayoutComponent } from './shared/auth-layout.component';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IonInput,
    IonButton,
    IonIcon,
    IonCheckbox,
    IonSpinner,
    AuthLayoutComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly #fb = inject(FormBuilder);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #title = inject(Title);

  constructor() {
    this.#title.setTitle('Sign in · FinOps');
    // If user is already authenticated, bounce to dashboard
    if (this.#auth.isAuthenticated()) {
      this.#navigateToDestination();
    }
    // Read `reason` query param to show context-sensitive banner
    const reason = this.#route.snapshot.queryParamMap.get('reason');
    if (reason === 'expired') this.banner.set({ type: 'info',    text: 'Your session expired. Please sign in again.' });
    if (reason === 'idle')    this.banner.set({ type: 'info',    text: 'You were signed out after inactivity.' });
    if (reason === 'forced')  this.banner.set({ type: 'warning', text: 'Your session was ended by an administrator.' });
  }

  // ── State ────────────────────────────────────────────────────────────────
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly banner = signal<{ type: 'info' | 'warning' | 'danger'; text: string } | null>(null);
  readonly showPassword = signal<boolean>(false);

  // ── Form ─────────────────────────────────────────────────────────────────
  readonly form = this.#fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(1)]],
    rememberMe: [false],
  });

  readonly canSubmit = computed(() => !this.isSubmitting());

  // ── Event handlers ───────────────────────────────────────────────────────
  togglePassword() {
    this.showPassword.update(v => !v);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.#auth.login({
      email: this.form.value.email!,
      password: this.form.value.password!,
    }).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        if (response.mfaChallenge) {
          this.#router.navigate(['/mfa'], {
            state: {
              challengeId: response.mfaChallenge.challengeId,
              method: response.mfaChallenge.method,
              expiresAt: response.mfaChallenge.expiresAt,
              returnUrl: this.#route.snapshot.queryParamMap.get('returnUrl'),
            },
          });
        } else {
          this.#navigateToDestination();
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err.status === 401) {
          this.errorMessage.set('The email or password you entered is incorrect.');
        } else if (err.status === 429) {
          this.errorMessage.set('Too many attempts. Please wait a few minutes and try again.');
        } else if (err.status === 403) {
          this.errorMessage.set(err.detail ?? 'Your account is not permitted to sign in.');
        } else if (err.status === 0) {
          this.errorMessage.set('Connection error. Please check your internet and try again.');
        } else {
          this.errorMessage.set(err.detail ?? err.title ?? 'Unable to sign in. Please try again.');
        }
      },
    });
  }

  fieldError(path: string): string | null {
    const ctrl = this.form.get(path);
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required']) return 'This field is required.';
    if (ctrl.errors['email'])    return 'Please enter a valid email address.';
    return 'Invalid value.';
  }

  #navigateToDestination() {
    const returnUrl = this.#route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    this.#router.navigateByUrl(returnUrl);
  }
}
