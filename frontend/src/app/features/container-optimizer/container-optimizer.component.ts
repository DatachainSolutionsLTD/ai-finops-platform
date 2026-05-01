// FinOps Platform Design System v1.1 — Container Optimizer — Agent A17
// Pattern: Dashboard: KPIs → Narrative → savings pipeline bar → cluster score bar → pod rightsizing grid

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { ChartComponent } from 'ng-apexcharts';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexTooltip, ApexDataLabels, ApexPlotOptions, ApexLegend } from 'ng-apexcharts';
import { startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent } from '@shared/components/narrative-block.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { ContainerOptimizerService } from './optimize-2.services';
import { formatCurrency } from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import { type ContainerDashboardData, type PodRightsizingRow, type ClusterScoreRow } from '@shared/types/optimize-2-dashboards.types';

@Component({
  selector: 'app-container-optimizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, AgGridAngular, ChartComponent, PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './container-optimizer.component.html',
  styleUrl:    './container-optimizer.component.scss',
})
export class ContainerOptimizerComponent {
  readonly #svc   = inject(ContainerOptimizerService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('Container Optimizer · FinOps'); }

  readonly loadError = signal<string | null>(null);
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load container data'); return of(null); })),
    { initialValue: null as ContainerDashboardData | null },
  );
  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => { const d = this.dashboard(); return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'Kubernetes pod rightsizing, cluster score, and serverless optimisation'; });

  // Savings pipeline funnel bar
  readonly pipelineSeries = computed<ApexAxisChartSeries>(() => [{ name: 'Savings (AED)', data: (this.dashboard()?.savingsPipeline ?? []).map(s => s.amount) }]);
  readonly pipelineXAxis  = computed<ApexXAxis>(() => ({ categories: (this.dashboard()?.savingsPipeline ?? []).map(s => s.stage), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '12px' } } }));
  readonly pipelineChart: ApexChart   = { ...baseChartOptions.chart, type: 'bar', height: 260 };
  readonly pipelinePlotOptions: ApexPlotOptions = { bar: { borderRadius: 4, columnWidth: '60%' } };
  readonly pipelineColors             = [CHART_PALETTE[0]];
  readonly pipelineTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly pipelineYAxis: ApexYAxis   = { labels: { formatter: (v: number) => `${(v/1000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly pipelineDataLabels: ApexDataLabels = { enabled: false };

  // Cluster scores horizontal bar
  readonly clusterSeries = computed<ApexAxisChartSeries>(() => [{ name: 'Cluster score', data: (this.dashboard()?.clusterScores ?? []).map(c => c.overallScore) }]);
  readonly clusterXAxis  = computed<ApexXAxis>(() => ({ categories: (this.dashboard()?.clusterScores ?? []).map(c => c.clusterName), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } }));
  readonly clusterChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 260 };
  readonly clusterPlotOptions: ApexPlotOptions = { bar: { horizontal: true, borderRadius: 3, barHeight: '55%' } };
  readonly clusterColors = computed<string[]>(() => (this.dashboard()?.clusterScores ?? []).map(c => c.overallScore < 50 ? SEVERITY_COLORS.Critical : c.overallScore < 80 ? SEVERITY_COLORS.Warning : SEVERITY_COLORS.Healthy));
  readonly clusterTooltip: ApexTooltip = { ...baseChartOptions.tooltip, x: { show: true }, y: { formatter: (v: number) => `${v}/100` } };
  readonly clusterYAxis: ApexYAxis = { labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly clusterDataLabels: ApexDataLabels = { enabled: true, formatter: (v: number) => `${v}`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } };

  // Pod rightsizing grid
  readonly podRows = computed(() => this.dashboard()?.podRightsizing ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 100 };
  readonly colDefs: ColDef<PodRightsizingRow>[] = [
    { field: 'workload', headerName: 'Workload', minWidth: 200, flex: 2, cellRenderer: (p: ICellRendererParams<PodRightsizingRow>) => { const r = p.data!; return `<div class="res-cell"><span class="res-name">${this.#e(r.workload)}</span><span class="res-meta">${this.#e(r.namespace)}</span></div>`; } },
    { field: 'currentCpu', headerName: 'CPU req → rec', minWidth: 150, cellRenderer: (p: ICellRendererParams<PodRightsizingRow>) => { const r = p.data!; return `<span class="change-cell">${this.#e(r.currentCpu)} → <strong>${this.#e(r.recCpu)}</strong></span>`; } },
    { field: 'currentMem', headerName: 'Mem req → rec', minWidth: 150, cellRenderer: (p: ICellRendererParams<PodRightsizingRow>) => { const r = p.data!; return `<span class="change-cell">${this.#e(r.currentMem)} → <strong>${this.#e(r.recMem)}</strong></span>`; } },
    { field: 'monthlySavings', headerName: 'Monthly savings', maxWidth: 150, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<PodRightsizingRow>) => `<span class="savings-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'confidence', headerName: 'Conf.', maxWidth: 80, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<PodRightsizingRow>) => { const v = p.value as number; return `<span class="${v>=85 ? 'conf-high' : v>=70 ? 'conf-mid' : 'conf-low'}">${v}%</span>`; } },
    { field: 'risk', headerName: 'Risk', maxWidth: 90, cellRenderer: (p: ICellRendererParams<PodRightsizingRow>) => { const vm: Record<string,string> = { Low:'risk-low', Medium:'risk-medium', High:'risk-high' }; return `<span class="risk-badge ${vm[p.value as string] ?? 'risk-low'}">${this.#e(p.value as string)}</span>`; } },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
