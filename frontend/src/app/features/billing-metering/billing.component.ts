// FinOps Platform Design System v1.1 — Billing & Subscription — Dashboard.
// Pattern: Dashboard — tier chip + renewal badge → KPIs → stacked usage bar + invoice grid
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { ChartComponent } from 'ng-apexcharts';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexTooltip, ApexDataLabels, ApexLegend, ApexPlotOptions } from 'ng-apexcharts';
import { startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { BillingService } from './tenant-admin.services';
import { formatCurrency } from '@lib/chart-defaults';
import { CHART_PALETTE, baseChartOptions } from '@lib/chart-defaults';
import { type BillingDashboardData, type BillingInvoiceRow } from '@shared/types/tenant-admin.types';

@Component({
  selector: 'app-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon, AgGridAngular, ChartComponent, PageHeaderComponent, KpiCardComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './billing.component.html',
  styleUrl:    './billing.component.scss',
})
export class BillingComponent {
  readonly #svc   = inject(BillingService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('Billing & Subscription · FinOps'); }

  readonly loadError = signal<string | null>(null);
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load billing data'); return of(null); })),
    { initialValue: null as BillingDashboardData | null },
  );

  readonly isLoading  = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData    = computed(() => this.dashboard() !== null);
  readonly kpis       = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle   = computed(() => { const d = this.dashboard(); return d ? `${d.tier} plan · ${d.billingStatus}` : 'Current plan, usage, and invoices'; });
  readonly renewalDate = computed(() => { const d = this.dashboard(); return d ? new Date(d.renewalDate).toLocaleDateString('en-AE', { day:'2-digit', month:'long', year:'numeric' }) : ''; });
  readonly billingStatusClass = computed(() => { const s = this.dashboard()?.billingStatus; return s === 'Current' || s === 'Trial' ? 'billing-ok' : s === 'Grace_Period' ? 'billing-warn' : 'billing-err'; });
  readonly fpPct = computed(() => this.dashboard()?.kpis.fpConsumed.pct ?? 0);

  // Stacked usage bar
  readonly usageSeries = computed<ApexAxisChartSeries>(() => {
    const d = this.dashboard()?.usageTrend ?? [];
    return [
      { name: 'Compute',  data: d.map(p => p.compute)  },
      { name: 'Storage',  data: d.map(p => p.storage)  },
      { name: 'Network',  data: d.map(p => p.network)  },
      { name: 'Support',  data: d.map(p => p.support)  },
    ];
  });
  readonly usageXAxis  = computed<ApexXAxis>(() => ({ categories: (this.dashboard()?.usageTrend ?? []).map(p => p.month), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } }));
  readonly usageChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 300, stacked: true };
  readonly usagePlotOptions: ApexPlotOptions = { bar: { borderRadius: 2, columnWidth: '65%' } };
  readonly usageColors = [CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[2], CHART_PALETTE[4]];
  readonly usageTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => formatCurrency(v, { code: 'AED' }) } };
  readonly usageYAxis: ApexYAxis = { labels: { formatter: (v: number) => `${(v / 1_000).toFixed(0)}k`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly usageDataLabels: ApexDataLabels = { enabled: false };
  readonly usageLegend: ApexLegend = { position: 'top', fontFamily: 'var(--finops-font-family)', fontSize: '12px' };

  // Invoice AG Grid
  readonly invoiceRows = computed(() => this.dashboard()?.invoices ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: false, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<BillingInvoiceRow>[] = [
    { field: 'period', headerName: 'Period', minWidth: 150 },
    { field: 'amount', headerName: 'Amount', maxWidth: 170, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<BillingInvoiceRow>) => `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'status', headerName: 'Status', maxWidth: 100, cellRenderer: (p: ICellRendererParams<BillingInvoiceRow>) => { const vm: Record<string,string> = { Paid:'success', Pending:'warning', Overdue:'danger' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`; } },
    { field: 'dueDate', headerName: 'Due', minWidth: 120, valueFormatter: p => new Date(p.value as string).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) },
    { field: 'paidDate', headerName: 'Paid', minWidth: 120, valueFormatter: p => p.value ? new Date(p.value as string).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) : '—' },
    { headerName: '', field: 'downloadUrl', maxWidth: 80, sortable: false, filter: false, resizable: false,
      cellRenderer: (p: ICellRendererParams<BillingInvoiceRow>) => p.value ? `<a class="dl-link" href="${this.#e(p.value as string)}" download aria-label="Download invoice PDF"><ion-icon name="download-outline"></ion-icon> PDF</a>` : '—' },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
