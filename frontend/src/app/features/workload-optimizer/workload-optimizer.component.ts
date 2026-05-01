// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Workload Optimizer — Dashboard (Agent A11).
// Location: apps/frontend/src/app/features/optimize/workload/
//           workload-optimizer.component.ts
// Pattern: Dashboard (§3.1): PageHeader+TimeRange → KPIs → Narrative
//   → 2-col (opportunity donut + savings trend bar) → top resources AG Grid
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

import { ChartComponent } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexStroke, ApexTooltip, ApexDataLabels, ApexLegend, ApexPlotOptions,
} from 'ng-apexcharts';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }        from '@shared/components/page-header.component';
import { KpiCardComponent }           from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent }    from '@shared/components/narrative-block.component';
import { TimeRangeSelectorComponent } from '@shared/components/time-range-selector.component';
import { LoadingStateComponent }      from '@shared/components/loading-state.component';
import { EmptyStateComponent }        from '@shared/components/empty-state.component';

import { WorkloadOptimizerService }   from './optimize-1.services';
import { formatCurrency }             from '@lib/chart-defaults';
import { CHART_PALETTE, baseChartOptions } from '@lib/chart-defaults';
import {
  type WorkloadDashboardData, type WorkloadResourceRow, type WorkloadOptTimeRange,
} from '@shared/types/optimize-dashboards.types';

const TIME_RANGE_OPTIONS: WorkloadOptTimeRange[] = ['7d', '30d', '90d'];

@Component({
  selector: 'app-workload-optimizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon,
    AgGridAngular, ChartComponent,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    TimeRangeSelectorComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './workload-optimizer.component.html',
  styleUrl:    './workload-optimizer.component.scss',
})
export class WorkloadOptimizerComponent {
  readonly #svc   = inject(WorkloadOptimizerService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('Workload Optimizer · FinOps'); }

  readonly timeRange  = signal<WorkloadOptTimeRange>('30d');
  readonly loadError  = signal<string | null>(null);
  readonly timeRangeOptions = TIME_RANGE_OPTIONS;

  readonly dashboard = toSignal(
    toObservable(this.timeRange).pipe(
      switchMap(r => this.#svc.getDashboard(r).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load workload optimization data'); return of(null); }))),
    ),
    { initialValue: null as WorkloadDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => { const d = this.dashboard(); return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'Rightsizing, idle detection, and schedule automation recommendations'; });

  onTimeRangeChange(r: string) { this.timeRange.set(r as WorkloadOptTimeRange); }

  // Opportunity donut
  readonly oppSeries  = computed<number[]>(() => (this.dashboard()?.opportunityBreakdown ?? []).map(o => o.totalSavings));
  readonly oppLabels  = computed<string[]>(() => (this.dashboard()?.opportunityBreakdown ?? []).map(o => o.type));
  readonly oppChart: ApexChart = { ...baseChartOptions.chart, type: 'donut', height: 280 };
  readonly oppColors  = CHART_PALETTE.slice(0, 5);
  readonly oppPlotOptions = { pie: { donut: { size: '62%', labels: { show: true, total: { show: true, label: 'Total savings', fontFamily: 'var(--finops-font-family)' } } } } };
  readonly oppLegend: ApexLegend = { position: 'bottom', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };
  readonly oppDataLabels: ApexDataLabels = { enabled: false };
  readonly oppTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };

  // Savings trend grouped bar
  readonly trendSeries = computed<ApexAxisChartSeries>(() => {
    const d = this.dashboard()?.savingsTrend ?? [];
    return [{ name: 'Projected', data: d.map(p => p.projected) }, { name: 'Realized', data: d.map(p => p.realized) }];
  });
  readonly trendXAxis = computed<ApexXAxis>(() => ({ categories: (this.dashboard()?.savingsTrend ?? []).map(p => p.period), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } }));
  readonly trendChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly trendPlotOptions: ApexPlotOptions = { bar: { borderRadius: 3, columnWidth: '65%', groupPadding: 0.1 } };
  readonly trendColors = [CHART_PALETTE[4], CHART_PALETTE[0]];
  readonly trendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly trendYAxis: ApexYAxis = { labels: { formatter: (v: number) => `${(v/1_000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly trendDataLabels: ApexDataLabels = { enabled: false };
  readonly trendLegend: ApexLegend = { position: 'top', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };

  // Top resources grid
  readonly resourceRows = computed(() => this.dashboard()?.topResources ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<WorkloadResourceRow>[] = [
    { field: 'resourceName', headerName: 'Resource', minWidth: 200, flex: 2, cellRenderer: (p: ICellRendererParams<WorkloadResourceRow>) => { const r = p.data!; return `<div class="res-cell"><span class="res-name">${this.#e(r.resourceName)}</span><span class="res-meta">${this.#e(r.provider)} · ${this.#e(r.resourceType)} · ${this.#e(r.environment)}</span></div>`; } },
    { field: 'businessUnit', headerName: 'BU', maxWidth: 160 },
    { field: 'optimizationType', headerName: 'Type', maxWidth: 160, cellRenderer: (p: ICellRendererParams<WorkloadResourceRow>) => `<span class="type-chip">${this.#e(p.value as string)}</span>` },
    { field: 'savingsAmount', headerName: 'Annual savings', maxWidth: 160, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<WorkloadResourceRow>) => `<span class="savings-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'confidenceScore', headerName: 'Conf.', maxWidth: 80, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<WorkloadResourceRow>) => { const v = p.value as number; return `<span class="${v >= 90 ? 'conf-high' : v >= 75 ? 'conf-mid' : 'conf-low'}">${v}%</span>`; } },
    { field: 'status', headerName: 'Status', maxWidth: 110, cellRenderer: (p: ICellRendererParams<WorkloadResourceRow>) => { const vm: Record<string, string> = { Pending:'info', Approved:'success', Executed:'success' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`; } },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
