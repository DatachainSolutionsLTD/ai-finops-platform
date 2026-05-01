// FinOps Platform Design System v1.1 — Conflicts — List screen (Agent A28).
// Pattern: List — summary → filter toolbar → AG Grid (type, agents, impact, resolution)
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
import { ConflictsService } from './coordinate.services';
import { formatCurrency } from '@lib/chart-defaults';
import { type ConflictListRow, type ConflictType, type ConflictStatus, CONFLICT_TYPE_OPTIONS, CONFLICT_STATUS_OPTIONS } from '@shared/types/coordinate.types';

@Component({
  selector: 'app-conflicts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './conflicts.component.html',
  styleUrl:    './conflicts.component.scss',
})
export class ConflictsComponent {
  readonly #svc    = inject(ConflictsService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<ConflictListRow>;
  constructor() { this.#title.setTitle('Conflicts · FinOps'); }

  readonly searchText   = signal('');
  readonly typeFilter   = signal<ConflictType[]>([]);
  readonly statusFilter = signal<ConflictStatus[]>([]);
  readonly loadError    = signal<string | null>(null);
  readonly typeOptions   = CONFLICT_TYPE_OPTIONS;
  readonly statusOptions = CONFLICT_STATUS_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, type: this.typeFilter().length ? this.typeFilter() : undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load conflicts'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.typeFilter().length > 0 || this.statusFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<ConflictListRow>[] = [
    { field: 'conflictType', headerName: 'Type', maxWidth: 180, cellRenderer: (p: ICellRendererParams<ConflictListRow>) => `<span class="type-chip">${this.#e((p.value as string).replace(/_/g,' '))}</span>` },
    {
      field: 'agentA', headerName: 'Conflicting agents', minWidth: 240, flex: 2,
      cellRenderer: (p: ICellRendererParams<ConflictListRow>) => {
        const r = p.data!;
        return `<div class="rec-cell">
          <span class="rec-name">${this.#e(r.agentA)} ↔ ${this.#e(r.agentB)}</span>
          <span class="rec-meta">${this.#e(r.resourceType)} · ${this.#e(r.businessUnit)}</span>
        </div>`;
      },
    },
    { field: 'status', headerName: 'Status', maxWidth: 160,
      cellRenderer: (p: ICellRendererParams<ConflictListRow>) => {
        const vm: Record<string, string> = { Intake:'info', Analyzing:'info', Pending_Human:'warning', Resolved_Auto:'success', Resolved_Human:'success', Escalated:'danger', Cancelled:'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e((p.value as string).replace(/_/g,' '))}</span>`;
      }
    },
    { field: 'requiresHuman', headerName: 'Human', maxWidth: 90, cellRenderer: (p: ICellRendererParams<ConflictListRow>) => (p.value as boolean) ? `<span class="human-req" aria-label="Requires human decision">⚑ Yes</span>` : `<span class="human-auto">Auto</span>` },
    { field: 'combinedImpact', headerName: 'Combined impact', maxWidth: 160, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<ConflictListRow>) => `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'chosenSavings', headerName: 'Resolution savings', maxWidth: 160, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<ConflictListRow>) => p.value ? `<span class="savings-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` : `<span class="no-cost">Pending</span>` },
    { field: 'resolutionDurationSec', headerName: 'Duration', maxWidth: 100, type: 'numericColumn', valueFormatter: p => p.value ? `${Math.round((p.value as number) / 60)}m` : '—' },
    { headerName: '', field: 'conflictId', width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right', cellRenderer: () => `<button class="row-action-btn" aria-label="View conflict detail"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<ConflictListRow>)   { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<ConflictListRow>) { if (e.data) this.#router.navigate(['/coordinate/conflicts', e.data.conflictId]); }
  onSearchChange(v: string | null | undefined)      { this.searchText.set(v ?? ''); }
  toggleTypeFilter(t: ConflictType)                 { this.typeFilter.update(c => c.includes(t) ? c.filter(x => x !== t) : [...c, t]); }
  toggleStatusFilter(s: ConflictStatus)             { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  clearFilters()  { this.searchText.set(''); this.typeFilter.set([]); this.statusFilter.set([]); }
  exportCsv()     { this.#gridApi?.exportDataAsCsv({ fileName: 'conflicts.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
