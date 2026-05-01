// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Sustainability — Dashboard screen. Agent A14.
// Location: apps/frontend/src/app/features/optimize/sustainability/
//           sustainability.component.ts
// Pattern: Dashboard (§3.1):
//   PageHeader+TimeRange → KPI row → Narrative
//   → full-width carbon trend area → carbon-by-source donut + green opps bar (2-col)
//   → green opportunities AG Grid
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';

import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexStroke, ApexFill, ApexTooltip, ApexDataLabels, ApexLegend,
  ApexNonAxisChartSeries, ApexPlotOptions,
} from 'ng-apexcharts';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }        from '@shared/components/page-header.component';
import { KpiCardComponent }           from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent }    from '@shared/components/narrative-block.component';
import { TimeRangeSelectorComponent } from '@shared/components/time-range-selector.component';
import { LoadingStateComponent }      from '@shared/components/loading-state.component';
import { EmptyStateComponent }        from '@shared/components/empty-state.component';

import { SustainabilityService }      from './optimize-1.services';
import { formatCurrency }             from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import {
  type SustainabilityDashboardData,
  type GreenOpportunityRow,
  type SustainabilityTimeRange,
} from '@shared/types/optimize-dashboards.types';

const TIME_RANGE_OPTIONS: SustainabilityTimeRange[] = ['30d', '90d', '6m', '12m'];

@Component({
  selector: 'app-sustainability',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon,
    AgGridAngular, NgApexchartsModule,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    TimeRangeSelectorComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './sustainability.component.html',
  styleUrl:    './sustainability.component.scss',
})
export class SustainabilityComponent {
  readonly #svc   = inject(SustainabilityService);
  readonly #title = inject(Title);

  constructor() { this.#title.setTitle('Sustainability · FinOps'); }

  readonly timeRange        = signal<SustainabilityTimeRange>('12m');
  readonly loadError        = signal<string | null>(null);
  readonly timeRangeOptions = TIME_RANGE_OPTIONS;

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly dashboard = toSignal(
    toObservable(this.timeRange).pipe(
      switchMap(r =>
        this.#svc.getDashboard(r).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load sustainability data'); return of(null); }),
        ),
      ),
    ),
    { initialValue: null as SustainabilityDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => {
    const d = this.dashboard();
    return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'Carbon footprint, green optimization, and ESG reporting';
  });

  onTimeRangeChange(r: string) { this.timeRange.set(r as SustainabilityTimeRange); }

  // ── Carbon trend — full-width area ────────────────────────────────────────
  readonly carbonTrendSeries = computed<ApexAxisChartSeries>(() => [{
    name: 'Carbon footprint (kgCO2eq)',
    data: (this.dashboard()?.carbonTrend ?? []).map(p => p.carbon),
  }]);
  readonly carbonTrendXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.carbonTrend ?? []).map(p => p.period),
    tickAmount: 8,
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly carbonTrendChart: ApexChart    = { ...baseChartOptions.chart, type: 'area', height: 300 };
  readonly carbonTrendStroke: ApexStroke  = { curve: 'smooth', width: 2 };
  readonly carbonTrendFill: ApexFill      = { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.02 } };
  readonly carbonTrendColors              = [CHART_PALETTE[3]];  // forest green
  readonly carbonTrendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${(v/1000).toFixed(1)} tCO2eq` } };
  readonly carbonTrendYAxis: ApexYAxis    = { labels: { formatter: (v: number) => `${(v/1000).toFixed(0)}t`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly carbonDataLabels: ApexDataLabels = { enabled: false };

  // ── Carbon by source — donut ──────────────────────────────────────────────
  readonly sourceSeries = computed<number[]>(() =>
    (this.dashboard()?.carbonBySource ?? []).map(s => s.carbon));
  readonly sourceLabels = computed<string[]>(() =>
    (this.dashboard()?.carbonBySource ?? []).map(s => s.label));
  readonly sourceChart: ApexChart = { ...baseChartOptions.chart, type: 'donut', height: 280 };
  readonly sourceColors           = [CHART_PALETTE[2], CHART_PALETTE[5], CHART_PALETTE[0], CHART_PALETTE[4]];
  readonly sourceLegend: ApexLegend = { position: 'bottom', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };
  readonly sourcePlotOptions: ApexPlotOptions = {
    pie: { donut: { size: '62%', labels: { show: true, total: { show: true, label: 'kgCO2eq', fontFamily: 'var(--finops-font-family)' } } } },
  };
  readonly sourceDataLabels: ApexDataLabels = { enabled: false };
  readonly sourceTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${(v/1000).toFixed(1)} tCO2eq` } };

  // ── Green opportunities — horizontal bar ──────────────────────────────────
  readonly oppSeries = computed<ApexAxisChartSeries>(() => [{
    name: 'Carbon reduction (kgCO2eq)',
    data: (this.dashboard()?.opportunities ?? []).map(o => o.projectedReductionKg),
  }]);
  readonly oppXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.opportunities ?? []).map(o => o.title.substring(0, 30) + (o.title.length > 30 ? '…' : '')),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '10px' } },
  }));
  readonly oppChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly oppPlotOptions: ApexPlotOptions = { bar: { horizontal: true, borderRadius: 3, barHeight: '55%' } };
  readonly oppColors              = [CHART_PALETTE[3]];
  readonly oppTooltip: ApexTooltip = { ...baseChartOptions.tooltip, x: { show: true }, y: { formatter: (v: number) => `${v.toLocaleString('en-AE')} kgCO2eq reduction` } };
  readonly oppYAxis: ApexYAxis    = { labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '10px' } } };
  readonly oppDataLabels: ApexDataLabels = { enabled: false };

  // ── Green opportunities AG Grid ───────────────────────────────────────────
  readonly oppRows   = computed(() => this.dashboard()?.opportunities ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<GreenOpportunityRow>[] = [
    {
      field: 'priority', headerName: 'Priority', maxWidth: 110,
      cellRenderer: (p: ICellRendererParams<GreenOpportunityRow>) => {
        const vm: Record<string, string> = { Critical:'prio-critical', High:'prio-high', Medium:'prio-medium', Low:'prio-low' };
        return `<span class="prio-badge ${vm[p.value as string] ?? 'prio-low'}">${this.#e(p.value as string)}</span>`;
      },
    },
    {
      field: 'title', headerName: 'Opportunity', minWidth: 240, flex: 2,
      cellRenderer: (p: ICellRendererParams<GreenOpportunityRow>) => {
        const r = p.data!;
        return `<div class="res-cell">
          <span class="res-name">${this.#e(r.title)}</span>
          <span class="res-meta">${this.#e(r.type)} · ${this.#e(r.businessUnit)}</span>
        </div>`;
      },
    },
    {
      field: 'projectedReductionKg', headerName: 'CO2 reduction', maxWidth: 150, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<GreenOpportunityRow>) => {
        const v = p.value as number;
        return `<span class="carbon-cell">${(v/1000).toFixed(2)} tCO2eq <span class="reduction-pct">(-${p.data!.reductionPct.toFixed(0)}%)</span></span>`;
      },
    },
    {
      field: 'costImpact', headerName: 'Cost impact', maxWidth: 150, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<GreenOpportunityRow>) => {
        const v = p.value as number;
        if (v === 0) return `<span class="impact-neutral">No cost change</span>`;
        const cls = v < 0 ? 'impact-saving' : 'impact-cost';
        const label = v < 0 ? `Saves ${formatCurrency(Math.abs(v), { code: p.data!.currency })}` : `+${formatCurrency(v, { code: p.data!.currency })}`;
        return `<span class="${cls}">${label}</span>`;
      },
    },
    {
      field: 'status', headerName: 'Status', maxWidth: 120,
      cellRenderer: (p: ICellRendererParams<GreenOpportunityRow>) => {
        const vm: Record<string, string> = { Pending:'info', Approved:'success', Implemented:'success' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`;
      },
    },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
