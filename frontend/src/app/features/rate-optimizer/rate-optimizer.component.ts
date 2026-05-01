// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Rate Optimizer — Dashboard (Agent A12).
// Pattern: Dashboard: PageHeader+TimeRange → KPIs → Narrative
//   → portfolio utilisation bar + savings trend bar → recommendations AG Grid

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { ChartComponent } from 'ng-apexcharts';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexTooltip, ApexDataLabels, ApexLegend, ApexPlotOptions } from 'ng-apexcharts';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent } from '@shared/components/narrative-block.component';
import { TimeRangeSelectorComponent } from '@shared/components/time-range-selector.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { RateOptimizerService } from './optimize-1.services';
import { formatCurrency } from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import { type RateDashboardData, type RateRecommendationRow, type RateOptTimeRange } from '@shared/types/optimize-dashboards.types';

const TIME_RANGE_OPTIONS: RateOptTimeRange[] = ['30d', '90d', '12m'];

@Component({
  selector: 'app-rate-optimizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, AgGridAngular, ChartComponent, PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent, TimeRangeSelectorComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './rate-optimizer.component.html',
  styleUrl:    './rate-optimizer.component.scss',
})
export class RateOptimizerComponent {
  readonly #svc   = inject(RateOptimizerService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('Rate Optimizer · FinOps'); }

  readonly timeRange  = signal<RateOptTimeRange>('90d');
  readonly loadError  = signal<string | null>(null);
  readonly timeRangeOptions = TIME_RANGE_OPTIONS;

  readonly dashboard = toSignal(
    toObservable(this.timeRange).pipe(
      switchMap(r => this.#svc.getDashboard(r).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load rate optimization data'); return of(null); }))),
    ),
    { initialValue: null as RateDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => { const d = this.dashboard(); return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'Reserved instances, savings plans, and commitment portfolio management'; });

  onTimeRangeChange(r: string) { this.timeRange.set(r as RateOptTimeRange); }

  // Portfolio utilisation horizontal bar
  readonly portSeries = computed<ApexAxisChartSeries>(() => [{ name: 'Utilisation %', data: (this.dashboard()?.portfolioByProvider ?? []).map(p => +p.utilization.toFixed(1)) }]);
  readonly portXAxis  = computed<ApexXAxis>(() => ({ categories: (this.dashboard()?.portfolioByProvider ?? []).map(p => `${p.provider} ${p.type}`), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } }));
  readonly portChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly portPlotOptions: ApexPlotOptions = { bar: { horizontal: true, borderRadius: 3, barHeight: '55%' } };
  readonly portColors = computed<string[]>(() => (this.dashboard()?.portfolioByProvider ?? []).map(p => p.utilization < 80 ? SEVERITY_COLORS.Warning : SEVERITY_COLORS.Healthy));
  readonly portTooltip: ApexTooltip = { ...baseChartOptions.tooltip, x: { show: true }, y: { formatter: (v: number) => `${v}% utilised` } };
  readonly portYAxis: ApexYAxis = { labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly portDataLabels: ApexDataLabels = { enabled: true, formatter: (v: number) => `${v}%`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } };

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

  // Recommendations grid
  readonly recRows = computed(() => this.dashboard()?.recommendations ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<RateRecommendationRow>[] = [
    { field: 'title', headerName: 'Recommendation', minWidth: 260, flex: 2, cellRenderer: (p: ICellRendererParams<RateRecommendationRow>) => { const r = p.data!; return `<div class="res-cell"><span class="res-name">${this.#e(r.title)}</span><span class="res-meta">${this.#e(r.provider)} · ${this.#e(r.instrument)}</span></div>`; } },
    { field: 'annualSavings', headerName: 'Annual savings', maxWidth: 160, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<RateRecommendationRow>) => `<span class="savings-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'breakEvenMonths', headerName: 'Break-even', maxWidth: 120, type: 'numericColumn', valueFormatter: p => `${(p.value as number).toFixed(1)} mo` },
    { field: 'risk', headerName: 'Risk', maxWidth: 90, cellRenderer: (p: ICellRendererParams<RateRecommendationRow>) => { const vm: Record<string, string> = { Low:'risk-low', Medium:'risk-medium', High:'risk-high' }; return `<span class="risk-badge ${vm[p.value as string] ?? 'risk-low'}">${this.#e(p.value as string)}</span>`; } },
    { field: 'status', headerName: 'Status', maxWidth: 110, cellRenderer: (p: ICellRendererParams<RateRecommendationRow>) => { const vm: Record<string, string> = { Pending:'info', Approved:'success' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`; } },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
