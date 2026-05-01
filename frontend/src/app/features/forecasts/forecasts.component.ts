// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Forecasts — Dashboard screen.
// Location: apps/frontend/src/app/features/quantify/forecasts/
//           forecasts.component.ts
// Pattern: Dashboard (§3.1):
//   PageHeader+horizon+dimension controls → KPI row → Narrative
//   → full-width forecast vs. actual area w/ confidence bands
//   → budget-vs-forecast bar (by dimension) → Early Warning AG Grid
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonButton, IonIcon, IonSelect, IonSelectOption,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';

import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexStroke, ApexFill, ApexTooltip, ApexDataLabels,
  ApexAnnotations, ApexLegend, ApexPlotOptions,
} from 'ng-apexcharts';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }        from '@shared/components/page-header.component';
import { KpiCardComponent }           from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent }    from '@shared/components/narrative-block.component';
import { TimeRangeSelectorComponent } from '@shared/components/time-range-selector.component';
import { LoadingStateComponent }      from '@shared/components/loading-state.component';
import { EmptyStateComponent }        from '@shared/components/empty-state.component';

import { ForecastsService }   from './forecasts.service';
import { formatCurrency }     from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import {
  type ForecastsDashboardData,
  type EarlyWarningRow,
  type EarlyWarningSeverity,
  type ForecastHorizon,
  type ForecastDimension,
  FORECAST_HORIZON_OPTIONS,
  FORECAST_DIMENSION_OPTIONS,
} from '@shared/types/forecasts.types';

@Component({
  selector: 'app-forecasts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonButton, IonIcon, IonSelect, IonSelectOption,
    AgGridAngular, NgApexchartsModule,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    TimeRangeSelectorComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './forecasts.component.html',
  styleUrl:    './forecasts.component.scss',
})
export class ForecastsComponent {
  readonly #svc   = inject(ForecastsService);
  readonly #title = inject(Title);

  constructor() { this.#title.setTitle('Forecasts · FinOps'); }

  // ── Controls ──────────────────────────────────────────────────────────────
  readonly horizon   = signal<ForecastHorizon>('30d');
  readonly dimension = signal<ForecastDimension>('provider');
  readonly loadError = signal<string | null>(null);

  readonly horizonOptions   = FORECAST_HORIZON_OPTIONS;
  readonly dimensionOptions = FORECAST_DIMENSION_OPTIONS;

  readonly #query = computed(() => ({ horizon: this.horizon(), dimension: this.dimension() }));

  readonly dashboard = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.getDashboard(q.horizon, q.dimension).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load forecast data'); return of(null); }),
        ),
      ),
    ),
    { initialValue: null as ForecastsDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => {
    const d = this.dashboard();
    return d ? `Powered by ${d.narrative.agentName} · Updated ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'ML-powered spend forecasting with confidence bands';
  });

  // ── Forecast vs. Actual area chart (with confidence annotation) ───────────
  readonly trendSeries = computed<ApexAxisChartSeries>(() => {
    const pts = this.dashboard()?.trendPoints ?? [];
    return [
      { name: 'Actual',          data: pts.map(p => p.actual) },
      { name: 'Forecast',        data: pts.map(p => p.forecast),       type: 'line' },
      { name: 'Conf. upper',     data: pts.map(p => p.confidenceHigh), type: 'area' },
      { name: 'Conf. lower',     data: pts.map(p => p.confidenceLow),  type: 'area' },
    ];
  });
  readonly trendXAxis = computed<ApexXAxis>(() => ({
    categories: this.dashboard()?.trendPoints.map(p => p.date) ?? [],
    tickAmount: 10,
    labels: { rotate: -30, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly trendChart: ApexChart    = { ...baseChartOptions.chart, type: 'line', height: 320 };
  readonly trendStroke: ApexStroke  = { curve: 'smooth', width: [2, 2, 0, 0], dashArray: [0, 4, 0, 0] };
  readonly trendFill: ApexFill      = { type: ['solid', 'solid', 'gradient', 'gradient'], opacity: [1, 1, 0.12, 0.12], gradient: { opacityFrom: 0.15, opacityTo: 0.01 } };
  readonly trendColors              = [CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[1], CHART_PALETTE[1]];
  readonly trendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number | null) => v !== null ? formatCurrency(v, { code: 'AED' }) : '—' } };
  readonly trendYAxis: ApexYAxis    = { labels: { formatter: (v: number) => `${(v / 1_000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly trendDataLabels: ApexDataLabels = { enabled: false };
  readonly trendLegend: ApexLegend  = { show: true, showForNullSeries: false, showForZeroSeries: false, position: 'top', fontFamily: 'var(--finops-font-family)', fontSize: '12px', markers: { width: 10, height: 2 } };

  // ── Budget vs. Forecast grouped bar ──────────────────────────────────────
  readonly budgetSeries = computed<ApexAxisChartSeries>(() => {
    const d = this.dashboard()?.byDimension ?? [];
    return [
      { name: 'Forecast',  data: d.map(x => x.forecastAmount) },
      { name: 'Budget',    data: d.map(x => x.budgetAmount ?? 0) },
    ];
  });
  readonly budgetXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.byDimension ?? []).map(x => x.label),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly budgetChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly budgetColors  = [CHART_PALETTE[0], CHART_PALETTE[4]];
  readonly budgetTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly budgetYAxis: ApexYAxis = { labels: { formatter: (v: number) => `${(v / 1_000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly budgetDataLabels: ApexDataLabels = { enabled: false };
  readonly budgetLegend: ApexLegend = { position: 'top', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };

  // ── Early warning AG Grid ─────────────────────────────────────────────────
  readonly warnRows  = computed(() => this.dashboard()?.earlyWarnings ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly warnColDefs: ColDef<EarlyWarningRow>[] = [
    {
      field: 'severity', headerName: 'Severity', maxWidth: 140,
      cellRenderer: (p: ICellRendererParams<EarlyWarningRow>) => {
        const vm: Record<EarlyWarningSeverity, string> = { Critical:'sev-critical', Warning:'sev-warning', Informational:'sev-info' };
        return `<span class="sev-badge ${vm[p.value as EarlyWarningSeverity]}">${this.#escape(p.value as string)}</span>`;
      },
    },
    {
      field: 'dimension', headerName: 'Dimension', minWidth: 180, flex: 2,
      cellRenderer: (p: ICellRendererParams<EarlyWarningRow>) => {
        const r = p.data!;
        return `<div class="dim-cell"><span class="dim-name">${this.#escape(r.dimension)}</span><span class="dim-type">${this.#escape(r.dimensionType)}</span></div>`;
      },
    },
    {
      field: 'budgetAmount', headerName: 'Budget', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<EarlyWarningRow>) =>
        `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>`,
    },
    {
      field: 'projectedSpend', headerName: 'Projected', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<EarlyWarningRow>) =>
        `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>`,
    },
    {
      field: 'variancePct', headerName: 'Variance', maxWidth: 110, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<EarlyWarningRow>) => {
        const v = p.value as number;
        const cls = v >= 15 ? 'var-high' : v >= 5 ? 'var-mid' : 'var-ok';
        return `<span class="${cls}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
      },
    },
    {
      field: 'exhaustionDate', headerName: 'Exhaustion', minWidth: 130,
      valueFormatter: p => p.value ? new Date(p.value as string).toLocaleDateString('en-AE', { day:'2-digit', month:'short' }) : 'Within budget',
    },
    {
      field: 'status', headerName: 'Status', maxWidth: 140,
      cellRenderer: (p: ICellRendererParams<EarlyWarningRow>) => {
        const vm: Record<string, string> = { Active:'danger', Acknowledged:'warning', Resolved:'success' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(p.value as string)}</span>`;
      },
    },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #escape(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
