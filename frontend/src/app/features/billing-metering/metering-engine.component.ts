// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Metering Engine Dashboard — Dashboard pattern.
// Location: apps/frontend/src/app/features/platform/metering/
//           metering-engine.component.ts
//
// Pattern: Dashboard (§3.1): PageHeader + TimeRange → KPI row → Narrative
//          → 2×2 chart grid → pipeline health AG Grid drill-down
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Title } from '@angular/platform-browser';

import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonCardTitle,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-community';

import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexStroke,
  ApexFill,
  ApexTooltip,
  ApexDataLabels,
  ApexLegend,
  ApexPlotOptions,
} from 'ng-apexcharts';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }      from '@shared/components/page-header.component';
import { KpiCardComponent }         from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent }  from '@shared/components/narrative-block.component';
import { TimeRangeSelectorComponent } from '@shared/components/time-range-selector.component';
import { LoadingStateComponent }    from '@shared/components/loading-state.component';
import { EmptyStateComponent }      from '@shared/components/empty-state.component';

import { MeteringEngineService }    from './metering-engine.service';
import {
  type MeteringDashboardData,
  type MeteringPipelineHealth,
  type MeteringTimeRange,
} from '@shared/types/metering-engine.types';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';

@Component({
  selector: 'app-metering-engine',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DecimalPipe,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon,
    AgGridAngular,
    NgApexchartsModule,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    TimeRangeSelectorComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './metering-engine.component.html',
  styleUrl:    './metering-engine.component.scss',
})
export class MeteringEngineComponent {
  readonly #svc   = inject(MeteringEngineService);
  readonly #title = inject(Title);

  constructor() {
    this.#title.setTitle('Metering Engine · FinOps');
  }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly timeRange  = signal<MeteringTimeRange>('24h');
  readonly loadError  = signal<string | null>(null);
  readonly timeRangeOptions: MeteringTimeRange[] = ['1h', '6h', '24h', '7d'];

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly dashboard = toSignal(
    toObservable(this.timeRange).pipe(
      switchMap(r =>
        this.#svc.getDashboard(r).pipe(
          startWith(null),
          catchError(err => {
            this.loadError.set(err.title ?? 'Unable to load metering data');
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null as MeteringDashboardData | null },
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => {
    const d = this.dashboard();
    if (!d) return 'Real-time event processing telemetry';
    return `Last updated ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}`;
  });

  onTimeRangeChange(r: string) { this.timeRange.set(r as MeteringTimeRange); }

  // ── Throughput area chart ─────────────────────────────────────────────────
  readonly throughputSeries = computed<ApexAxisChartSeries>(() => {
    const d = this.dashboard();
    if (!d) return [];
    return [
      { name: 'Processed', data: d.throughputSeries.processed },
      { name: 'Failed',    data: d.throughputSeries.failed },
    ];
  });

  readonly throughputXAxis = computed<ApexXAxis>(() => ({
    categories: this.dashboard()?.throughputSeries.timestamps ?? [],
    tickAmount: 8,
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));

  readonly throughputChart: ApexChart   = { ...baseChartOptions.chart, type: 'area', height: 300 };
  readonly throughputStroke: ApexStroke = { curve: 'smooth', width: [2, 1] };
  readonly throughputFill: ApexFill     = { type: ['gradient', 'solid'], gradient: { opacityFrom: 0.3, opacityTo: 0.02 } };
  readonly throughputColors             = [CHART_PALETTE[0], SEVERITY_COLORS.Critical];
  readonly throughputTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${(v / 1000).toFixed(1)}k events` } };
  readonly throughputYAxis: ApexYAxis   = { labels: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly chartDataLabels: ApexDataLabels = { enabled: false };

  // ── Queue depth line chart ────────────────────────────────────────────────
  readonly queueSeries = computed<ApexAxisChartSeries>(() => {
    const d = this.dashboard();
    if (!d) return [];
    return [{ name: 'Queue depth', data: d.queueSeries.depth }];
  });

  readonly queueXAxis = computed<ApexXAxis>(() => ({
    categories: this.dashboard()?.queueSeries.timestamps ?? [],
    tickAmount: 8,
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));

  readonly queueChart: ApexChart  = { ...baseChartOptions.chart, type: 'line', height: 300 };
  readonly queueStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly queueColors            = [CHART_PALETTE[1]];
  readonly queueTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${v.toLocaleString('en-AE')} events` } };
  readonly queueYAxis: ApexYAxis   = { labels: { formatter: (v: number) => v.toLocaleString('en-AE'), style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };

  // ── Pipeline status donut ─────────────────────────────────────────────────
  readonly pipelineSeries = computed<number[]>(() => {
    const d = this.dashboard();
    if (!d) return [];
    const healthy  = d.pipelines.filter(p => p.status === 'Healthy').length;
    const degraded = d.pipelines.filter(p => p.status === 'Degraded').length;
    const down     = d.pipelines.filter(p => p.status === 'Down').length;
    return [healthy, degraded, down];
  });

  readonly pipelineLabels  = ['Healthy', 'Degraded', 'Down'];
  readonly pipelineChart: ApexChart = { ...baseChartOptions.chart, type: 'donut', height: 280 };
  readonly pipelineColors  = [SEVERITY_COLORS.Healthy, SEVERITY_COLORS.Warning, SEVERITY_COLORS.Critical];
  readonly pipelineLegend: ApexLegend = { position: 'bottom', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };
  readonly pipelinePlotOptions: ApexPlotOptions = { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Pipelines', fontFamily: 'var(--finops-font-family)' } } } } };

  // ── Failure rate bar chart ────────────────────────────────────────────────
  readonly failureSeries = computed<ApexAxisChartSeries>(() => {
    const d = this.dashboard();
    if (!d) return [];
    return [{ name: 'Error rate %', data: d.pipelines.map(p => +(p.errorRate.toFixed(2))) }];
  });

  readonly failureXAxis = computed<ApexXAxis>(() => ({
    categories: this.dashboard()?.pipelines.map(p => p.pipelineName.split(' ')[0]) ?? [],
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));

  readonly failureChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly failurePlotOptions: ApexPlotOptions = { bar: { borderRadius: 3, columnWidth: '55%' } };
  readonly failureColors = [CHART_PALETTE[2]];
  readonly failureTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${v}%` } };
  readonly failureYAxis: ApexYAxis = { labels: { formatter: (v: number) => `${v}%`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } }, max: 2 };

  // ── Pipeline AG Grid ──────────────────────────────────────────────────────
  readonly pipelineRows = computed(() => this.dashboard()?.pipelines ?? []);

  readonly defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110,
  };

  readonly pipelineColDefs: ColDef<MeteringPipelineHealth>[] = [
    {
      field: 'pipelineName',
      headerName: 'Pipeline',
      minWidth: 220, flex: 2,
      cellRenderer: (p: ICellRendererParams<MeteringPipelineHealth>) =>
        `<span class="pipe-name">${this.#escape(p.value as string)}</span>`,
    },
    {
      field: 'status',
      headerName: 'Status',
      maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<MeteringPipelineHealth>) => {
        const vm: Record<string, string> = { Healthy: 'success', Degraded: 'warning', Down: 'danger' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(p.value as string)}</span>`;
      },
    },
    {
      field: 'lagSec',
      headerName: 'Lag (s)',
      maxWidth: 120, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<MeteringPipelineHealth>) => {
        const v = p.value as number;
        const cls = v > 10 ? 'lag-high' : v > 5 ? 'lag-medium' : 'lag-ok';
        return `<span class="${cls}">${v.toFixed(1)}s</span>`;
      },
    },
    {
      field: 'throughputEph',
      headerName: 'Throughput/hr',
      minWidth: 140, type: 'numericColumn',
      valueFormatter: p => `${((p.value as number) / 1000).toFixed(0)}k`,
    },
    {
      field: 'errorRate',
      headerName: 'Error rate',
      maxWidth: 120, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<MeteringPipelineHealth>) => {
        const v = p.value as number;
        const cls = v > 0.5 ? 'error-high' : v > 0.1 ? 'error-medium' : 'error-ok';
        return `<span class="${cls}">${v.toFixed(2)}%</span>`;
      },
    },
    {
      field: 'lastEventAt',
      headerName: 'Last event',
      minWidth: 130,
      valueFormatter: p => this.#relativeTime(p.value as string),
    },
  ];

  // ── Retry ─────────────────────────────────────────────────────────────────
  readonly retry = () => { this.loadError.set(null); this.timeRange.set(this.timeRange()); };

  // ── Helpers ───────────────────────────────────────────────────────────────
  #escape(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  #relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
}
