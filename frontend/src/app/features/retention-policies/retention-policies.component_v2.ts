// FinOps Platform Design System v1.1 — Updated v2
// escHtml() → @lib/utils/html.utils | relativeTime() → @lib/utils/date.utils
// FinOps Platform Design System v1.1 — Retention Policies List
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
import { RetentionPoliciesService } from './compliance.services';
import { type RetentionPolicyRow, type RetentionStatus, type DataCategory, RETENTION_STATUS_OPTIONS, DATA_CATEGORY_OPTIONS } from '@shared/types/compliance.types';

@Component({
  selector: 'app-retention-policies',
  standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent SummaryStatRowComponent, GridShellCardComponent,],
  templateUrl: './retention-policies.component.html',
  styleUrl:    './retention-policies.component.scss',
})
export class RetentionPoliciesComponent {
  readonly #svc   = inject(RetentionPoliciesService);
  readonly #title = inject(Title);
  #gridApi?: GridApi<RetentionPolicyRow>;
  constructor() { this.#title.setTitle('Retention Policies · FinOps'); }

  readonly searchText    = signal('');
  readonly statusFilter  = signal<RetentionStatus[]>([]);
  readonly loadError     = signal<string | null>(null);
  readonly statusOptions = RETENTION_STATUS_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load retention policies'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.statusFilter().length > 0);


  readonly summaryStats = computed<SummaryStat[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Total', value: s.total },
      { label: 'Active', value: s.active, colorClass: 'success' },
      { label: 'Draft', value: s.draft, colorClass: 'info' },
      { label: 'Regulatory', value: s.regulatory, colorClass: 'warning' },
    ];
  });
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<RetentionPolicyRow>[] = [
    { field: 'isRegulatory', headerName: 'Regulatory', maxWidth: 100, cellRenderer: (p: ICellRendererParams<RetentionPolicyRow>) => (p.value as boolean) ? `<span class="reg-badge" aria-label="Regulatory requirement">⚖ Yes</span>` : '' },
    { field: 'policyName', headerName: 'Policy', minWidth: 220, flex: 2, cellRenderer: (p: ICellRendererParams<RetentionPolicyRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${escHtml(r.policyName)}</span><span class="rec-meta">${escHtml(r.dataCategory.replace(/_/g,' '))} · ${r.retentionDays >= 365 ? Math.round(r.retentionDays/365) + 'y' : r.retentionDays + 'd'}</span></div>`; } },
    { field: 'retentionAction', headerName: 'Action', maxWidth: 200, cellRenderer: (p: ICellRendererParams<RetentionPolicyRow>) => `<span class="action-chip">${escHtml((p.value as string).replace(/_/g,' '))}</span>` },
    { field: 'status', headerName: 'Status', maxWidth: 100, cellRenderer: (p: ICellRendererParams<RetentionPolicyRow>) => { const vm: Record<string,string> = { Active:'success', Draft:'info', Paused:'warning', Archived:'neutral' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${escHtml(p.value as string)}</span>`; } },
    { field: 'lastRunAt', headerName: 'Last run', minWidth: 130, valueFormatter: p => p.value ? new Date(p.value as string).toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'}) : 'Never' },
    { field: 'nextRunAt', headerName: 'Next run', minWidth: 130, valueFormatter: p => p.value ? new Date(p.value as string).toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'}) : '—' },
    { field: 'recordsAffected', headerName: 'Records processed', minWidth: 160, type: 'numericColumn', valueFormatter: p => (p.value as number).toLocaleString('en-AE') },
  ];

  onGridReady(e: GridReadyEvent<RetentionPolicyRow>) { this.#gridApi = e.api; }
  onSearchChange(v: string | null | undefined)       { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: RetentionStatus)             { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  clearFilters()  { this.searchText.set(''); this.statusFilter.set([]); }
  exportCsv()     { this.#gridApi?.exportDataAsCsv({ fileName: 'retention-policies.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
}
