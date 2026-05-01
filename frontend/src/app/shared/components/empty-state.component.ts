// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// EmptyState — rendered when a list, grid, or chart has no data.
// Location: apps/frontend/src/app/shared/components/empty-state/empty-state.component.ts
//
// Two variants per List exemplar:
//   - First-time empty: "No tenants yet" + create CTA
//   - Filter-induced empty: "No tenants match your filters" + clear filters CTA
//
// Different copy, different CTAs — consumers pass the right combination.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonButton } from '@ionic/angular/standalone';

export interface EmptyStateAction {
  label: string;
  handler: () => void;
  /** Visual style of the button. Default is 'primary'. */
  variant?: 'primary' | 'outline' | 'clear';
  /** Optional icon name to render before the label. */
  icon?: string;
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonIcon, IonButton],
  template: `
    <div class="empty-state" role="status">
      <div class="empty-icon" aria-hidden="true">
        <ion-icon [name]="icon()"></ion-icon>
      </div>

      <h3 class="empty-title">{{ title() }}</h3>

      @if (description()) {
        <p class="empty-description">{{ description() }}</p>
      }

      @if (action(); as a) {
        <div class="empty-action">
          <ion-button
            [fill]="actionFill(a)"
            [color]="actionColor(a)"
            (click)="a.handler()">
            @if (a.icon) {
              <ion-icon [name]="a.icon" slot="start" aria-hidden="true"></ion-icon>
            }
            {{ a.label }}
          </ion-button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--finops-space-12) var(--finops-space-6);
      min-height: 320px;
      gap: var(--finops-space-3);
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--finops-text-tertiary);
      margin-bottom: var(--finops-space-2);

      ion-icon {
        font-size: 64px;
      }
    }

    .empty-title {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-xl);
      font-weight: var(--finops-font-semibold);
      color: var(--finops-text-primary);
      margin: 0;
      letter-spacing: -0.01em;
    }

    .empty-description {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-sm);
      color: var(--finops-text-secondary);
      margin: 0;
      max-width: 400px;
      line-height: var(--finops-leading-relaxed);
    }

    .empty-action {
      margin-top: var(--finops-space-4);
    }

    .empty-action ion-button {
      --border-radius: var(--finops-radius-md);
      font-family: var(--finops-font-family);
      font-weight: var(--finops-font-medium);
      text-transform: none;
      letter-spacing: 0;
    }
  `],
})
export class EmptyStateComponent {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly action = input<EmptyStateAction | null>(null);

  actionFill(a: EmptyStateAction): 'solid' | 'outline' | 'clear' {
    const variant = a.variant ?? 'primary';
    return variant === 'primary' ? 'solid' : variant;
  }

  actionColor(a: EmptyStateAction): string {
    return 'primary';
  }
}
