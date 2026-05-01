// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// KpiCard — atomic metric display.
// Location: apps/frontend/src/app/shared/components/kpi-card/kpi-card.component.ts
//
// Renders: label, large value, optional unit, optional delta chip, optional sparkline,
//          optional status-colored left border.
//
// Props mirror the Dashboard exemplar's usage exactly — no props invented that
// the exemplar didn't already need.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { ChartComponent } from 'ng-apexcharts';
import type { ApexChart, ApexFill, ApexStroke } from 'ng-apexcharts';

export type KpiStatus = 'success' | 'warning' | 'danger' | 'neutral';
export type KpiDeltaDirection = 'up' | 'down' | 'flat';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonIcon, ChartComponent],
  template: `
    <article class="kpi-card" [class]="'status-' + status()" [attr.aria-label]="ariaLabel()">
      <div class="kpi-label">{{ label() }}</div>

      <div class="kpi-value-row">
        <div class="kpi-value">{{ value() }}</div>
        @if (unit()) {
          <div class="kpi-unit">{{ unit() }}</div>
        }
        @if (deltaPercent() !== null) {
          <div class="kpi-delta" [class]="deltaClass()" [attr.aria-label]="deltaAriaLabel()">
            <ion-icon [name]="deltaIcon()" aria-hidden="true"></ion-icon>
            <span>{{ deltaPercent()! | number: '1.0-1' }}%</span>
          </div>
        }
      </div>

      @if (footerLabel()) {
        <div class="kpi-footer-label">{{ footerLabel() }}</div>
      }

      @if (sparklineData().length > 0) {
        <div class="kpi-sparkline">
          <apx-chart
            [series]="sparklineSeries()"
            [chart]="sparklineChart"
            [stroke]="sparklineStroke"
            [fill]="sparklineFill"
            [colors]="[sparklineColor()]"
            [tooltip]="{ enabled: false }">
          </apx-chart>
        </div>
      }
    </article>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .kpi-card {
      background: var(--finops-bg-surface);
      border: 1px solid var(--finops-border-default);
      border-radius: var(--finops-radius-lg);
      padding: var(--finops-space-6);
      box-shadow: var(--finops-shadow-sm);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: var(--finops-space-2);
      height: 100%;
      min-height: 140px;
    }

    .kpi-card.status-success { border-left: 3px solid var(--finops-success); }
    .kpi-card.status-warning { border-left: 3px solid var(--finops-warning); }
    .kpi-card.status-danger  { border-left: 3px solid var(--finops-danger); }
    .kpi-card.status-neutral { border-left: 3px solid var(--finops-border-strong); }

    .kpi-label {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-sm);
      font-weight: var(--finops-font-medium);
      color: var(--finops-text-secondary);
      margin-bottom: var(--finops-space-1);
    }

    .kpi-value-row {
      display: flex;
      align-items: baseline;
      gap: var(--finops-space-3);
      flex-wrap: wrap;
    }

    .kpi-value {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-3xl);
      font-weight: var(--finops-font-bold);
      color: var(--finops-text-primary);
      line-height: 1;
      letter-spacing: -0.02em;
    }

    .kpi-unit {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-base);
      color: var(--finops-text-tertiary);
      font-weight: var(--finops-font-medium);
    }

    .kpi-delta {
      display: inline-flex;
      align-items: center;
      gap: var(--finops-space-1);
      padding: 2px var(--finops-space-2);
      border-radius: var(--finops-radius-sm);
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-xs);
      font-weight: var(--finops-font-semibold);
      white-space: nowrap;
    }

    .kpi-delta.up.good    { background: var(--finops-success-subtle); color: var(--finops-success-dark); }
    .kpi-delta.up.bad     { background: var(--finops-danger-subtle);  color: var(--finops-danger-dark); }
    .kpi-delta.down.good  { background: var(--finops-success-subtle); color: var(--finops-success-dark); }
    .kpi-delta.down.bad   { background: var(--finops-danger-subtle);  color: var(--finops-danger-dark); }
    .kpi-delta.flat       { background: var(--finops-bg-subtle);      color: var(--finops-text-tertiary); }

    .kpi-delta ion-icon {
      font-size: 12px;
    }

    .kpi-footer-label {
      font-family: var(--finops-font-family);
      font-size: var(--finops-text-xs);
      color: var(--finops-text-tertiary);
      margin-top: var(--finops-space-1);
    }

    .kpi-sparkline {
      margin-top: auto;
      padding-top: var(--finops-space-3);
      height: 40px;
    }

    :host ::ng-deep .kpi-sparkline .apexcharts-canvas {
      height: 40px !important;
    }
  `],
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string | null>(null);
  readonly deltaPercent = input<number | null>(null);
  readonly deltaDirection = input<KpiDeltaDirection>('flat');
  readonly sparklineData = input<number[]>([]);
  readonly status = input<KpiStatus>('neutral');
  readonly footerLabel = input<string | null>(null);

  /**
   * Whether the delta direction is semantically "good" for this metric.
   * Some metrics invert normal semantics (e.g., "critical alerts decreasing" is good even though direction is down).
   * Consumers pass `deltaIsGood` explicitly to override the default mapping.
   */
  readonly deltaIsGood = input<boolean | null>(null);

  readonly deltaIcon = computed(() => {
    const d = this.deltaDirection();
    return d === 'up' ? 'arrow-up-outline' : d === 'down' ? 'arrow-down-outline' : 'remove-outline';
  });

  readonly deltaClass = computed(() => {
    const direction = this.deltaDirection();
    if (direction === 'flat') return 'flat';

    // Explicit override: deltaIsGood tells us whether this particular direction
    // is semantically positive for this metric. If null, default to "up is good".
    const isGood = this.deltaIsGood();
    const inferredGood = isGood === null ? direction === 'up' : isGood;

    return `${direction} ${inferredGood ? 'good' : 'bad'}`;
  });

  readonly sparklineColor = computed(() => {
    const map: Record<KpiStatus, string> = {
      success: '#3E6340',
      warning: '#C78E49',
      danger:  '#95443E',
      neutral: '#3E6264',
    };
    return map[this.status()];
  });

  readonly sparklineSeries = computed(() => [{ data: this.sparklineData() }]);

  readonly sparklineChart: ApexChart = {
    type: 'area',
    height: 40,
    sparkline: { enabled: true },
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
  };

  readonly sparklineStroke: ApexStroke = {
    curve: 'smooth',
    width: 1.5,
  };

  readonly sparklineFill: ApexFill = {
    type: 'gradient',
    gradient: {
      opacityFrom: 0.4,
      opacityTo: 0.05,
      stops: [0, 100],
    },
  };

  readonly ariaLabel = computed(() => {
    const parts: string[] = [`${this.label()}: ${this.value()}`];
    if (this.unit()) parts.push(this.unit()!);
    if (this.deltaPercent() !== null) {
      const sign = this.deltaDirection() === 'up' ? '+' : this.deltaDirection() === 'down' ? '-' : '';
      parts.push(`change ${sign}${this.deltaPercent()}%`);
    }
    return parts.join(', ');
  });

  readonly deltaAriaLabel = computed(() => {
    const d = this.deltaDirection();
    const pct = this.deltaPercent();
    if (d === 'flat' || pct === null) return 'No change';
    const verb = d === 'up' ? 'increased' : 'decreased';
    return `${verb} by ${pct} percent`;
  });
}
