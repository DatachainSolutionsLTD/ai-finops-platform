// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Tenant Health Dashboard — FinOps platform operational view.
// Route: /health    Persona: Tenant_Admin, FinOps_Analyst
// Pattern: Dashboard — KPIs → NarrativeBlock → Maturity radar + Agent tier bar (2-col)

import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
} from '@ionic/angular/standalone';

import { ChartComponent } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexNonAxisChartSeries, ApexChart,
  ApexXAxis, ApexYAxis, ApexTooltip, ApexPlotOptions,
  ApexDataLabels, ApexLegend, ApexStroke,
} from 'ng-apexcharts';

import { startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { KpiCardComponent }      from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent}from '@shared/components/narrative-block.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { TenantHealthService }   from './overview.services';
import { formatCurrency }        from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import { inverseStatus }         from '@lib/utils/ui_chart_defaults_additions';
import type { TenantHealthData } from '@shared/types/overview.types';

@Component({
  selector: 'app-tenant-health',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    ChartComponent,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './tenant-health.component.html',
  styleUrl:    './tenant-health.component.scss',
})
export class TenantHealthComponent {
  readonly #svc   = inject(TenantHealthService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('Tenant Health · FinOps'); }

  readonly loadError = signal<string | null>(null);
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load tenant health'); return of(null); })),
    { initialValue: null as TenantHealthData | null },
  );
  readonly isLoading  = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData    = computed(() => this.dashboard() !== null);
  readonly kpis       = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle   = computed(() => {
    const d = this.dashboard();
    if (!d) return 'Agent health, governance posture, and FinOps maturity';
    const { agentsHealthy } = d.kpis;
    const total = (d.agentsByTier ?? []).reduce((s, t) => s + t.total, 0);
    return `${agentsHealthy.value} / ${total} agents healthy · Last refreshed just now`;
  });

  // ── Maturity radar chart ──────────────────────────────────────────────────
  readonly radarSeries = computed<ApexAxisChartSeries>(() => [{
    name: 'Score',
    data: (this.dashboard()?.radarData ?? []).map(r => r.score),
  }]);
  readonly radarXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.radarData ?? []).map(r => r.capability),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '10px' } },
  }));
  readonly radarChart: ApexChart = { ...baseChartOptions.chart, type: 'radar', height: 340 };
  readonly radarColors           = [CHART_PALETTE[0]];
  readonly radarStroke: ApexStroke = { width: 2 };
  readonly radarFill             = { opacity: 0.15 };
  readonly radarDataLabels: ApexDataLabels = {
    enabled: true,
    formatter: (v: number) => v >= 70 ? '▣' : v >= 40 ? '◈' : '◇',
    style: { fontSize: '10px', colors: [CHART_PALETTE[0]] },
  };

  // ── Agent tier grouped bar ────────────────────────────────────────────────
  readonly agentSeries = computed<ApexAxisChartSeries>(() => {
    const tiers = this.dashboard()?.agentsByTier ?? [];
    return [
      { name: 'Healthy',  data: tiers.map(t => t.healthy)  },
      { name: 'Degraded', data: tiers.map(t => t.degraded) },
      { name: 'Failed',   data: tiers.map(t => t.failed)   },
    ];
  });
  readonly agentXAxis = computed<ApexXAxis>(() => ({
    categories: (this.dashboard()?.agentsByTier ?? []).map(t => t.tier),
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly agentChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 280, stacked: true };
  readonly agentColors           = [SEVERITY_COLORS.Healthy, SEVERITY_COLORS.Warning, SEVERITY_COLORS.Critical];
  readonly agentPlotOptions: ApexPlotOptions = { bar: { borderRadius: 2, columnWidth: '50%' } };
  readonly agentYAxis: ApexYAxis = { labels: { formatter: (v: number) => String(v), style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly agentDataLabels: ApexDataLabels = { enabled: false };
  readonly agentLegend: ApexLegend = { position: 'top', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };

  readonly retry = () => { this.loadError.set(null); };
}
