// FinOps Platform Design System v1.1
// Executive Summary — Dashboard. Route: /executive
// Pattern: PageHeader → 6 KPIs → NarrativeBlock → full-width spend trend → 2-col (provider donut + top movers)

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { ChartComponent } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexTooltip,
  ApexDataLabels, ApexStroke, ApexFill, ApexLegend,
  ApexNonAxisChartSeries, ApexPlotOptions,
} from 'ng-apexcharts';
import { startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent }      from '@shared/components/page-header.component';
import { KpiCardComponent }         from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent }  from '@shared/components/narrative-block.component';
import { LoadingStateComponent }    from '@shared/components/loading-state.component';
import { EmptyStateComponent }      from '@shared/components/empty-state.component';
import { ExecutiveSummaryService }  from './overview.services';
import { formatCurrency }           from '@lib/chart-defaults';
import { CHART_PALETTE, baseChartOptions, SEVERITY_COLORS } from '@lib/chart-defaults';
import { inverseStatus }            from '@lib/utils/ui_chart_defaults_additions';
import type { ExecutiveDashboardData, CostMover } from '@shared/types/overview.types';

@Component({
  selector: 'app-executive-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon,
    ChartComponent,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './executive-summary.component.html',
  styleUrl:    './executive-summary.component.scss',
})
export class ExecutiveSummaryComponent {
  readonly #svc   = inject(ExecutiveSummaryService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('Executive Summary · FinOps'); }

  readonly loadError = signal<string | null>(null);
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load executive summary'); return of(null); })),
    { initialValue: null as ExecutiveDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);

  // ── Full-width spend trend (actual + budget + forecast) ──────────────────
  readonly trendSeries = computed<ApexAxisChartSeries>(() => {
    const pts = this.dashboard()?.spendTrend ?? [];
    return [
      { name: 'Actual',   data: pts.map(p => p.actual   ?? null as unknown as number) },
      { name: 'Budget',   data: pts.map(p => p.budget   ?? null as unknown as number) },
      { name: 'Forecast', data: pts.map(p => p.forecast ?? null as unknown as number) },
    ];
  });
  readonly trendXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.spendTrend ?? []).map(p => p.period),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly trendChart: ApexChart   = { ...baseChartOptions.chart, type: 'line', height: 300 };
  readonly trendStroke: ApexStroke = { curve: 'smooth', width: [2.5, 1, 1], dashArray: [0, 5, 7] };
  readonly trendFill: ApexFill     = { type: ['gradient', 'none', 'none'], gradient: { opacityFrom: 0.25, opacityTo: 0.02 } };
  readonly trendColors             = [CHART_PALETTE[0], CHART_PALETTE[4], CHART_PALETTE[2]];
  readonly trendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => v ? formatCurrency(v, { code: 'AED' }) : '—' } };
  readonly trendYAxis: ApexYAxis   = { labels: { formatter: (v: number) => `${(v / 1_000_000).toFixed(1)}M`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly trendDataLabels: ApexDataLabels = { enabled: false };
  readonly trendLegend: ApexLegend = { position: 'top', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };

  // ── Provider spend donut ──────────────────────────────────────────────────
  readonly donutSeries = computed<ApexNonAxisChartSeries>(() =>
    (this.dashboard()?.providerSpend ?? []).map(p => p.amount)
  );
  readonly donutLabels = computed<string[]>(() =>
    (this.dashboard()?.providerSpend ?? []).map(p => p.provider)
  );
  readonly donutChart: ApexChart = { ...baseChartOptions.chart, type: 'donut', height: 280 };
  readonly donutColors = [CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[2], CHART_PALETTE[4]];
  readonly donutTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly donutPlotOptions: ApexPlotOptions = { pie: { donut: { size: '62%', labels: { show: true, total: { show: true, label: 'Total', formatter: () => { const t = (this.dashboard()?.providerSpend ?? []).reduce((s, p) => s + p.amount, 0); return formatCurrency(t, { code: 'AED' }); } } } } } };

  // ── Cost movers helpers ───────────────────────────────────────────────────
  readonly increases = computed<CostMover[]>(() => (this.dashboard()?.topMovers ?? []).filter(m => m.direction === 'increase'));
  readonly decreases = computed<CostMover[]>(() => (this.dashboard()?.topMovers ?? []).filter(m => m.direction === 'decrease'));
  readonly moverPct  = (m: CostMover) => `${m.direction === 'increase' ? '+' : ''}${m.changePct.toFixed(1)}%`;
  readonly moverAmt  = (m: CostMover) => formatCurrency(Math.abs(m.changeAmt), { code: m.currency });

  readonly retry = () => { this.loadError.set(null); };
}
