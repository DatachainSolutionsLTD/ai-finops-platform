// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge — compact colored pill for status display.
// Location: apps/frontend/src/app/shared/components/status-badge/status-badge.component.ts
// Used as cellRenderer in AG Grid and inline in card headers and lists.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="status-badge" [class]="variant()" [attr.aria-label]="ariaLabel() || label()">
      {{ label() }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px var(--finops-space-2);
      border-radius: var(--finops-radius-full);
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-xs);
      font-weight: var(--finops-font-semibold);
      white-space: nowrap;
      line-height: 1.4;
    }

    .status-badge.success { background: var(--finops-success-subtle); color: var(--finops-success-dark); }
    .status-badge.warning { background: var(--finops-warning-subtle); color: var(--finops-warning-dark); }
    .status-badge.danger  { background: var(--finops-danger-subtle);  color: var(--finops-danger-dark); }
    .status-badge.info    { background: var(--finops-info-subtle);    color: var(--finops-info-dark); }
    .status-badge.neutral { background: var(--finops-bg-subtle);      color: var(--finops-text-tertiary); }
  `],
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly variant = input<StatusVariant>('neutral');
  readonly ariaLabel = input<string | null>(null);
}
