// FinOps Platform Design System v1.1 — Chargeback — List screen (Agent A22).
// Pattern: List — summary → filter toolbar → AG Grid with statement rows

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { ChargebackService } from './manage.services';
import { formatCurrency } from '@lib/chart-defaults';
import { type ChargebackStatementRow, type ChargebackStatementStatus, type ChargebackStatementType, CB_STATUS_OPTIONS, CB_TYPE_OPTIONS } from '@shared/types/manage.types';

@Component({
  selector: 'app-chargeback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './chargeback.component.html',
  styleUrl:    './chargeback.component.scss',
})
export class ChargebackComponent {
  readonly #svc    = inject(ChargebackService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<ChargebackStatementRow>;
  constructor() { this.#title.setTitle('Chargeback · FinOps'); }

  readonly searchText   = signal('');
  readonly statusFilter = signal<ChargebackStatementStatus[]>([]);
  readonly typeFilter   = signal<ChargebackStatementType[]>([]);
  readonly loadError    = signal<string | null>(null);
  readonly statusOptions = CB_STATUS_OPTIONS;
  readonly typeOptions   = CB_TYPE_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load chargeback statements'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.statusFilter().length > 0 || this.typeFilter().length > 0);

  readonly reconStatusClass = computed(() => {
    const s = this.summary()?.reconStatus;
    return s === 'Passed' ? 'success' : s === 'Warning' ? 'warning' : s === 'Failed' ? 'danger' : 'neutral';
  });

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<ChargebackStatementRow>[] = [
    { field: 'billingPeriod', headerName: 'Period', maxWidth: 110 },
    { field: 'businessUnit', headerName: 'Business unit / scope', minWidth: 200, flex: 2 },
    { field: 'statementType', headerName: 'Type', maxWidth: 180, cellRenderer: (p: ICellRendererParams<ChargebackStatementRow>) => { const vm: Record<string,string> = { Chargeback_Binding:'type-binding', Showback_Advisory:'type-showback', Hybrid_Display:'type-hybrid' }; return `<span class="type-chip ${vm[p.value as string] ?? ''}">${this.#e((p.value as string).replace(/_/g,' '))}</span>`; } },
    { field: 'totalAmount', headerName: 'Amount', maxWidth: 170, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<ChargebackStatementRow>) => `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'status', headerName: 'Status', maxWidth: 155, cellRenderer: (p: ICellRendererParams<ChargebackStatementRow>) => { const vm: Record<string,string> = { Draft:'neutral', Pending_Review:'info', Approved:'success', Distributed:'success', Disputed:'warning', Adjusted:'warning', Finalized:'success' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e((p.value as string).replace('_',' '))}</span>`; } },
    { field: 'disputeCount', headerName: 'Disputes', maxWidth: 90, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<ChargebackStatementRow>) => { const v = p.value as number; return v > 0 ? `<span class="dispute-count">${v}</span>` : `<span class="no-dispute">0</span>`; } },
    { field: 'hasAnomaly', headerName: 'Anomaly', maxWidth: 90, cellRenderer: (p: ICellRendererParams<ChargebackStatementRow>) => (p.value as boolean) ? `<span class="anomaly-flag" aria-label="Anomaly detected">⚠</span>` : `<span class="no-anomaly">—</span>` },
    { field: 'generatedAt', headerName: 'Generated', minWidth: 120, valueFormatter: p => new Date(p.value as string).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) },
    { headerName: '', field: 'statementId', width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right', cellRenderer: () => `<button class="row-action-btn" aria-label="View statement"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<ChargebackStatementRow>) { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<ChargebackStatementRow>) { if (e.data) this.#router.navigate(['/manage/chargeback', e.data.statementId]); }
  onSearchChange(v: string | null | undefined)         { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: ChargebackStatementStatus)     { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  clearFilters() { this.searchText.set(''); this.statusFilter.set([]); this.typeFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'chargeback-statements.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
