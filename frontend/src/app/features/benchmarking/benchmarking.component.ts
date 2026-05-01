// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Benchmarking — Dashboard screen. Agent A08.
// Location: apps/frontend/src/app/features/quantify/benchmarking/
//           benchmarking.component.ts
// Pattern: Dashboard (§3.1):
//   PageHeader+TimeRange → KPI row → Narrative
//   → efficiency ratio bar chart + benchmark deviation trend (2-col)
//   → above-benchmark AG Grid with optimization opportunity
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';

import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexStroke, ApexTooltip, ApexDataLabels, ApexPlotOptions,
} from 'ng-apexcharts';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }        from '@shared/components/page-header.component';
import { KpiCardComponent }           from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent }    from '@shared/components/narrative-block.component';
import { TimeRangeSelectorComponent } from '@shared/components/time-range-selector.component';
import { LoadingStateComponent }      from '@shared/components/loading-state.component';
import { EmptyStateComponent }        from '@shared/components/empty-state.component';

import { BenchmarkingService }  from './benchmarking.service';
import { formatCurrency }       from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import {
  type BenchmarkingDashboardData,
  type AboveBenchmarkRow,
  type BenchmarkDeviationSeverity,
  type BenchmarkTimeRange,
} from '@shared/types/quantify-dashboards.types';

const TIME_RANGE_OPTIONS: BenchmarkTimeRange[] = ['30d', '90d', '6m', '12m'];

@Component({
  selector: 'app-benchmarking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon,
    AgGridAngular, NgApexchartsModule,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    TimeRangeSelectorComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './benchmarking.component.html',
  styleUrl:    './benchmarking.component.scss',
})
export class BenchmarkingComponent {
  readonly #svc   = inject(BenchmarkingService);
  readonly #title = inject(Title);

  constructor() { this.#title.setTitle('Benchmarking · FinOps'); }

  readonly timeRange  = signal<BenchmarkTimeRange>('90d');
  readonly loadError  = signal<string | null>(null);
  readonly timeRangeOptions = TIME_RANGE_OPTIONS;

  readonly dashboard = toSignal(
    toObservable(this.timeRange).pipe(
      switchMap(r =>
        this.#svc.getDashboard(r).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load benchmarking data'); return of(null); }),
        ),
      ),
    ),
    { initialValue: null as BenchmarkingDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => {
    const d = this.dashboard();
    return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'Efficiency ratio analysis vs. internal and industry benchmarks';
  });

  onTimeRangeChange(r: string) { this.timeRange.set(r as BenchmarkTimeRange); }

  // ── Efficiency ratio horizontal bar ──────────────────────────────────────
  readonly ratioSeries = computed<ApexAxisChartSeries>(() => {
    const items = this.dashboard()?.efficiencyRatios ?? [];
    return [
      { name: 'Actual',     data: items.map(r => r.actual) },
      { name: 'Benchmark',  data: items.map(r => r.benchmark) },
    ];
  });
  readonly ratioXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.efficiencyRatios ?? []).map(r => r.metric),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly ratioChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 300 };
  readonly ratioColors = [CHART_PALETTE[2], CHART_PALETTE[4]];
  readonly ratioTooltip: ApexTooltip = { ...baseChartOptions.tooltip, x: { show: true } };
  readonly ratioYAxis: ApexYAxis = { labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly ratioDataLabels: ApexDataLabels = { enabled: false };

  // ── Benchmark deviation trend line ────────────────────────────────────────
  readonly trendSeries = computed<ApexAxisChartSeries>(() => [{
    name: 'Avg deviation %',
    data: (this.dashboard()?.trendPoints ?? []).map(p => p.avgDeviation),
  }]);
  readonly trendXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.trendPoints ?? []).map(p => p.period),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly trendChart: ApexChart  = { ...baseChartOptions.chart, type: 'line', height: 300 };
  readonly trendStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly trendColors            = [CHART_PALETTE[0]];
  readonly trendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${v.toFixed(1)}%` } };
  readonly trendYAxis: ApexYAxis  = { labels: { formatter: (v: number) => `${v.toFixed(0)}%`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly trendDataLabels: ApexDataLabels = { enabled: false };

  // ── Above-benchmark AG Grid ───────────────────────────────────────────────
  readonly benchmarkRows = computed(() => this.dashboard()?.aboveBenchmark ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<AboveBenchmarkRow>[] = [
    {
      field: 'severity', headerName: 'Severity', maxWidth: 120,
      cellRenderer: (p: ICellRendererParams<AboveBenchmarkRow>) => {
        const vm: Record<BenchmarkDeviationSeverity, string> = { Critical:'sev-critical', Warning:'sev-warning', Advisory:'sev-advisory', On_Target:'sev-ok' };
        return `<span class="sev-badge ${vm[p.value as BenchmarkDeviationSeverity]}">${this.#escape((p.value as string).replace('_',' '))}</span>`;
      },
    },
    {
      field: 'dimension', headerName: 'Dimension', minWidth: 180, flex: 2,
      cellRenderer: (p: ICellRendererParams<AboveBenchmarkRow>) => {
        const r = p.data!;
        return `<div class="dim-cell"><span class="dim-name">${this.#escape(r.dimension)}</span><span class="dim-type">${this.#escape(r.dimensionType)}</span></div>`;
      },
    },
    { field: 'metric', headerName: 'Metric', minWidth: 180 },
    {
      field: 'deviationPct', headerName: 'Deviation', maxWidth: 110, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AboveBenchmarkRow>) => {
        const v = p.value as number;
        const cls = v >= 40 ? 'var-high' : v >= 20 ? 'var-mid' : 'var-ok';
        return `<span class="${cls}">+${v.toFixed(1)}%</span>`;
      },
    },
    {
      field: 'estSavings', headerName: 'Est. savings', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AboveBenchmarkRow>) =>
        `<span class="savings-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>`,
    },
    {
      field: 'linkedActions', headerName: 'Actions', maxWidth: 90, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AboveBenchmarkRow>) => {
        const n = p.value as number;
        return n > 0 ? `<span class="action-pill">${n}</span>` : `<span class="no-action">—</span>`;
      },
    },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #escape(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
