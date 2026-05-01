// FinOps Platform Design System v1.1 — Updated v2
// escHtml() → @lib/utils/html.utils | relativeTime() → @lib/utils/date.utils
// FinOps Platform Design System v1.1 — DSR Requests — List screen (GDPR/PDPL).
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { escHtml } from '@lib/utils/html.utils';
import type { SummaryStat } from '@shared/components/summary-stat-row.component';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { GridShellCardComponent } from '@shared/components/grid-shell-card-component.component';
import { SummaryStatRowComponent } from '@shared/components/summary-stat-row-component.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { DsrRequestsService } from './compliance.services';
import { type DsrRequestRow, type DsrRequestType, type DsrRequestStatus, DSR_TYPE_OPTIONS, DSR_STATUS_OPTIONS } from '@shared/types/compliance.types';

@Component({
  selector: 'app-dsr-requests',
  standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent, SummaryStatRowComponent, GridShellCardComponent,],
  templateUrl: './dsr-requests.component.html',
  styleUrl:    './dsr-requests.component.scss',
})
export class DsrRequestsComponent {
  readonly #svc    = inject(DsrRequestsService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<DsrRequestRow>;
  constructor() { this.#title.setTitle('DSR Requests · FinOps'); }

  readonly searchText   = signal('');
  readonly typeFilter   = signal<DsrRequestType[]>([]);
  readonly statusFilter = signal<DsrRequestStatus[]>([]);
  readonly loadError    = signal<string | null>(null);
  readonly typeOptions   = DSR_TYPE_OPTIONS;
  readonly statusOptions = DSR_STATUS_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, type: this.typeFilter().length ? this.typeFilter() : undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load DSR requests'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.typeFilter().length > 0 || this.statusFilter().length > 0);


  readonly summaryStats = computed<SummaryStat[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Total', value: s.total },
      { label: 'Open', value: s.open, colorClass: 'info' },
      { label: 'Overdue', value: s.overdue, colorClass: (s.overdue > 0) ? 'danger' : undefined },
      { label: 'Completed', value: s.completed, colorClass: 'success' },
      { label: 'SLA deadline', value: s.slaDays },
    ];
  });
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<DsrRequestRow>[] = [
    { field: 'requestNumber', headerName: 'Case #', maxWidth: 140, cellRenderer: (p: ICellRendererParams<DsrRequestRow>) => { const r = p.data!; return `<span class="case-num${r.isOverdue ? ' overdue' : ''}" aria-label="${r.isOverdue ? 'Overdue: ' : ''}${escHtml(r.requestNumber)}">${r.isOverdue ? '⚠ ' : ''}${escHtml(r.requestNumber)}</span>`; } },
    { field: 'requestType', headerName: 'Request type', minWidth: 220, flex: 2, cellRenderer: (p: ICellRendererParams<DsrRequestRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${escHtml(r.requestType.replace(/_/g,' '))}</span><span class="rec-meta">${escHtml(r.dataSubjectName)} · ${escHtml(r.regulatoryBasis)}</span></div>`; } },
    { field: 'status', headerName: 'Status', maxWidth: 210, cellRenderer: (p: ICellRendererParams<DsrRequestRow>) => { const vm: Record<string,string> = { Submitted:'info', Identity_Verification_Pending:'warning', Identity_Verified:'info', In_Progress:'info', Pending_Legal_Review:'warning', Completed:'success', Partially_Completed:'warning', Rejected:'neutral', Withdrawn:'neutral', Overdue:'danger' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${escHtml((p.value as string).replace(/_/g,' '))}</span>`; } },
    { field: 'daysRemaining', headerName: 'SLA', maxWidth: 110, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<DsrRequestRow>) => {
        const v = p.value as number | null;
        if (v === null) return `<span class="sla-ok">Done</span>`;
        if (v < 0)  return `<span class="sla-breached">${Math.abs(v)}d overdue</span>`;
        if (v < 7)  return `<span class="sla-approaching">${v}d left</span>`;
        return `<span class="sla-ok">${v}d left</span>`;
      }
    },
    { field: 'assignedTo', headerName: 'Assigned', maxWidth: 140, valueFormatter: p => (p.value as string | null) ?? 'Unassigned' },
    { field: 'submittedAt', headerName: 'Submitted', minWidth: 130, valueFormatter: p => new Date(p.value as string).toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'}) },
    { field: 'deadlineAt', headerName: 'Deadline', minWidth: 130, valueFormatter: p => new Date(p.value as string).toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'}) },
    { headerName: '', field: 'requestId', width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right', cellRenderer: () => `<button class="row-action-btn" aria-label="View DSR request detail"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<DsrRequestRow>)   { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<DsrRequestRow>) { if (e.data) this.#router.navigate(['/compliance/dsr', e.data.requestId]); }
  onSearchChange(v: string | null | undefined)    { this.searchText.set(v ?? ''); }
  toggleTypeFilter(t: DsrRequestType)             { this.typeFilter.update(c => c.includes(t) ? c.filter(x => x !== t) : [...c, t]); }
  toggleStatusFilter(s: DsrRequestStatus)         { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  clearFilters()  { this.searchText.set(''); this.typeFilter.set([]); this.statusFilter.set([]); }
  exportCsv()     { this.#gridApi?.exportDataAsCsv({ fileName: 'dsr-requests.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
}
