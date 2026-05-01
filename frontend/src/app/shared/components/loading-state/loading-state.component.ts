// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// LoadingState — rendered while async data is pending.
// Location: apps/frontend/src/app/shared/components/loading-state/loading-state.component.ts
// Two variants: `spinner` (generic) or `skeleton` (content-shaped placeholder).
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonSpinner } from '@ionic/angular/standalone';

export type LoadingVariant = 'spinner' | 'skeleton';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonSpinner],
  template: `
    @if (variant() === 'spinner') {
      <div class="loading-state spinner" role="status" [attr.aria-label]="message() || 'Loading'">
        <ion-spinner name="crescent"></ion-spinner>
        @if (message()) {
          <div class="loading-message">{{ message() }}</div>
        }
      </div>
    } @else {
      <div class="loading-state skeleton" role="status" [attr.aria-label]="message() || 'Loading'">
        <div class="skeleton-block skeleton-block-title"></div>
        <div class="skeleton-block skeleton-block-row"></div>
        <div class="skeleton-block skeleton-block-row"></div>
        <div class="skeleton-block skeleton-block-row short"></div>
        @if (message()) {
          <div class="sr-only">{{ message() }}</div>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--finops-space-12) var(--finops-space-6);
      min-height: 240px;
      gap: var(--finops-space-4);
    }

    .loading-state.skeleton {
      align-items: stretch;
      gap: var(--finops-space-3);
      padding: var(--finops-space-8) var(--finops-space-6);
      min-height: auto;
    }

    ion-spinner {
      --color: var(--finops-brand-primary);
      width: 40px;
      height: 40px;
    }

    .loading-message {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-sm);
      color: var(--finops-text-tertiary);
    }

    .skeleton-block {
      background: linear-gradient(
        90deg,
        var(--finops-bg-subtle) 0%,
        var(--finops-border-subtle) 50%,
        var(--finops-bg-subtle) 100%
      );
      background-size: 200% 100%;
      border-radius: var(--finops-radius-md);
      animation: skeleton-shimmer 1.5s ease-in-out infinite;
    }

    .skeleton-block-title {
      height: 32px;
      width: 40%;
      margin-bottom: var(--finops-space-2);
    }

    .skeleton-block-row {
      height: 20px;
      width: 100%;
    }

    .skeleton-block-row.short {
      width: 60%;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @keyframes skeleton-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton-block {
        animation: none;
      }
    }
  `],
})
export class LoadingStateComponent {
  readonly variant = input<LoadingVariant>('spinner');
  readonly message = input<string | null>(null);
}
