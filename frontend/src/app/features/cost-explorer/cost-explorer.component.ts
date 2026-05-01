// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Cost Explorer — chart-heavy Dashboard screen.
// Location: apps/frontend/src/app/features/understand/cost/
//           cost-explorer.component.ts
//
// Pattern: Dashboard (§3.1), chart-heavy variant:
//   PageHeader + TimeRange + dimension controls → KPI row → Narrative
//   → stacked area trend (full-width) → provider donut + service bar (2-col)
//   → top cost drivers AG Grid
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
  ApexLegend, ApexPlotOptions, ApexNonAxisChartSeries,
} from 'ng-apexcharts';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }        from '@shared/components/page-header.component';
import { KpiCardComponent }           from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent }    from '@shared/components/narrative-block.component';
import { TimeRangeSelectorComponent } from '@shared/components/time-range-selector.component';
import { LoadingStateComponent }      from '@shared/components/loading-state.component';
import { EmptyStateComponent }        from '@shared/components/empty-state.component';

import { CostExplorerService } from './cost-explorer.service';
import { formatCurrency }      from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import {
  type CostExplorerDashboardData,
  type CostTopDriverRow,
  type CostTimeRange,
  type CostGranularity,
  type CostGroupBy,
  type CostChargeType,
  TIME_RANGE_OPTIONS,
  GRANULARITY_OPTIONS,
  GROUP_BY_OPTIONS,
  CHARGE_TYPE_OPTIONS,
} from '@shared/types/cost-explorer.types';

@Component({
  selector: 'app-cost-explorer',
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
  templateUrl: './cost-explorer.component.html',
  styleUrl:    './cost-explorer.component.scss',
})
export class CostExplorerComponent {
  readonly #svc   = inject(CostExplorerService);
  readonly #title = inject(Title);

  constructor() { this.#title.setTitle('Cost Explorer · FinOps'); }

  // ── Controls ──────────────────────────────────────────────────────────────
  readonly timeRange   = signal<CostTimeRange>('30d');
  readonly granularity = signal<CostGranularity>('daily');
  readonly groupBy     = signal<CostGroupBy>('provider');
  readonly chargeType  = signal<CostChargeType>('BilledCost');
  readonly loadError   = signal<string | null>(null);

  readonly timeRangeOptions   = TIME_RANGE_OPTIONS;
  readonly granularityOptions = GRANULARITY_OPTIONS;
  readonly groupByOptions     = GROUP_BY_OPTIONS;
  readonly chargeTypeOptions  = CHARGE_TYPE_OPTIONS;

  // ── Query → data ──────────────────────────────────────────────────────────
  readonly #query = computed(() => ({
    timeRange:   this.timeRange(),
    granularity: this.granularity(),
    groupBy:     this.groupBy(),
    chargeType:  this.chargeType(),
  }));

  readonly dashboard = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.getDashboard(q).pipe(
          startWith(null),
          catchError(err => {
            this.loadError.set(err.title ?? 'Unable to load cost data');
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null as CostExplorerDashboardData | null },
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => {
    const d = this.dashboard();
    return d ? `Updated ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : 'Cloud and on-premises cost analysis';
  });

  // ── Stacked area: spend trend ─────────────────────────────────────────────
  readonly trendSeries = computed<ApexAxisChartSeries>(() => {
    const d = this.dashboard();
    if (!d) return [];
    return d.trendSeries.map(s => ({ name: s.name, data: s.data }));
  });
  readonly trendXAxis = computed<ApexXAxis>(() => ({
    categories: this.dashboard()?.trendDates ?? [],
    tickAmount: 8,
    labels: { rotate: -30, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly trendChart: ApexChart    = { ...baseChartOptions.chart, type: 'area', height: 320, stacked: true };
  readonly trendStroke: ApexStroke  = { curve: 'smooth', width: 1 };
  readonly trendFill: ApexFill      = { type: 'gradient', gradient: { opacityFrom: 0.55, opacityTo: 0.1 } };
  readonly trendColors              = CHART_PALETTE.slice(0, 4);
  readonly trendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly trendYAxis: ApexYAxis    = { labels: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly trendDataLabels: ApexDataLabels = { enabled: false };
  readonly trendLegend: ApexLegend  = { position: 'top', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };

  // ── Donut: spend by provider ──────────────────────────────────────────────
  readonly providerSeries = computed<number[]>(() =>
    (this.dashboard()?.byProvider ?? []).map(p => p.amount));
  readonly providerLabels = computed<string[]>(() =>
    (this.dashboard()?.byProvider ?? []).map(p => p.label));
  readonly providerChart: ApexChart        = { ...baseChartOptions.chart, type: 'donut', height: 280 };
  readonly providerColors                  = CHART_PALETTE.slice(0, 4);
  readonly providerLegend: ApexLegend      = { position: 'bottom', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };
  readonly providerPlotOptions: ApexPlotOptions = {
    pie: { donut: { size: '62%', labels: { show: true, total: { show: true, label: 'Total', fontFamily: 'var(--finops-font-family)' } } } },
  };
  readonly providerDataLabels: ApexDataLabels = { enabled: false };

  // ── Horizontal bar: spend by service ─────────────────────────────────────
  readonly serviceSeries = computed<ApexAxisChartSeries>(() => [{
    name: 'Spend',
    data: (this.dashboard()?.byService ?? []).map(s => s.amount),
  }]);
  readonly serviceXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.byService ?? []).map(s => s.label),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly serviceChart: ApexChart         = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly servicePlotOptions: ApexPlotOptions = { bar: { horizontal: true, borderRadius: 3, barHeight: '60%' } };
  readonly serviceColors                   = [CHART_PALETTE[0]];
  readonly serviceTooltip: ApexTooltip     = { ...baseChartOptions.tooltip, x: { show: true }, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly serviceYAxis: ApexYAxis         = { labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly serviceDataLabels: ApexDataLabels = { enabled: false };

  // ── AG Grid: top cost drivers ─────────────────────────────────────────────
  readonly driverRows = computed(() => this.dashboard()?.topDrivers ?? []);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly driverColDefs: ColDef<CostTopDriverRow>[] = [
    {
      field: 'serviceName', headerName: 'Resource / service', minWidth: 220, flex: 2,
      cellRenderer: (p: ICellRendererParams<CostTopDriverRow>) => {
        const r = p.data!;
        return `<div class="driver-cell">
          <span class="driver-service">${this.#escape(r.serviceName)}</span>
          <span class="driver-id">${this.#escape(r.resourceId)}</span>
        </div>`;
      },
    },
    {
      field: 'provider', headerName: 'Provider', maxWidth: 110,
      cellRenderer: (p: ICellRendererParams<CostTopDriverRow>) =>
        `<span class="provider-pill prov-${(p.value as string).toLowerCase()}">${this.#escape(p.value as string)}</span>`,
    },
    { field: 'region',       headerName: 'Region',        maxWidth: 150 },
    { field: 'businessUnit', headerName: 'Business unit',  minWidth: 160 },
    {
      field: 'amount', headerName: 'Spend',  maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<CostTopDriverRow>) =>
        `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>`,
    },
    {
      field: 'mom', headerName: 'MoM %', maxWidth: 100, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<CostTopDriverRow>) => {
        const v = p.value as number;
        const cls = v > 10 ? 'mom-high' : v > 0 ? 'mom-pos' : 'mom-neg';
        const arrow = v > 0 ? '▲' : '▼';
        return `<span class="${cls}">${v > 0 ? arrow : arrow} ${Math.abs(v).toFixed(1)}%</span>`;
      },
    },
  ];

  onTimeRangeChange(r: string)   { this.timeRange.set(r as CostTimeRange); }
  onGranularityChange(g: string) { this.granularity.set(g as CostGranularity); }

  readonly retry = () => { this.loadError.set(null); };

  #escape(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}
