// FinOps Platform Design System v1.1 — Assessment — Dashboard (Agent A21).
// Pattern: Dashboard — KPIs → Narrative → radar chart + maturity summary bar → capabilities AG Grid
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { ChartComponent } from 'ng-apexcharts';
import type { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexTooltip, ApexDataLabels, ApexPlotOptions } from 'ng-apexcharts';
import { startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card.component';
import { NarrativeBlockComponent } from '@shared/components/narrative-block.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { AssessmentService } from './manage.services';
import { CHART_PALETTE, SEVERITY_COLORS, baseChartOptions } from '@lib/chart-defaults';
import { type AssessmentDashboardData, type MaturityCapabilityRow, type MaturityLevel } from '@shared/types/manage.types';

@Component({
  selector: 'app-assessment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, AgGridAngular, ChartComponent, PageHeaderComponent, KpiCardComponent, NarrativeBlockComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './assessment.component.html',
  styleUrl:    './assessment.component.scss',
})
export class AssessmentComponent {
  readonly #svc   = inject(AssessmentService);
  readonly #title = inject(Title);
  constructor() { this.#title.setTitle('FinOps Assessment · FinOps'); }

  readonly loadError = signal<string | null>(null);
  readonly dashboard = toSignal(
    this.#svc.getDashboard().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load assessment data'); return of(null); })),
    { initialValue: null as AssessmentDashboardData | null },
  );

  readonly isLoading = computed(() => this.dashboard() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.dashboard() !== null);
  readonly kpis      = computed(() => this.dashboard()?.kpis ?? null);
  readonly subtitle  = computed(() => { const d = this.dashboard(); return d ? `${d.narrative.agentName} · ${new Date(d.narrative.generatedAt).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}` : 'FinOps maturity scores across all platform capabilities'; });

  // Radar chart
  readonly radarSeries = computed<ApexAxisChartSeries>(() => [{ name: 'Maturity score', data: (this.dashboard()?.radarData ?? []).map(r => r.score) }]);
  readonly radarCategories = computed<string[]>(() => (this.dashboard()?.radarData ?? []).map(r => r.capability));
  readonly radarChart: ApexChart = { ...baseChartOptions.chart, type: 'radar', height: 380 };
  readonly radarTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${v}/100` } };
  readonly radarColors = [CHART_PALETTE[0]];
  readonly radarDataLabels: ApexDataLabels = { enabled: false };

  // Capability score bar
  readonly capSeries = computed<ApexAxisChartSeries>(() => [{ name: 'Score', data: (this.dashboard()?.capabilities ?? []).map(c => c.score) }]);
  readonly capXAxis  = computed<ApexXAxis>(() => ({ categories: (this.dashboard()?.capabilities ?? []).map(c => c.capabilityName), labels: { style: { fontFamily: 'var(--finops-font-family)', fontSize: '10px' } } }));
  readonly capChart: ApexChart = { ...baseChartOptions.chart, type: 'bar', height: 280 };
  readonly capPlotOptions: ApexPlotOptions = { bar: { borderRadius: 3, columnWidth: '65%' } };
  readonly capColors = computed<string[]>(() => (this.dashboard()?.capabilities ?? []).map(c => c.score < 40 ? SEVERITY_COLORS.Critical : c.score < 60 ? SEVERITY_COLORS.Warning : SEVERITY_COLORS.Healthy));
  readonly capTooltip: ApexTooltip = { ...baseChartOptions.tooltip, y: { formatter: (v: number) => `${v}/100` } };
  readonly capYAxis: ApexYAxis = { min: 0, max: 100, labels: { formatter: (v: number) => `${v}`, style: { fontFamily: 'var(--finops-font-family)', fontSize: '11px' } } };
  readonly capDataLabels: ApexDataLabels = { enabled: false };

  // Capabilities AG Grid
  readonly capRows = computed(() => this.dashboard()?.capabilities ?? []);
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<MaturityCapabilityRow>[] = [
    { field: 'capabilityName', headerName: 'Capability', minWidth: 200, flex: 2 },
    { field: 'domain',         headerName: 'Domain',     maxWidth: 130 },
    {
      field: 'maturityLevel', headerName: 'Level', maxWidth: 100,
      cellRenderer: (p: ICellRendererParams<MaturityCapabilityRow>) => {
        const vm: Record<MaturityLevel, string> = { Run: 'mat-run', Walk: 'mat-walk', Crawl: 'mat-crawl' };
        return `<span class="mat-badge ${vm[p.value as MaturityLevel]}">${this.#e(p.value as string)}</span>`;
      },
    },
    {
      field: 'score', headerName: 'Score', maxWidth: 90, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<MaturityCapabilityRow>) => {
        const v = p.value as number;
        const cls = v < 40 ? 'conf-low' : v < 70 ? 'conf-mid' : 'conf-high';
        return `<span class="${cls}">${v}</span>`;
      },
    },
    {
      field: 'deltaScore', headerName: 'Δ', maxWidth: 70, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<MaturityCapabilityRow>) => {
        const v = p.value as number;
        const cls = v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero';
        return `<span class="${cls}">${v > 0 ? '+' : ''}${v}</span>`;
      },
    },
    { field: 'agentId',  headerName: 'Agent',   maxWidth: 80 },
    { field: 'keyKpis',  headerName: 'Key KPIs', minWidth: 200, flex: 2, cellRenderer: (p: ICellRendererParams<MaturityCapabilityRow>) => `<span class="kpi-text">${this.#e(p.value as string)}</span>` },
  ];

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
