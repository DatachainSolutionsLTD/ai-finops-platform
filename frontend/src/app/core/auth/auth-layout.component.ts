// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// AuthLayoutComponent — shared shell for pre-authentication screens.
// Location: apps/frontend/src/app/features/auth/shared/auth-layout.component.ts
//
// Pattern: centered card on a subtle tinted background, no side nav, no top bar.
// Used by: Login, MFA Verification, Forgot Password, Password Reset.
//
// Children project their content via the default slot:
//   <app-auth-layout>
//     <!-- Login form -->
//   </app-auth-layout>
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, IonIcon],
  template: `
    <div class="auth-shell">
      <div class="auth-container">

        <div class="auth-brand">
          <div class="brand-mark" aria-hidden="true">
            <ion-icon name="flash"></ion-icon>
          </div>
          <div class="brand-text">FinOps</div>
        </div>

        <div class="auth-card">
          <header class="auth-header">
            <h1 class="auth-title">{{ title() }}</h1>
            @if (subtitle()) {
              <p class="auth-subtitle">{{ subtitle() }}</p>
            }
          </header>

          <div class="auth-body">
            <ng-content></ng-content>
          </div>
        </div>

        <footer class="auth-footer">
          <div class="auth-footer-links">
            <a routerLink="/legal/terms">Terms</a>
            <span aria-hidden="true">·</span>
            <a routerLink="/legal/privacy">Privacy</a>
            <span aria-hidden="true">·</span>
            <a routerLink="/support">Support</a>
          </div>
          <div class="auth-copyright">
            © {{ currentYear }} FinOps Platform. All rights reserved.
          </div>
        </footer>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .auth-shell {
      min-height: 100vh;
      background:
        radial-gradient(
          ellipse 1200px 600px at 50% -200px,
          var(--finops-brand-primary-subtle) 0%,
          transparent 60%
        ),
        var(--finops-bg-page);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--finops-space-6);
    }

    .auth-container {
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--finops-space-6);
    }

    .auth-brand {
      display: flex;
      align-items: center;
      gap: var(--finops-space-3);
      padding: var(--finops-space-2) 0;
    }

    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: var(--finops-radius-md);
      background: var(--finops-brand-primary);
      color: var(--finops-text-inverse);
      display: flex;
      align-items: center;
      justify-content: center;

      ion-icon {
        font-size: 22px;
      }
    }

    .brand-text {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-2xl);
      font-weight: var(--finops-font-bold);
      color: var(--finops-brand-primary);
      letter-spacing: -0.02em;
    }

    .auth-card {
      width: 100%;
      background: var(--finops-bg-surface);
      border: 1px solid var(--finops-border-default);
      border-radius: var(--finops-radius-lg);
      box-shadow: var(--finops-shadow-md);
      padding: var(--finops-space-8);

      @media (max-width: 480px) {
        padding: var(--finops-space-6);
      }
    }

    .auth-header {
      margin-bottom: var(--finops-space-6);
      text-align: center;
    }

    .auth-title {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-2xl);
      font-weight: var(--finops-font-bold);
      color: var(--finops-text-primary);
      margin: 0;
      letter-spacing: -0.01em;
      line-height: var(--finops-leading-tight);
    }

    .auth-subtitle {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-sm);
      color: var(--finops-text-secondary);
      margin: var(--finops-space-2) 0 0;
      line-height: var(--finops-leading-relaxed);
    }

    .auth-body {
      display: flex;
      flex-direction: column;
      gap: var(--finops-space-5);
    }

    .auth-footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--finops-space-2);
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-xs);
      color: var(--finops-text-tertiary);
      text-align: center;
    }

    .auth-footer-links {
      display: flex;
      align-items: center;
      gap: var(--finops-space-2);
    }

    .auth-footer-links a {
      color: var(--finops-text-tertiary);
      text-decoration: none;
      transition: var(--finops-transition-default);
    }

    .auth-footer-links a:hover {
      color: var(--finops-brand-primary);
      text-decoration: underline;
    }
  `],
})
export class AuthLayoutComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);

  readonly currentYear = new Date().getFullYear();
}
