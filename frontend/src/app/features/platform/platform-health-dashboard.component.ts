// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Platform Health Dashboard — the reference exemplar for the Dashboard pattern.
// Location: apps/frontend/src/app/features/platform/health/
//           platform-health-dashboard.component.ts
//
// This file implements the Dashboard pattern from 02_Component_Pattern_Library.md §3.1:
//   PageHeader → KPI row → Narrative → 2x2 chart grid → AG Grid drill-down
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';

import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonCardTitle,
  IonToolbar,
  IonSearchbar,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowClickedEvent,
} from 'ag-grid-community';

import { ChartComponent } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries,
  ApexNonAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexStroke,
  ApexFill,
  ApexTooltip,
  ApexPlotOptions,
  ApexDataLabels,
  ApexLegend,
} from 'ng-apexcharts';

import { switchMap, startWith, catchError, of } from 'rxjs';

// Platform component library
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card.component';
import { StatusBadgeComponent } from '@shared/components/status-badge.component';
import { NarrativeBlockComponent } from '@shared/components/narrative-block.component';
import { TimeRangeSelectorComponent } from '@shared/components/time-range-selector.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';

// Chart defaults
import {
  baseChartOptions,
  CHART_PALETTE,
  SEVERITY_COLORS,
  formatAmount,
  formatCurrency,
  formatPercent,
} from '@shared/charts/chart-defaults';

// Auth + tenant context
import { AuthService } from '@core/auth/auth.service';
import { TenantContextService } from '@core/tenant/tenant-context.service';

// Local feature code
import { PlatformHealthService } from './platform-health.service';
import type {
  PlatformHealthOverview,
  ActiveTenantRow,
  TimeRange,
} from '@shared/types/platform-health.types';

@Component({
  selector: 'app-platform-health-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonCardTitle,
    IonToolbar,
    IonSearchbar,
    IonButton,
    IonIcon,
    AgGridAngular,
    ChartComponent,
    PageHeaderComponent,
    KpiCardComponent,
    StatusBadgeComponent,
    NarrativeBlockComponent,
    TimeRangeSelectorComponent,
    LoadingStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './platform-health-dashboard.component.html',
  styleUrl: './platform-health-dashboard.component.scss',
})
export class PlatformHealthDashboardComponent {
  readonly #healthService = inject(PlatformHealthService);
  readonly #auth = inject(AuthService);
  readonly #tenantCtx = inject(TenantContextService);
  readonly #router = inject(Router);
  readonly #title = inject(Title);

  constructor() {
    this.#title.setTitle('Platform Health · FinOps');
  }

  // ── Local state ──────────────────────────────────────────────────────────
  readonly timeRange = signal<TimeRange>('7d');
  readonly searchText = signal<string>('');
  readonly loadError = signal<string | null>(null);

  #gridApi: GridApi<ActiveTenantRow> | null = null;

  // ── Data signals — re-fire when timeRange changes ────────────────────────
  readonly overview = toSignal(
    toObservable(this.timeRange).pipe(
      switchMap(range =>
        this.#healthService.getOverview(range).pipe(
          startWith(null as PlatformHealthOverview | null),
          catchError(err => {
            this.loadError.set(err.title ?? 'Unable to load platform health');
            return of(null as PlatformHealthOverview | null);
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  readonly tenants = toSignal(
    toObservable(this.timeRange).pipe(
      switchMap(range => this.#healthService.getActiveTenants(range)),
      catchError(() => of([] as ActiveTenantRow[])),
    ),
    { initialValue: [] as ActiveTenantRow[] },
  );

  // ── Derived signals ──────────────────────────────────────────────────────
  readonly isLoading = computed(() => this.overview() === null && this.loadError() === null);
  readonly hasData = computed(() => this.overview() !== null);
  readonly kpis = computed(() => this.overview()?.kpis);
  readonly narrative = computed(() => this.overview()?.narrative);
  readonly fpTrend = computed(() => this.overview()?.fpTrend ?? []);
  readonly agentCategoryBreakdown = computed(() => this.overview()?.fpByAgentCategory ?? []);
  readonly tierDistribution = computed(() => this.overview()?.tenantTierDistribution ?? []);
  readonly slo = computed(() => this.overview()?.sloSummary);

  readonly subtitle = computed(() => {
    const gen = this.overview()?.generatedAt;
    return gen ? `Last refreshed ${new Date(gen).toLocaleTimeString()}` : 'Loading platform snapshot...';
  });

  // ── FP Trend chart (area) ────────────────────────────────────────────────
  readonly fpTrendSeries = computed<ApexAxisChartSeries>(() => [
    { name: 'Processed', data: this.fpTrend().map(p => p.fpProcessed) },
    { name: 'Billed',    data: this.fpTrend().map(p => p.fpBilled) },
  ]);

  readonly fpTrendXaxis = computed<ApexXAxis>(() => ({
    categories: this.fpTrend().map(p => new Date(p.periodStart).toLocaleDateString(
      undefined, { month: 'short', day: 'numeric' },
    )),
    axisBorder: { color: 'var(--finops-border-default)' },
    axisTicks: { color: 'var(--finops-border-default)' },
  }));

  readonly fpTrendChart: ApexChart = {
    type: 'area',
    height: 300,
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
  };
  readonly fpTrendStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly fpTrendFill: ApexFill = {
    type: 'gradient',
    gradient: { opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] },
  };
  readonly fpTrendColors = [CHART_PALETTE[0], CHART_PALETTE[1]];

  readonly fpTrendYaxis: ApexYAxis = {
    labels: {
      formatter: (val: number) => formatAmount(val),
      style: { fontFamily: "'IBM Plex Sans Condensed', sans-serif", fontSize: '12px' },
    },
  };

  readonly fpTrendTooltip: ApexTooltip = {
    theme: 'light',
    y: { formatter: (val: number) => `${formatAmount(val)} FP` },
  };

  // ── FP by Agent Category chart (bar) ─────────────────────────────────────
  readonly agentCategorySeries = computed<ApexAxisChartSeries>(() => [
    { name: 'FP processed', data: this.agentCategoryBreakdown().map(b => b.fpProcessed) },
  ]);

  readonly agentCategoryXaxis = computed<ApexXAxis>(() => ({
    categories: this.agentCategoryBreakdown().map(b => b.category),
  }));

  readonly agentCategoryChart: ApexChart = {
    type: 'bar',
    height: 300,
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
  };
  readonly agentCategoryPlotOptions: ApexPlotOptions = {
    bar: { borderRadius: 4, columnWidth: '55%', distributed: true },
  };
  readonly agentCategoryDataLabels: ApexDataLabels = { enabled: false };
  readonly agentCategoryLegend: ApexLegend = { show: false };
  readonly agentCategoryColors = CHART_PALETTE.slice(0, 6);

  // ── Tenant Tier Distribution chart (donut) ───────────────────────────────
  readonly tierSeries = computed<ApexNonAxisChartSeries>(() =>
    this.tierDistribution().map(t => t.tenantCount),
  );
  readonly tierLabels = computed<string[]>(() =>
    this.tierDistribution().map(t => t.tierName),
  );
  readonly tierChart: ApexChart = {
    type: 'donut',
    height: 280,
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
  };
  readonly tierColors = [CHART_PALETTE[5], CHART_PALETTE[0], CHART_PALETTE[1]];
  readonly tierLegend: ApexLegend = {
    position: 'bottom',
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
    fontSize: '13px',
  };

  // ── Platform SLO chart (radial) ──────────────────────────────────────────
  readonly sloSeries = computed<number[]>(() => [this.slo()?.overallPercent ?? 0]);
  readonly sloLabels: string[] = ['Overall SLO'];
  readonly sloChart: ApexChart = {
    type: 'radialBar',
    height: 280,
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
  };
  readonly sloPlotOptions: ApexPlotOptions = {
    radialBar: {
      hollow: { size: '65%' },
      track: { background: 'var(--finops-bg-subtle)' },
      dataLabels: {
        value: {
          fontSize: '28px',
          fontWeight: 700,
          fontFamily: "'IBM Plex Sans Condensed', sans-serif",
          color: 'var(--finops-text-primary)',
          formatter: (val: number) => `${val.toFixed(2)}%`,
        },
        name: {
          fontSize: '13px',
          fontFamily: "'IBM Plex Sans Condensed', sans-serif",
          color: 'var(--finops-text-secondary)',
        },
      },
    },
  };
  readonly sloColors = [CHART_PALETTE[3]]; // Forest green — healthy

  // ── AG Grid config for active tenants ────────────────────────────────────
  readonly defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 110,
  };

  readonly tenantColDefs: ColDef<ActiveTenantRow>[] = [
    {
      field: 'displayName',
      headerName: 'Tenant',
      minWidth: 180,
      flex: 2,
      cellRenderer: (p: ICellRendererParams<ActiveTenantRow>) => {
        const r = p.data!;
        return `<div class="tenant-cell">
          <div class="tenant-name">${this.#escape(r.displayName)}</div>
          <div class="tenant-code">${this.#escape(r.tenantCode)}</div>
        </div>`;
      },
    },
    {
      field: 'tierName',
      headerName: 'Tier',
      maxWidth: 150,
    },
    {
      field: 'status',
      headerName: 'Status',
      maxWidth: 140,
      cellRenderer: StatusBadgeComponent,
      cellRendererParams: (p: ICellRendererParams<ActiveTenantRow>) => ({
        label: p.data!.status,
        variant: this.#statusToVariant(p.data!.status),
      }),
    },
    {
      field: 'fpProcessedToday',
      headerName: 'FP today',
      type: 'numericColumn',
      maxWidth: 130,
      valueFormatter: p => formatAmount(p.value),
    },
    {
      field: 'fpQuotaPercent',
      headerName: 'Quota used',
      type: 'numericColumn',
      maxWidth: 130,
      valueFormatter: p => formatPercent(p.value, 0, true),
    },
    {
      field: 'spendThisPeriod',
      headerName: 'Period spend',
      type: 'numericColumn',
      minWidth: 140,
      valueGetter: p => Number(p.data?.spendThisPeriod.amount ?? 0),
      valueFormatter: p => {
        const row = p.data as ActiveTenantRow | undefined;
        return row
          ? formatCurrency(Number(row.spendThisPeriod.amount), { code: row.spendThisPeriod.currency })
          : '';
      },
    },
    {
      field: 'criticalAlerts',
      headerName: 'Critical',
      type: 'numericColumn',
      maxWidth: 110,
      cellRenderer: (p: ICellRendererParams<ActiveTenantRow>) => {
        const n = p.value as number;
        return n > 0
          ? `<span class="critical-pill">${n}</span>`
          : `<span class="critical-zero">0</span>`;
      },
    },
    {
      field: 'lastActivityAt',
      headerName: 'Last activity',
      minWidth: 160,
      valueFormatter: p => this.#relativeTime(p.value as string),
    },
  ];

  // ── Event handlers ───────────────────────────────────────────────────────
  onGridReady(evt: GridReadyEvent<ActiveTenantRow>) {
    this.#gridApi = evt.api;
  }

  onRowClicked(evt: RowClickedEvent<ActiveTenantRow>) {
    if (evt.data) {
      this.#router.navigate(['/platform/tenants', evt.data.tenantId]);
    }
  }

  onTimeRangeChange(range: TimeRange) {
    this.timeRange.set(range);
    this.loadError.set(null);
  }

  onSearchChange(value: string) {
    this.searchText.set(value);
  }

  exportTenantsCsv() {
    this.#gridApi?.exportDataAsCsv({
      fileName: `platform-tenants-${new Date().toISOString().slice(0, 10)}.csv`,
    });
  }

  retry = () => {
    this.loadError.set(null);
    this.timeRange.set(this.timeRange());
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  #statusToVariant(status: ActiveTenantRow['status']): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (status) {
      case 'Active':      return 'success';
      case 'Degraded':    return 'warning';
      case 'Suspended':   return 'danger';
      case 'Onboarding':  return 'info';
      case 'Offboarding': return 'neutral';
      default:            return 'neutral';
    }
  }

  #relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1)     return 'just now';
    if (mins < 60)    return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)   return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  #escape(s: string): string {
    return s.replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }
}
