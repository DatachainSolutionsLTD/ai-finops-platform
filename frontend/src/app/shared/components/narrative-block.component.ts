// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// NarrativeBlock — container for LLM-generated narrative text.
// Location: apps/frontend/src/app/shared/components/narrative-block/narrative-block.component.ts
// Used by Dashboard pattern for A29 Explainability summaries and A04 Reporting narratives.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-narrative-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonIcon, IonButton],
  template: `
    <aside class="narrative-block" role="note" [attr.aria-label]="ariaLabel()">
      <div class="narrative-icon" aria-hidden="true">
        <ion-icon name="sparkles-outline"></ion-icon>
      </div>

      <div class="narrative-content">
        @if (sourceAgent()) {
          <div class="narrative-attribution">
            <span class="attribution-dot" aria-hidden="true">✦</span>
            <span>{{ sourceAgent() }}</span>
            @if (generatedAt()) {
              <span class="attribution-time">· {{ generatedAt() }}</span>
            }
          </div>
        }

        @if (title()) {
          <h3 class="narrative-title">{{ title() }}</h3>
        }

        <div class="narrative-text" [class.clamped]="!expanded() && expandable() && isLong()">
          {{ content() }}
        </div>

        @if (expandable() && isLong()) {
          <button type="button" class="narrative-toggle" (click)="toggleExpanded()">
            {{ expanded() ? 'Show less' : 'Show more' }}
            <ion-icon [name]="expanded() ? 'chevron-up-outline' : 'chevron-down-outline'" aria-hidden="true"></ion-icon>
          </button>
        }
      </div>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
    }

    .narrative-block {
      background: var(--finops-bg-accent);
      border: 1px solid var(--finops-warning-subtle);
      border-left: 3px solid var(--finops-warning);
      border-radius: var(--finops-radius-lg);
      padding: var(--finops-space-5) var(--finops-space-6);
      display: flex;
      gap: var(--finops-space-4);
    }

    .narrative-icon {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      color: var(--finops-warning-dark);
      margin-top: 2px;

      ion-icon {
        font-size: 22px;
      }
    }

    .narrative-content {
      flex: 1;
      min-width: 0;
    }

    .narrative-attribution {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-xs);
      font-weight: var(--finops-font-semibold);
      color: var(--finops-warning-dark);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--finops-space-2);
      display: flex;
      align-items: center;
      gap: var(--finops-space-2);
    }

    .attribution-dot {
      font-size: 14px;
    }

    .attribution-time {
      font-weight: var(--finops-font-normal);
      text-transform: none;
      letter-spacing: 0;
      color: var(--finops-text-tertiary);
    }

    .narrative-title {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-base);
      font-weight: var(--finops-font-semibold);
      color: var(--finops-text-primary);
      margin: 0 0 var(--finops-space-2);
    }

    .narrative-text {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-sm);
      color: var(--finops-text-primary);
      line-height: var(--finops-leading-relaxed);
      white-space: pre-wrap;
    }

    .narrative-text.clamped {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .narrative-toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--finops-space-1);
      background: transparent;
      border: none;
      padding: var(--finops-space-2) 0 0;
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-xs);
      font-weight: var(--finops-font-semibold);
      color: var(--finops-warning-dark);
      cursor: pointer;
    }

    .narrative-toggle:hover {
      text-decoration: underline;
    }

    .narrative-toggle ion-icon {
      font-size: 14px;
    }
  `],
})
export class NarrativeBlockComponent {
  readonly content = input.required<string>();
  readonly title = input<string | null>(null);
  readonly sourceAgent = input<string | null>(null);
  readonly generatedAt = input<string | null>(null);    // formatted string (component doesn't format dates)
  readonly expandable = input<boolean>(false);

  readonly expanded = signal<boolean>(false);

  readonly isLong = computed(() => this.content().length > 240);

  readonly ariaLabel = computed(() => {
    const source = this.sourceAgent();
    return source ? `Narrative from ${source}` : 'Narrative';
  });

  toggleExpanded() {
    this.expanded.update(v => !v);
  }
}
