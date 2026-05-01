/* ═══════════════════════════════════════════════════════════════════════════
   gpu-optimizer.component.ts
   FinOps Platform Design System v1.1 — Last verified: 2026-04-13
   GPU Optimizer Dashboard — Agent A16
   Pattern: PageHeader → KPIs → Narrative → CUDA/vRAM trend (full-width)
            → workload donut + GPU node grid (2-col)
   ═══════════════════════════════════════════════════════════════════════════ */
// @ts-nocheck  // individual export below

import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { ChartComponent } from 'ng-apexcharts';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexStroke, ApexTooltip, ApexDataLabels, ApexFill, ApexLegend } from 'ng-apexcharts';
import { startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent } from '@shared/components/narrative-block.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { GpuOptimizerService } from './optimize-2.services';
import { formatCurrency } from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import { type GpuDashboardData, type GpuNodeRow } from '@shared/types/optimize-2-dashboards.types';

@Component({
  selector: 'app-gpu-optimizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, AgGridAngular, ChartComponent, PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './gpu-optimizer.component.html',
  styleUrl:    './gpu-optimizer.component.scss',
})
export class GpuOptimizerComponent {
  readonly #svc   = inject(GpuOptimizerService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('GPU Optimizer · FinOps'); }

  readonly loadError = signal<string | null>(null);
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load GPU data'); return of(null); })),
    { initialValue: null as GpuDashboardData | null },
  );
  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => { const d = this.dashboard(); return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'CUDA utilisation, vRAM, MIG efficiency, and GPU rightsizing recommendations'; });

  // CUDA + vRAM dual-line trend
  readonly trendSeries = computed<ApexAxisChartSeries>(() => [
    { name: 'CUDA util %', data: (this.dashboard()?.trendPoints ?? []).map(p => p.cuda) },
    { name: 'vRAM util %', data: (this.dashboard()?.trendPoints ?? []).map(p => p.vram) },
  ]);
  readonly trendXAxis = computed<ApexXAxis>(() => ({ categories: (this.dashboard()?.trendPoints ?? []).map(p => p.period), tickAmount: 7, labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } }));
  readonly trendChart: ApexChart    = { ...baseChartOptions.chart, type: 'line', height: 280 };
  readonly trendStroke: ApexStroke  = { curve: 'smooth', width: [2, 2] };
  readonly trendColors              = [CHART_PALETTE[0], CHART_PALETTE[2]];
  readonly trendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${v.toFixed(1)}%` } };
  readonly trendYAxis: ApexYAxis    = { min: 0, max: 100, labels: { formatter: (v: number) => `${v}%`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly trendDataLabels: ApexDataLabels = { enabled: false };
  readonly trendLegend: ApexLegend  = { position: 'top', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };

  // Workload classification donut
  readonly wldSeries  = computed<number[]>(() => (this.dashboard()?.workloadDist ?? []).map(w => w.count));
  readonly wldLabels  = computed<string[]>(() => (this.dashboard()?.workloadDist ?? []).map(w => w.label));
  readonly wldChart: ApexChart = { ...baseChartOptions.chart, type: 'donut', height: 240 };
  readonly wldColors           = CHART_PALETTE.slice(0, 4);
  readonly wldLegend: ApexLegend = { position: 'bottom', fontFamily: 'var(--finops-font-family)', fontSize: '11px' };
  readonly wldPlotOptions      = { pie: { donut: { size: '60%' } } };
  readonly wldDataLabels: ApexDataLabels = { enabled: false };
  readonly wldTooltip: ApexTooltip = { ...baseChartOptions.tooltip };

  // GPU node grid
  readonly nodeRows = computed(() => this.dashboard()?.nodes ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<GpuNodeRow>[] = [
    { field: 'nodeName',  headerName: 'Node', minWidth: 200, flex: 2, cellRenderer: (p: ICellRendererParams<GpuNodeRow>) => { const r = p.data!; return `<div class="res-cell"><span class="res-name">${this.#e(r.nodeName)}</span><span class="res-meta">${this.#e(r.gpuModel)}${r.migEnabled?' · MIG':''}</span></div>`; } },
    { field: 'status', headerName: 'Status', maxWidth: 120, cellRenderer: (p: ICellRendererParams<GpuNodeRow>) => { const vm: Record<string,string> = { Active:'success', Idle:'warning', OOM_Risk:'danger', Degraded:'danger' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e((p.value as string).replace('_',' '))}</span>`; } },
    { field: 'cudaUtilPct', headerName: 'CUDA %', maxWidth: 90, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<GpuNodeRow>) => { const v = p.value as number; const cls = v < 20 ? 'util-low' : v > 85 ? 'util-ok' : 'util-mid'; return `<span class="${cls}">${v.toFixed(1)}%</span>`; } },
    { field: 'vramUtilPct', headerName: 'vRAM %',  maxWidth: 90, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<GpuNodeRow>) => { const v = p.value as number; const cls = v > 90 ? 'util-danger' : v > 75 ? 'util-warn' : 'util-ok'; return `<span class="${cls}">${v.toFixed(1)}%</span>`; } },
    { field: 'monthlyCostSar', headerName: 'Monthly cost', maxWidth: 140, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<GpuNodeRow>) => `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'savingsSar', headerName: 'Savings opp.', maxWidth: 140, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<GpuNodeRow>) => { const v = p.value as number; return v > 0 ? `<span class="savings-cell">${formatCurrency(v, { code: p.data!.currency })}</span>` : `<span class="no-savings">Optimised</span>`; } },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
