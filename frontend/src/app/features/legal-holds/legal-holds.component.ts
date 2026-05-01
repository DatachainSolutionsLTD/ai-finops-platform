// FinOps Platform Design System v1.1 — Legal Holds List
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
import { LegalHoldsService } from './compliance.services';
import { type LegalHoldRow, type LegalHoldStatus } from '@shared/types/compliance.types';

@Component({
  selector: 'app-legal-holds',
  standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './legal-holds.component.html',
  styleUrl:    './legal-holds.component.scss',
})
export class LegalHoldsComponent {
  readonly #svc    = inject(LegalHoldsService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<LegalHoldRow>;
  constructor() { this.#title.setTitle('Legal Holds · FinOps'); }

  readonly searchText   = signal('');
  readonly statusFilter = signal<LegalHoldStatus[]>([]);
  readonly loadError    = signal<string | null>(null);
  readonly statusOptions: LegalHoldStatus[] = ['Active','Released','Expired'];

  readonly #query = computed(() => ({ search: this.searchText() || undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load legal holds'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.statusFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<LegalHoldRow>[] = [
    { field: 'status', headerName: 'Status', maxWidth: 110, cellRenderer: (p: ICellRendererParams<LegalHoldRow>) => { const vm: Record<string,string> = { Active:'danger', Released:'neutral', Expired:'neutral' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`; } },
    { field: 'holdName', headerName: 'Hold', minWidth: 220, flex: 2, cellRenderer: (p: ICellRendererParams<LegalHoldRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${this.#e(r.holdName)}</span><span class="rec-meta">${r.externalCaseRef ? this.#e(r.externalCaseRef) + ' · ' : ''}${this.#e(r.holdCategory ?? 'General')}</span></div>`; } },
    { field: 'blockedPolicies', headerName: 'Blocking', maxWidth: 100, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<LegalHoldRow>) => { const v = p.value as number; return v > 0 ? `<span class="blocked-count" aria-label="${v} retention policies blocked">${v} polic${v !== 1 ? 'ies' : 'y'}</span>` : `<span class="no-block">None</span>`; } },
    { field: 'placedBy', headerName: 'Placed by', maxWidth: 150 },
    { field: 'placedAt', headerName: 'Placed', minWidth: 130, valueFormatter: p => new Date(p.value as string).toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'}) },
    { field: 'expiresAt', headerName: 'Expires', minWidth: 130, cellRenderer: (p: ICellRendererParams<LegalHoldRow>) => { if (!p.value) return `<span style="color:var(--finops-text-tertiary)">No expiry</span>`; const d = new Date(p.value as string); const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000); const cls = days < 14 ? 'exp-soon' : ''; return `<span class="${cls}">${d.toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'})}</span>`; } },
    { headerName: '', field: 'legalHoldId', width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right', cellRenderer: () => `<button class="row-action-btn" aria-label="View legal hold detail"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<LegalHoldRow>)   { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<LegalHoldRow>) { if (e.data) this.#router.navigate(['/compliance/legal-holds', e.data.legalHoldId]); }
  onSearchChange(v: string | null | undefined)   { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: LegalHoldStatus)         { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  clearFilters()  { this.searchText.set(''); this.statusFilter.set([]); }
  exportCsv()     { this.#gridApi?.exportDataAsCsv({ fileName: 'legal-holds.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
