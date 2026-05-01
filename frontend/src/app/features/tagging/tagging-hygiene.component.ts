// FinOps Platform Design System v1.1 — Tagging Hygiene — Dashboard (Agent A24).
// Pattern: Dashboard — KPIs → Narrative → compliance trend + BU bar (2-col) → remediation AG Grid
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon, ToastController } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { NgApexchartsModule } from 'ng-apexcharts';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexTooltip, ApexDataLabels, ApexStroke, ApexPlotOptions } from 'ng-apexcharts';
import { startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent } from '@shared/components/narrative-block.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { TaggingHygieneService } from './manage.services';
import { formatCurrency } from '@lib/chart-defaults';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import { type TaggingDashboardData, type TagRemediationRow } from '@shared/types/manage.types';

@Component({
  selector: 'app-tagging-hygiene',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonButton, IonIcon, AgGridAngular, NgApexchartsModule, PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './tagging-hygiene.component.html',
  styleUrl:    './tagging-hygiene.component.scss',
})
export class TaggingHygieneComponent {
  readonly #svc   = inject(TaggingHygieneService);
  readonly #toast = inject(ToastController);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('Tagging Hygiene · FinOps'); }

  readonly loadError = signal<string | null>(null);
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load tagging data'); return of(null); })),
    { initialValue: null as TaggingDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => { const d = this.dashboard(); return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'Tag compliance rates, drift detection, and remediation queue'; });

  // Compliance trend line
  readonly trendSeries = computed<ApexAxisChartSeries>(() => [{ name: 'Compliance rate', data: (this.dashboard()?.complianceTrend ?? []).map(p => p.rate) }]);
  readonly trendXAxis  = computed(() => ({ categories: (this.dashboard()?.complianceTrend ?? []).map(p => p.period), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } }));
  readonly trendChart: ApexChart  = { ...baseChartOptions.chart, type: 'line', height: 280 };
  readonly trendStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly trendColors             = [CHART_PALETTE[0]];
  readonly trendTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${v.toFixed(1)}%` } };
  readonly trendYAxis: ApexYAxis   = { min: 0, max: 100, labels: { formatter: (v: number) => `${v}%`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly trendDataLabels: ApexDataLabels = { enabled: false };

  // BU compliance bar
  readonly buSeries = computed<ApexAxisChartSeries>(() => [{ name: 'Compliance %', data: (this.dashboard()?.complianceByBu ?? []).map(b => +b.complianceRate.toFixed(1)) }]);
  readonly buXAxis  = computed(() => ({ categories: (this.dashboard()?.complianceByBu ?? []).map(b => b.bu), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } }));
  readonly buChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly buPlotOptions: ApexPlotOptions = { bar: { borderRadius: 3, columnWidth: '65%' } };
  readonly buColors = computed<string[]>(() => (this.dashboard()?.complianceByBu ?? []).map(b => b.complianceRate < 60 ? SEVERITY_COLORS.Critical : b.complianceRate < 80 ? SEVERITY_COLORS.Warning : SEVERITY_COLORS.Healthy));
  readonly buTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${v.toFixed(1)}%` } };
  readonly buYAxis: ApexYAxis = { min: 0, max: 100, labels: { formatter: (v: number) => `${v}%`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly buDataLabels: ApexDataLabels = { enabled: false };

  // Remediation grid
  readonly remRows = computed(() => this.dashboard()?.remediation ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<TagRemediationRow>[] = [
    { field: 'priority', headerName: 'Priority', maxWidth: 110, cellRenderer: (p: ICellRendererParams<TagRemediationRow>) => { const vm: Record<string,string> = { Critical:'sev-critical', High:'sev-high', Medium:'sev-medium' }; return `<span class="sev-badge ${vm[p.value as string] ?? 'sev-low'}">${this.#e(p.value as string)}</span>`; } },
    { field: 'resourceName', headerName: 'Resource', minWidth: 200, flex: 2, cellRenderer: (p: ICellRendererParams<TagRemediationRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${this.#e(r.resourceName)}</span><span class="rec-meta">${this.#e(r.provider)} · ${this.#e(r.resourceType)} · ${this.#e(r.businessUnit)}</span></div>`; } },
    { field: 'missingTags', headerName: 'Missing tags', minWidth: 200, cellRenderer: (p: ICellRendererParams<TagRemediationRow>) => (p.value as string[]).map((t: string) => `<span class="tag-chip">${this.#e(t)}</span>`).join(' ') },
    { field: 'monthlyCost', headerName: 'Monthly cost', maxWidth: 150, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<TagRemediationRow>) => `<span class="savings-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'daysOpen', headerName: 'Days open', maxWidth: 100, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<TagRemediationRow>) => { const v = p.value as number; const cls = v > 7 ? 'age-stale' : v > 3 ? 'age-warn' : 'age-ok'; return `<span class="${cls}">${v}d</span>`; } },
  ];

  async runScan() {
    this.#svc.triggerScan().subscribe({ next: async () => { const t = await this.#toast.create({ message: 'Tag scan queued — results in ~10 minutes.', duration: 2500, position: 'top', color: 'success' }); await t.present(); } });
  }

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
