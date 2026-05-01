// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Ingestion Status — Dashboard screen.
// Location: apps/frontend/src/app/features/understand/ingestion/
//           ingestion-status.component.ts
// Pattern: Dashboard (§3.1):
//   PageHeader → KPI row → Narrative → throughput area + quality bar (2-col)
//   → connector health AG Grid drill-down
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonButton, IonIcon,
  ToastController, AlertController,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';

import { ChartComponent } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexStroke, ApexFill, ApexTooltip, ApexDataLabels, ApexPlotOptions,
} from 'ng-apexcharts';

import { startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }     from '@shared/components/page-header.component';
import { KpiCardComponent }        from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent } from '@shared/components/narrative-block.component';
import { LoadingStateComponent }   from '@shared/components/loading-state.component';
import { EmptyStateComponent }     from '@shared/components/empty-state.component';

import { IngestionStatusService }  from './ingestion-status.service';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import {
  type IngestionStatusDashboardData,
  type ConnectorHealthRow,
} from '@shared/types/ingestion-status.types';

@Component({
  selector: 'app-ingestion-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon,
    AgGridAngular, ChartComponent,
    PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent,
    LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './ingestion-status.component.html',
  styleUrl:    './ingestion-status.component.scss',
})
export class IngestionStatusComponent {
  readonly #svc       = inject(IngestionStatusService);
  readonly #title     = inject(Title);
  readonly #toastCtrl = inject(ToastController);
  readonly #alertCtrl = inject(AlertController);
  #gridApi?: GridApi<ConnectorHealthRow>;

  constructor() { this.#title.setTitle('Ingestion Status · FinOps'); }

  readonly loadError = signal<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(
      startWith(null),
      catchError(err => {
        this.loadError.set(err.title ?? 'Unable to load ingestion data');
        return of(null);
      }),
    ),
    { initialValue: null as IngestionStatusDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => {
    const d = this.dashboard();
    return d ? `Updated ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'Data source connector health and pipeline status';
  });

  // ── Throughput area chart ─────────────────────────────────────────────────
  readonly throughputSeries = computed<ApexAxisChartSeries>(() => [{
    name: 'Records ingested',
    data: this.dashboard()?.throughputHistory.map(p => p.records) ?? [],
  }]);
  readonly throughputXAxis = computed<ApexXAxis>(() => ({
    categories: this.dashboard()?.throughputHistory.map(p => p.date) ?? [],
    tickAmount: 7,
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly throughputChart: ApexChart   = { ...baseChartOptions.chart, type: 'area', height: 280 };
  readonly throughputStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly throughputFill: ApexFill     = { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } };
  readonly throughputColors             = [CHART_PALETTE[0]];
  readonly throughputTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${(v / 1_000_000).toFixed(2)}M records` } };
  readonly throughputYAxis: ApexYAxis   = { labels: { formatter: (v: number) => `${(v / 1_000_000).toFixed(1)}M`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly throughputDataLabels: ApexDataLabels = { enabled: false };

  // ── Quality bar chart ─────────────────────────────────────────────────────
  readonly qualitySeries = computed<ApexAxisChartSeries>(() => [{
    name: 'Quality score',
    data: this.dashboard()?.qualityBySource.map(q => q.score) ?? [],
  }]);
  readonly qualityXAxis = computed<ApexXAxis>(() => ({
    categories: this.dashboard()?.qualityBySource.map(q => q.source) ?? [],
    labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } },
  }));
  readonly qualityChart: ApexChart   = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly qualityPlotOptions: ApexPlotOptions = { bar: { borderRadius: 3, columnWidth: '65%' } };
  readonly qualityColors             = computed<string[]>(() =>
    (this.dashboard()?.qualityBySource ?? []).map(q =>
      q.score === 0 ? SEVERITY_COLORS.Critical : q.score < 95 ? SEVERITY_COLORS.Warning : SEVERITY_COLORS.Healthy
    )
  );
  readonly qualityTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${v.toFixed(1)}%` } };
  readonly qualityYAxis: ApexYAxis   = { min: 0, max: 100, labels: { formatter: (v: number) => `${v}%`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly qualityDataLabels: ApexDataLabels = { enabled: false };

  // ── Connector grid ────────────────────────────────────────────────────────
  readonly connectorRows = computed(() => this.dashboard()?.connectors ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly connectorColDefs: ColDef<ConnectorHealthRow>[] = [
    {
      field: 'connectorName', headerName: 'Connector', minWidth: 220, flex: 2,
      cellRenderer: (p: ICellRendererParams<ConnectorHealthRow>) => {
        const r = p.data!;
        return `<div class="conn-cell">
          <span class="conn-name">${this.#escape(r.connectorName)}</span>
          <span class="conn-type">${this.#escape(r.sourceType)}</span>
        </div>`;
      },
    },
    {
      field: 'status', headerName: 'Status', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<ConnectorHealthRow>) => {
        const vm: Record<string, string> = { Healthy:'success', Degraded:'warning', Failed:'danger', Stale:'warning', Disabled:'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(p.value as string)}</span>`;
      },
    },
    {
      field: 'freshnessHours', headerName: 'Data age', maxWidth: 110,
      cellRenderer: (p: ICellRendererParams<ConnectorHealthRow>) => {
        const h = p.value as number;
        const cls = h > 24 ? 'age-stale' : h > 6 ? 'age-warn' : 'age-ok';
        return `<span class="${cls}">${h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h.toFixed(1)}h`}</span>`;
      },
    },
    {
      field: 'recordsLastRun', headerName: 'Last run records', minWidth: 150, type: 'numericColumn',
      valueFormatter: p => (p.value as number).toLocaleString('en-AE'),
    },
    {
      field: 'qualityScore', headerName: 'Quality', maxWidth: 100, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<ConnectorHealthRow>) => {
        const v = p.value as number;
        const cls = v === 0 ? 'q-zero' : v < 95 ? 'q-low' : 'q-ok';
        return `<span class="${cls}">${v > 0 ? v.toFixed(1) + '%' : '—'}</span>`;
      },
    },
    {
      field: 'retryCount', headerName: 'Retries', maxWidth: 90, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<ConnectorHealthRow>) => {
        const n = p.value as number;
        return n > 0 ? `<span class="retry-pill">${n}</span>` : `<span class="retry-zero">0</span>`;
      },
    },
    {
      field: 'errorMessage', headerName: 'Error', minWidth: 200,
      cellRenderer: (p: ICellRendererParams<ConnectorHealthRow>) =>
        p.value ? `<span class="error-text">${this.#escape(p.value as string)}</span>` : `<span class="no-error">—</span>`,
    },
    {
      headerName: '', field: 'connectorId',
      width: 100, maxWidth: 100, minWidth: 100, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right',
      cellRenderer: (p: ICellRendererParams<ConnectorHealthRow>) =>
        `<button class="run-btn" data-conn="${this.#escape(p.value as string)}" aria-label="Trigger run for ${this.#escape(p.data!.connectorName)}">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
           Run now
         </button>`,
    },
  ];

  onGridReady(e: GridReadyEvent<ConnectorHealthRow>) { this.#gridApi = e.api; }

  async onGridClick(event: Event) {
    const btn = (event.target as HTMLElement).closest('.run-btn') as HTMLElement | null;
    if (!btn) return;
    const connId = btn.dataset['conn'];
    if (!connId) return;
    const alert = await this.#alertCtrl.create({
      header: 'Trigger ingestion run',
      message: 'Manually trigger an immediate ingestion run for this connector?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Run now', handler: () => {
            this.#svc.triggerRun(connId).subscribe({
              next: async () => {
                const t = await this.#toastCtrl.create({ message: 'Ingestion run triggered.', duration: 2000, position: 'top', color: 'success' });
                await t.present();
              },
            });
          }},
      ],
    });
    await alert.present();
  }

  readonly retry = () => { this.loadError.set(null); };
  #escape(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}
