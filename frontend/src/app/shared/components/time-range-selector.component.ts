// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// TimeRangeSelector — segmented control for time window selection.
// Location: apps/frontend/src/app/shared/components/time-range-selector/time-range-selector.component.ts
// Used in PageHeader actions slot on dashboards with time-series data.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type TimeRangeOption = '24h' | '7d' | '30d' | '90d' | 'QTD' | 'YTD' | 'Custom';

const DEFAULT_OPTIONS: TimeRangeOption[] = ['24h', '7d', '30d', '90d', 'QTD', 'YTD'];

@Component({
  selector: 'app-time-range-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="time-range-selector" role="radiogroup" [attr.aria-label]="ariaLabel()">
      @for (opt of resolvedOptions(); track opt) {
        <button
          type="button"
          role="radio"
          class="range-btn"
          [class.active]="opt === value()"
          [attr.aria-checked]="opt === value()"
          (click)="selectOption(opt)">
          {{ opt }}
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    .time-range-selector {
      display: inline-flex;
      background: var(--finops-bg-subtle);
      border-radius: var(--finops-radius-md);
      padding: 2px;
      gap: 0;
    }

    .range-btn {
      padding: var(--finops-space-2) var(--finops-space-3);
      border: none;
      background: transparent;
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-sm);
      font-weight: var(--finops-font-medium);
      color: var(--finops-text-secondary);
      cursor: pointer;
      border-radius: var(--finops-radius-sm);
      transition: var(--finops-transition-default);
      min-width: 44px;
    }

    .range-btn:hover:not(.active) {
      color: var(--finops-text-primary);
    }

    .range-btn.active {
      background: var(--finops-bg-surface);
      color: var(--finops-text-primary);
      box-shadow: var(--finops-shadow-sm);
      font-weight: var(--finops-font-semibold);
    }

    .range-btn:focus-visible {
      outline: 2px solid var(--finops-brand-primary);
      outline-offset: 1px;
    }
  `],
})
export class TimeRangeSelectorComponent {
  readonly value = input.required<TimeRangeOption>();
  readonly options = input<TimeRangeOption[]>(DEFAULT_OPTIONS);
  readonly ariaLabel = input<string>('Time range');

  readonly valueChange = output<TimeRangeOption>();

  readonly resolvedOptions = computed(() =>
    this.options().length > 0 ? this.options() : DEFAULT_OPTIONS,
  );

  selectOption(opt: TimeRangeOption) {
    if (opt !== this.value()) {
      this.valueChange.emit(opt);
    }
  }
}
