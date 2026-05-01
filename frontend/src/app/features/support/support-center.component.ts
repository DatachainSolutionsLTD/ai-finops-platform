// FinOps Platform Design System v1.1 — Support Center — List screen.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { SupportCenterService } from './tenant-admin.services';
import { type SupportCaseRow, type CaseCategory, type CaseStatus, type CasePriority, CASE_CATEGORY_OPTIONS, CASE_STATUS_OPTIONS, CASE_PRIORITY_OPTIONS } from '@shared/types/tenant-admin.types';

@Component({
  selector: 'app-support-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './support-center.component.html',
  styleUrl:    './support-center.component.scss',
})
export class SupportCenterComponent {
  readonly #svc    = inject(SupportCenterService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<SupportCaseRow>;
  constructor() { this.#title.setTitle('Support Center · FinOps'); }

  readonly searchText      = signal('');
  readonly categoryFilter  = signal<CaseCategory[]>([]);
  readonly statusFilter    = signal<CaseStatus[]>([]);
  readonly loadError       = signal<string | null>(null);
  readonly categoryOptions = CASE_CATEGORY_OPTIONS;
  readonly statusOptions   = CASE_STATUS_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, category: this.categoryFilter().length ? this.categoryFilter() : undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load support cases'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.categoryFilter().length > 0 || this.statusFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<SupportCaseRow>[] = [
    { field: 'priority', headerName: 'Priority', maxWidth: 110, cellRenderer: (p: ICellRendererParams<SupportCaseRow>) => { const vm: Record<string,string> = { Critical:'prio-critical', High:'prio-high', Medium:'prio-medium', Low:'prio-low' }; return `<span class="prio-badge ${vm[p.value as string]}">${this.#e(p.value as string)}</span>`; } },
    { field: 'title', headerName: 'Case', minWidth: 260, flex: 2, cellRenderer: (p: ICellRendererParams<SupportCaseRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${r.slaBreached ? '⚠ ' : ''}${this.#e(r.title)}</span><span class="rec-meta">${this.#e(r.caseNumber)} · ${this.#e(r.category.replace(/_/g,' '))} · ${this.#e(r.createdBy)}</span></div>`; } },
    { field: 'status', headerName: 'Status', maxWidth: 200, cellRenderer: (p: ICellRendererParams<SupportCaseRow>) => { const vm: Record<string,string> = { Open:'info', Pending_Customer:'warning', In_Progress:'info', Waiting_On_Engineering:'warning', Resolved:'success', Closed:'neutral', Reopened:'danger' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e((p.value as string).replace(/_/g,' '))}</span>`; } },
    { field: 'assignedTo', headerName: 'Assigned to', maxWidth: 160, valueFormatter: p => (p.value as string | null) ?? 'Unassigned' },
    { field: 'createdAt', headerName: 'Opened', minWidth: 120, valueFormatter: p => new Date(p.value as string).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) },
    { field: 'updatedAt', headerName: 'Updated', minWidth: 120, valueFormatter: p => { const d = new Date(p.value as string); const hrs = Math.floor((Date.now() - d.getTime()) / 3_600_000); return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs/24)}d ago`; } },
    { headerName: '', field: 'caseId', width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right', cellRenderer: () => `<button class="row-action-btn" aria-label="View case detail"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<SupportCaseRow>)   { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<SupportCaseRow>) { if (e.data) this.#router.navigate(['/admin/support', e.data.caseId]); }
  onSearchChange(v: string | null | undefined)     { this.searchText.set(v ?? ''); }
  toggleCategoryFilter(c: CaseCategory)            { this.categoryFilter.update(x => x.includes(c) ? x.filter(i => i !== c) : [...x, c]); }
  toggleStatusFilter(s: CaseStatus)                { this.statusFilter.update(x => x.includes(s) ? x.filter(i => i !== s) : [...x, s]); }
  clearFilters()  { this.searchText.set(''); this.categoryFilter.set([]); this.statusFilter.set([]); }
  exportCsv()     { this.#gridApi?.exportDataAsCsv({ fileName: 'support-cases.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
