// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// My Dashboard — personalised landing screen for all authenticated users.
// Route: /  (redirected to /dashboard for non-root roles)
// Pattern: Dashboard — greeting + quick links → KPIs → spend trend → alerts
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonButton, IonIcon, IonBadge,
} from '@ionic/angular/standalone';

import { ChartComponent } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexTooltip, ApexDataLabels, ApexStroke, ApexFill, ApexAnnotations,
} from 'ng-apexcharts';

import { startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { KpiCardComponent }      from '@shared/components/kpi-card.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { MyDashboardService }    from './overview.services';
import { formatCurrency }        from '@lib/chart-defaults';
import { CHART_PALETTE, baseChartOptions, SEVERITY_COLORS } from '@lib/chart-defaults';
import { inverseStatus }         from '@lib/utils/ui_chart_defaults_additions';
import { relativeTime }          from '@lib/utils/date.utils';
import type { MyDashboardData, AlertItem } from '@shared/types/overview.types';

@Component({
  selector: 'app-my-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonButton, IonIcon, IonBadge,
    ChartComponent,
    PageHeaderComponent, KpiCardComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './my-dashboard.component.html',
  styleUrl:    './my-dashboard.component.scss',
})
export class MyDashboardComponent {
  readonly #svc   = inject(MyDashboardService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('My Dashboard · FinOps'); }

  readonly loadError = signal<string | null>(null);
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load dashboard'); return of(null); })),
    { initialValue: null as MyDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly greeting  = computed(() => {
    const h = new Date().getHours();
    const name = this.dashboard()?.userDisplayName ?? '';
    const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return name ? `${salutation}, ${name.split(' ')[0]}` : salutation;
  });
  readonly subtitle  = computed(() => {
    const d = this.dashboard();
    return d ? `${d.userRole.replace('_', ' ')} · ${new Date().toLocaleDateString('en-AE', { weekday: 'long', day: '2-digit', month: 'long' })}` : '';
  });

  // ── Spend trend area chart ────────────────────────────────────────────────
  readonly spendSeries = computed<ApexAxisChartSeries>(() => {
    const pts = this.dashboard()?.spendTrend ?? [];
    return [
      { name: 'Actual',   data: pts.map(p => p.actual   ?? null as unknown as number) },
      { name: 'Budget',   data: pts.map(p => p.budget   ?? null as unknown as number) },
      { name: 'Forecast', data: pts.map(p => p.forecast ?? null as unknown as number) },
    ];
  });
  readonly spendXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.spendTrend ?? []).map(p => p.period),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly spendChart: ApexChart   = { ...baseChartOptions.chart, type: 'line', height: 260 };
  readonly spendStroke: ApexStroke = { curve: 'smooth', width: [2, 1, 1], dashArray: [0, 4, 6] };
  readonly spendFill: ApexFill     = { type: ['gradient', 'none', 'none'], gradient: { opacityFrom: 0.3, opacityTo: 0.02, shade: 'light' } };
  readonly spendColors             = [CHART_PALETTE[0], CHART_PALETTE[4], CHART_PALETTE[2]];
  readonly spendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly spendYAxis: ApexYAxis   = { labels: { formatter: (v: number) => `${(v / 1_000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly spendDataLabels: ApexDataLabels = { enabled: false };

  // ── Alerts helpers ────────────────────────────────────────────────────────
  readonly alertSeverityClass = (sev: AlertItem['severity']): string => {
    const m: Record<string, string> = { Critical: 'alert-critical', High: 'alert-high', Medium: 'alert-medium', Low: 'alert-low' };
    return m[sev] ?? 'alert-medium';
  };
  readonly alertAge = (iso: string) => relativeTime(iso);

  readonly retry = () => { this.loadError.set(null); };
}
