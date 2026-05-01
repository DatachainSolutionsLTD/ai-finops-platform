// FinOps Platform Design System v1.1 — Network Optimizer — Agent A18
// Pattern: Dashboard: KPIs → Narrative → transfer-by-type bar + trend line (2-col) → rec grid

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { NgApexchartsModule } from 'ng-apexcharts';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexTooltip, ApexDataLabels, ApexPlotOptions, ApexStroke } from 'ng-apexcharts';
import { startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent } from '@shared/components/narrative-block.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { NetworkOptimizerService } from './optimize-2.services';
import { formatCurrency } from '@lib/chart-defaults';
import { CHART_PALETTE, baseChartOptions } from '@lib/chart-defaults';
import { type NetworkDashboardData, type NetworkRecommendationRow } from '@shared/types/optimize-2-dashboards.types';

@Component({
  selector: 'app-network-optimizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, AgGridAngular, NgApexchartsModule, PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './network-optimizer.component.html',
  styleUrl:    './network-optimizer.component.scss',
})
export class NetworkOptimizerComponent {
  readonly #svc   = inject(NetworkOptimizerService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('Network Optimizer · FinOps'); }

  readonly loadError = signal<string | null>(null);
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load network data'); return of(null); })),
    { initialValue: null as NetworkDashboardData | null },
  );
  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => { const d = this.dashboard(); return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'Egress costs, inter-region traffic, CDN and NAT Gateway optimisation'; });

  // Transfer by type — vertical bar
  readonly typeSeries = computed<ApexAxisChartSeries>(() => [{ name: 'Monthly cost', data: (this.dashboard()?.transferByType ?? []).map(t => t.cost) }]);
  readonly typeXAxis  = computed<ApexXAxis>(() => ({ categories: (this.dashboard()?.transferByType ?? []).map(t => t.label), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } }));
  readonly typeChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly typePlotOptions: ApexPlotOptions = { bar: { borderRadius: 3, columnWidth: '65%' } };
  readonly typeColors = CHART_PALETTE.slice(0, 5);
  readonly typeTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly typeYAxis: ApexYAxis = { labels: { formatter: (v: number) => `${(v/1_000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly typeDataLabels: ApexDataLabels = { enabled: false };

  // Transfer cost trend
  readonly trendSeries = computed<ApexAxisChartSeries>(() => [{ name: 'Total transfer cost', data: (this.dashboard()?.trendPoints ?? []).map(p => p.cost) }]);
  readonly trendXAxis  = computed<ApexXAxis>(() => ({ categories: (this.dashboard()?.trendPoints ?? []).map(p => p.period), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } }));
  readonly trendChart: ApexChart  = { ...baseChartOptions.chart, type: 'line', height: 280 };
  readonly trendStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly trendColors = [CHART_PALETTE[0]];
  readonly trendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly trendYAxis: ApexYAxis = { labels: { formatter: (v: number) => `${(v/1_000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly trendDataLabels: ApexDataLabels = { enabled: false };

  readonly recRows = computed(() => this.dashboard()?.recommendations ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<NetworkRecommendationRow>[] = [
    { field: 'title', headerName: 'Recommendation', minWidth: 260, flex: 2, cellRenderer: (p: ICellRendererParams<NetworkRecommendationRow>) => { const r = p.data!; return `<div class="res-cell"><span class="res-name">${this.#e(r.title)}</span><span class="res-meta">${this.#e(r.provider)} · ${this.#e(r.type)}</span></div>`; } },
    { field: 'annualSavings', headerName: 'Annual savings', maxWidth: 150, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<NetworkRecommendationRow>) => `<span class="savings-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'complexity', headerName: 'Complexity', maxWidth: 110, cellRenderer: (p: ICellRendererParams<NetworkRecommendationRow>) => { const vm: Record<string,string> = { Low:'risk-low', Medium:'risk-medium', High:'risk-high' }; return `<span class="risk-badge ${vm[p.value as string] ?? 'risk-low'}">${this.#e(p.value as string)}</span>`; } },
    { field: 'status', headerName: 'Status', maxWidth: 110, cellRenderer: (p: ICellRendererParams<NetworkRecommendationRow>) => { const vm: Record<string,string> = { Pending:'info', Approved:'success', Implemented:'success' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`; } },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
