// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Storage Optimizer — Dashboard screen. Agent A19.
// Location: apps/frontend/src/app/features/optimize/storage/
//           storage-optimizer.component.ts
// Pattern: Dashboard (§3.1):
//   PageHeader → KPI row → Narrative
//   → stacked tier-spend bar (full-width) → storage-by-type donut (2-col)
//   → recommendations AG Grid
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';

import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexTooltip, ApexDataLabels, ApexLegend, ApexPlotOptions,
} from 'ng-apexcharts';

import { startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }     from '@shared/components/page-header.component';
import { KpiCardComponent }        from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent } from '@shared/components/narrative-block.component';
import { LoadingStateComponent }   from '@shared/components/loading-state.component';
import { EmptyStateComponent }     from '@shared/components/empty-state.component';

import { StorageOptimizerService } from './optimize-2.services';
import { formatCurrency }          from '@lib/chart-defaults';
import { CHART_PALETTE, baseChartOptions } from '@lib/chart-defaults';
import {
  type StorageDashboardData, type StorageRecRow,
} from '@shared/types/optimize-2-dashboards.types';

@Component({
  selector: 'app-storage-optimizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    AgGridAngular, NgApexchartsModule,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './storage-optimizer.component.html',
  styleUrl:    './storage-optimizer.component.scss',
})
export class StorageOptimizerComponent {
  readonly #svc   = inject(StorageOptimizerService);
  readonly #title = inject(Title);

  constructor() { this.#title.setTitle('Storage Optimizer · FinOps'); }

  readonly loadError = signal<string | null>(null);

  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(
      startWith(null),
      catchError(err => { this.loadError.set(err.title ?? 'Unable to load storage optimization data'); return of(null); }),
    ),
    { initialValue: null as StorageDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => {
    const d = this.dashboard();
    return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : 'Storage tiering, orphan cleanup, and lifecycle optimisation';
  });

  // ── Stacked tier spend bar ────────────────────────────────────────────────
  readonly tierSeries = computed<ApexAxisChartSeries>(() => {
    const d = this.dashboard()?.tierTrend ?? [];
    return [
      { name: 'Hot',     data: d.map(p => p.hot) },
      { name: 'Warm',    data: d.map(p => p.warm) },
      { name: 'Cold',    data: d.map(p => p.cold) },
      { name: 'Archive', data: d.map(p => p.archive) },
    ];
  });
  readonly tierXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.tierTrend ?? []).map(p => p.period),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly tierChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 300, stacked: true };
  readonly tierPlotOptions: ApexPlotOptions = { bar: { borderRadius: 2, columnWidth: '65%' } };
  readonly tierColors = [CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[2], CHART_PALETTE[4]];
  readonly tierTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly tierYAxis: ApexYAxis = { labels: { formatter: (v: number) => `${(v / 1_000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly tierDataLabels: ApexDataLabels = { enabled: false };
  readonly tierLegend: ApexLegend = { position: 'top', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };

  // ── Opportunity type donut ────────────────────────────────────────────────
  readonly oppSeries = computed<number[]>(() => {
    const rows = this.dashboard()?.recommendations ?? [];
    const totals: Record<string, number> = {};
    for (const r of rows) {
      totals[r.type] = (totals[r.type] ?? 0) + r.monthlySavings;
    }
    return Object.values(totals);
  });
  readonly oppLabels = computed<string[]>(() => {
    const rows = this.dashboard()?.recommendations ?? [];
    const keys = new Set<string>();
    for (const r of rows) keys.add(r.type);
    return Array.from(keys).map(k => k.replace(/_/g, ' '));
  });
  readonly oppChart: ApexChart = { ...baseChartOptions.chart, type: 'donut', height: 300 };
  readonly oppColors = CHART_PALETTE.slice(0, 5);
  readonly oppLegend: ApexLegend = { position: 'bottom', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };
  readonly oppPlotOptions = { pie: { donut: { size: '62%', labels: { show: true, total: { show: true, label: 'Savings /mo', fontFamily: 'var(--finops-font-family)' } } } } };
  readonly oppDataLabels: ApexDataLabels = { enabled: false };
  readonly oppTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };

  // ── Recommendations AG Grid ───────────────────────────────────────────────
  readonly recRows     = computed(() => this.dashboard()?.recommendations ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<StorageRecRow>[] = [
    {
      field: 'title', headerName: 'Recommendation', minWidth: 240, flex: 2,
      cellRenderer: (p: ICellRendererParams<StorageRecRow>) => {
        const r = p.data!;
        return `<div class="rec-cell">
          <span class="rec-name">${this.#e(r.title)}</span>
          <span class="rec-meta">${this.#e(r.provider)} · ${this.#e(r.resourceId)}</span>
        </div>`;
      },
    },
    {
      field: 'type', headerName: 'Type', maxWidth: 160,
      cellRenderer: (p: ICellRendererParams<StorageRecRow>) =>
        `<span class="type-chip">${this.#e((p.value as string).replace(/_/g, ' '))}</span>`,
    },
    {
      field: 'monthlySavings', headerName: 'Monthly savings', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<StorageRecRow>) =>
        `<span class="savings-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>`,
    },
    {
      field: 'risk', headerName: 'Risk', maxWidth: 90,
      cellRenderer: (p: ICellRendererParams<StorageRecRow>) => {
        const vm: Record<string, string> = { Low: 'risk-low', Medium: 'risk-medium', High: 'risk-high' };
        return `<span class="risk-badge ${vm[p.value as string] ?? 'risk-low'}">${this.#e(p.value as string)}</span>`;
      },
    },
    {
      field: 'confidence', headerName: 'Conf.', maxWidth: 80, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<StorageRecRow>) => {
        const v = p.value as number;
        return `<span class="${v >= 90 ? 'conf-high' : v >= 75 ? 'conf-mid' : 'conf-low'}">${v}%</span>`;
      },
    },
    {
      field: 'status', headerName: 'Status', maxWidth: 110,
      cellRenderer: (p: ICellRendererParams<StorageRecRow>) => {
        const vm: Record<string, string> = { Pending: 'info', Approved: 'success', Executed: 'success', Rejected: 'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`;
      },
    },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}
