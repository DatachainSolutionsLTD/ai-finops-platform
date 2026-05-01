// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Unit Economics — Dashboard screen. Agent A09.
// Location: apps/frontend/src/app/features/quantify/unit-economics/
//           unit-economics.component.ts
// Pattern: Dashboard (§3.1):
//   PageHeader+TimeRange → KPI row → Narrative
//   → CPT trend line (full-width) → efficiency leaderboard AG Grid
//   → CPT heatmap summary card (right column) in 2-col grid
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
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonButton, IonIcon,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';

import { ChartComponent } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexStroke, ApexFill, ApexTooltip, ApexDataLabels, ApexLegend,
} from 'ng-apexcharts';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }        from '@shared/components/page-header.component';
import { KpiCardComponent }           from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent }    from '@shared/components/narrative-block.component';
import { TimeRangeSelectorComponent } from '@shared/components/time-range-selector.component';
import { LoadingStateComponent }      from '@shared/components/loading-state.component';
import { EmptyStateComponent }        from '@shared/components/empty-state.component';

import { UnitEconomicsService }  from './unit-economics.service';
import { formatCurrency }        from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import {
  type UnitEconomicsDashboardData,
  type EfficiencyLeaderboardRow,
  type EfficiencyRating,
  type UETimeRange,
} from '@shared/types/quantify-dashboards.types';

const TIME_RANGE_OPTIONS: UETimeRange[] = ['30d', '90d', '6m', '12m'];

@Component({
  selector: 'app-unit-economics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DecimalPipe,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon,
    AgGridAngular, ChartComponent,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    TimeRangeSelectorComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './unit-economics.component.html',
  styleUrl:    './unit-economics.component.scss',
})
export class UnitEconomicsComponent {
  readonly #svc   = inject(UnitEconomicsService);
  readonly #title = inject(Title);

  constructor() { this.#title.setTitle('Unit Economics · FinOps'); }

  readonly timeRange        = signal<UETimeRange>('30d');
  readonly loadError        = signal<string | null>(null);
  readonly timeRangeOptions = TIME_RANGE_OPTIONS;

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly dashboard = toSignal(
    toObservable(this.timeRange).pipe(
      switchMap(r =>
        this.#svc.getDashboard(r).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load unit economics data'); return of(null); }),
        ),
      ),
    ),
    { initialValue: null as UnitEconomicsDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => {
    const d = this.dashboard();
    return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'Cost per transaction (CPT) and efficiency scoring across all applications';
  });

  onTimeRangeChange(r: string) { this.timeRange.set(r as UETimeRange); }

  // ── CPT trend — full-width area ───────────────────────────────────────────
  readonly cptSeries = computed<ApexAxisChartSeries>(() => [{
    name: 'Cost per transaction',
    data: (this.dashboard()?.cptTrend ?? []).map(p => p.cpt),
  }]);
  readonly cptXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.cptTrend ?? []).map(p => p.date),
    tickAmount: 8,
    labels: { rotate: -30, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly cptChart: ApexChart    = { ...baseChartOptions.chart, type: 'area', height: 300 };
  readonly cptStroke: ApexStroke  = { curve: 'smooth', width: 2 };
  readonly cptFill: ApexFill      = { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.02 } };
  readonly cptColors              = [CHART_PALETTE[0]];
  readonly cptTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly cptYAxis: ApexYAxis    = { labels: { formatter: (v: number) => v.toFixed(4), style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly cptDataLabels: ApexDataLabels = { enabled: false };

  // ── Efficiency leaderboard AG Grid ────────────────────────────────────────
  readonly leaderboardRows = computed(() => this.dashboard()?.leaderboard ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<EfficiencyLeaderboardRow>[] = [
    {
      field: 'rank', headerName: '#', maxWidth: 60, sortable: false, filter: false, flex: 0,
      cellRenderer: (p: ICellRendererParams<EfficiencyLeaderboardRow>) =>
        `<span class="rank-cell">${p.value}</span>`,
    },
    {
      field: 'appName', headerName: 'Application', minWidth: 200, flex: 2,
      cellRenderer: (p: ICellRendererParams<EfficiencyLeaderboardRow>) => {
        const r = p.data!;
        return `<div class="app-cell">
          <span class="app-name">${this.#escape(r.appName)}</span>
          <span class="app-bu">${this.#escape(r.businessUnit)}</span>
        </div>`;
      },
    },
    {
      field: 'rating', headerName: 'Efficiency', maxWidth: 155,
      cellRenderer: (p: ICellRendererParams<EfficiencyLeaderboardRow>) => {
        const vm: Record<EfficiencyRating, string> = {
          Excellent: 'rating-excellent', Good: 'rating-good',
          Needs_Attention: 'rating-warn', Critical: 'rating-critical',
        };
        const label = (p.value as string).replace('_', ' ');
        return `<span class="rating-badge ${vm[p.value as EfficiencyRating]}">${this.#escape(label)}</span>`;
      },
    },
    {
      field: 'currentCpt', headerName: 'CPT', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<EfficiencyLeaderboardRow>) =>
        `<span class="cpt-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>`,
    },
    {
      field: 'momChange', headerName: 'MoM', maxWidth: 90, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<EfficiencyLeaderboardRow>) => {
        const v = p.value as number;
        const cls = v > 10 ? 'mom-bad' : v > 0 ? 'mom-warn' : 'mom-good';
        const arrow = v > 0 ? '▲' : '▼';
        return `<span class="${cls}">${arrow} ${Math.abs(v).toFixed(1)}%</span>`;
      },
    },
    {
      field: 'ces', headerName: 'CES', maxWidth: 80, type: 'numericColumn',
      valueFormatter: p => (p.value as number).toFixed(2),
    },
    {
      field: 'transactions', headerName: 'Transactions', minWidth: 140, type: 'numericColumn',
      valueFormatter: p => ((p.value as number) / 1_000_000).toFixed(2) + 'M',
    },
  ];

  // ── CPT heatmap data ──────────────────────────────────────────────────────
  readonly heatmapRows = computed(() => {
    const cells = this.dashboard()?.heatmapData ?? [];
    // Group by rowLabel
    const grouped = new Map<string, Map<string, { cpt: number; currency: string }>>();
    for (const c of cells) {
      if (!grouped.has(c.rowLabel)) grouped.set(c.rowLabel, new Map());
      grouped.get(c.rowLabel)!.set(c.colLabel, { cpt: c.cpt, currency: c.currency });
    }
    return Array.from(grouped.entries()).map(([bu, envMap]) => ({ bu, envMap }));
  });
  readonly heatmapCols = computed(() => {
    const cols = new Set<string>();
    for (const c of this.dashboard()?.heatmapData ?? []) cols.add(c.colLabel);
    return Array.from(cols);
  });

  // Returns token class name for a CPT value (0.001 is excellent, >0.01 is critical)
  cptHeatClass(cpt: number): string {
    if (cpt === 0)     return 'heat-zero';
    if (cpt > 0.015)   return 'heat-critical';
    if (cpt > 0.005)   return 'heat-warn';
    if (cpt > 0.001)   return 'heat-ok';
    return 'heat-excellent';
  }

  readonly retry = () => { this.loadError.set(null); };
  #escape(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
