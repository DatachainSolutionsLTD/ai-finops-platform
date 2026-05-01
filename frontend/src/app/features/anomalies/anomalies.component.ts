// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Anomalies — List screen.
// Location: apps/frontend/src/app/features/understand/anomalies/
//           anomalies.component.ts
// Pattern: List (§3.2): 5-stat summary → filter toolbar → AG Grid
// Severity-coded rows; bulk acknowledge action; row drills to detail.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
  IonPopover, IonList, IonItem, IonCheckbox,
  ToastController, AlertController,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef, GridApi, GridReadyEvent, ICellRendererParams,
  RowClickedEvent, SelectionChangedEvent,
} from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { AnomaliesService }      from './anomalies.service';
import { formatCurrency }        from '@lib/chart-defaults';
import {
  type AnomalyListRow,
  type AnomalySeverity,
  type AnomalyLifecycle,
  ANOMALY_SEVERITY_OPTIONS,
  ANOMALY_LIFECYCLE_OPTIONS,
  ANOMALY_PROVIDER_OPTIONS,
} from '@shared/types/understand-lists.types';

@Component({
  selector: 'app-anomalies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
    IonPopover, IonList, IonItem, IonCheckbox,
    AgGridAngular,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './anomalies.component.html',
  styleUrl:    './anomalies.component.scss',
})
export class AnomaliesComponent {
  readonly #svc       = inject(AnomaliesService);
  readonly #router    = inject(Router);
  readonly #title     = inject(Title);
  readonly #toastCtrl = inject(ToastController);
  readonly #alertCtrl = inject(AlertController);
  #gridApi?: GridApi<AnomalyListRow>;

  constructor() { this.#title.setTitle('Anomalies · FinOps'); }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly searchText       = signal<string>('');
  readonly severityFilter   = signal<AnomalySeverity[]>([]);
  readonly lifecycleFilter  = signal<AnomalyLifecycle[]>([]);
  readonly providerFilter   = signal<string[]>([]);
  readonly loadError        = signal<string | null>(null);
  readonly selectedIds      = signal<string[]>([]);

  readonly severityOptions  = ANOMALY_SEVERITY_OPTIONS;
  readonly lifecycleOptions = ANOMALY_LIFECYCLE_OPTIONS;
  readonly providerOptions  = ANOMALY_PROVIDER_OPTIONS;

  // ── Query → data ──────────────────────────────────────────────────────────
  readonly #query = computed(() => ({
    search:    this.searchText()       || undefined,
    severity:  this.severityFilter().length  ? this.severityFilter()  : undefined,
    lifecycle: this.lifecycleFilter().length ? this.lifecycleFilter() : undefined,
    provider:  this.providerFilter().length  ? this.providerFilter()  : undefined,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load anomalies'); return of(null); }),
        ),
      ),
    ),
    { initialValue: null },
  );

  readonly summary = toSignal(
    this.#svc.summary().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() =>
    !!this.searchText() || this.severityFilter().length > 0 ||
    this.lifecycleFilter().length > 0 || this.providerFilter().length > 0);
  readonly hasSelection   = computed(() => this.selectedIds().length > 0);
  readonly selectionCount = computed(() => this.selectedIds().length);

  // ── AG Grid ───────────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<AnomalyListRow>[] = [
    {
      headerCheckboxSelection: true, checkboxSelection: true,
      width: 48, maxWidth: 48, minWidth: 48, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'left', headerName: '',
    },
    {
      field: 'severity', headerName: 'Severity', maxWidth: 130, pinned: 'left',
      cellRenderer: (p: ICellRendererParams<AnomalyListRow>) => {
        const sev = p.value as AnomalySeverity;
        const icons: Record<AnomalySeverity, string> = { Critical: '●', Warning: '▲', Informational: '●' };
        const cls: Record<AnomalySeverity, string>   = { Critical: 'sev-critical', Warning: 'sev-warning', Informational: 'sev-info' };
        return `<span class="sev-badge ${cls[sev]}">${icons[sev]} ${sev}</span>`;
      },
    },
    {
      field: 'title', headerName: 'Anomaly', minWidth: 240, flex: 2,
      cellRenderer: (p: ICellRendererParams<AnomalyListRow>) => {
        const r = p.data!;
        return `<div class="anomaly-cell">
          <span class="anomaly-title">${this.#escape(r.title)}</span>
          <span class="anomaly-meta">${this.#escape(r.provider)} · ${this.#escape(r.serviceName)} · ${this.#escape(r.businessUnit)}</span>
        </div>`;
      },
    },
    {
      field: 'lifecycle', headerName: 'Status', maxWidth: 155,
      cellRenderer: (p: ICellRendererParams<AnomalyListRow>) => {
        const vm: Record<string, string> = {
          New:'danger', Acknowledged:'warning', Investigating:'info',
          Resolved:'success', False_Positive:'neutral', Expected_Change:'neutral',
        };
        const label = (p.value as string).replace('_', ' ');
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(label)}</span>`;
      },
    },
    {
      field: 'deviationAmount', headerName: 'Deviation', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AnomalyListRow>) => {
        const r = p.data!;
        return `<span class="dev-cell">${formatCurrency(r.deviationAmount, { code: r.currency })} <span class="dev-pct">(+${r.deviationPct.toFixed(1)}%)</span></span>`;
      },
    },
    {
      field: 'detectionMethod', headerName: 'Method', maxWidth: 170,
      cellRenderer: (p: ICellRendererParams<AnomalyListRow>) =>
        `<span class="method-pill">${this.#escape((p.value as string).replace(/_/g,' '))}</span>`,
    },
    {
      field: 'detectedAt', headerName: 'Detected', minWidth: 130,
      valueFormatter: p => this.#relativeTime(p.value as string),
    },
    { field: 'assignedTo', headerName: 'Assigned to', minWidth: 140, valueFormatter: p => (p.value as string | null) ?? 'Unassigned' },
    {
      headerName: '', field: 'anomalyId',
      width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="Open anomaly detail">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
         </button>`,
    },
  ];

  onGridReady(e: GridReadyEvent<AnomalyListRow>) { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<AnomalyListRow>) {
    if ((e.event?.target as HTMLElement)?.closest('.ag-selection-checkbox')) return;
    if (e.data) this.#router.navigate(['/understand/anomalies', e.data.anomalyId]);
  }
  onSelectionChanged(_e: SelectionChangedEvent<AnomalyListRow>) {
    this.selectedIds.set((this.#gridApi?.getSelectedRows() ?? []).map(r => r.anomalyId));
  }

  onSearchChange(v: string | null | undefined)  { this.searchText.set(v ?? ''); }
  toggleSeverityFilter(s: AnomalySeverity)      { this.severityFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  toggleLifecycleFilter(l: AnomalyLifecycle)    { this.lifecycleFilter.update(c => c.includes(l) ? c.filter(x => x !== l) : [...c, l]); }
  toggleProviderFilter(p: string)               { this.providerFilter.update(c => c.includes(p) ? c.filter(x => x !== p) : [...c, p]); }
  clearFilters() { this.searchText.set(''); this.severityFilter.set([]); this.lifecycleFilter.set([]); this.providerFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'anomalies.csv' }); }

  async bulkAcknowledge() {
    const count = this.selectionCount();
    const alert = await this.#alertCtrl.create({
      header: 'Acknowledge anomalies',
      message: `Acknowledge ${count} selected anomal${count > 1 ? 'ies' : 'y'}? This signals they are under review.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Acknowledge', handler: () => {
            this.selectedIds().forEach(id => this.#svc.acknowledge(id).subscribe());
            this.selectedIds.set([]);
            this.#toastCtrl.create({ message: `${count} anomal${count > 1 ? 'ies' : 'y'} acknowledged.`, duration: 2500, position: 'top', color: 'success' }).then(t => t.present());
          }},
      ],
    });
    await alert.present();
  }

  readonly retry = () => { this.loadError.set(null); };
  #escape(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  #relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
}
