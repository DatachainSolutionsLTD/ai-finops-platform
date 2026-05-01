// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Allocations — List screen.
// Location: apps/frontend/src/app/features/understand/allocations/
//           allocations.component.ts
// Pattern: List (§3.2): summary row → filter/search toolbar → AG Grid
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
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClickedEvent,
} from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { AllocationsService }    from './allocations.service';
import { formatCurrency }        from '@lib/chart-defaults';
import {
  type AllocationListRow,
  type AllocationStatus,
  type AllocationModel,
  ALLOCATION_STATUS_OPTIONS,
  ALLOCATION_MODEL_OPTIONS,
} from '@shared/types/understand-lists.types';

@Component({
  selector: 'app-allocations',
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
  templateUrl: './allocations.component.html',
  styleUrl:    './allocations.component.scss',
})
export class AllocationsComponent {
  readonly #svc    = inject(AllocationsService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<AllocationListRow>;

  constructor() { this.#title.setTitle('Allocations · FinOps'); }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly searchText    = signal<string>('');
  readonly statusFilter  = signal<AllocationStatus[]>([]);
  readonly modelFilter   = signal<AllocationModel[]>([]);
  readonly loadError     = signal<string | null>(null);

  readonly statusOptions = ALLOCATION_STATUS_OPTIONS;
  readonly modelOptions  = ALLOCATION_MODEL_OPTIONS;

  // ── Query → data ──────────────────────────────────────────────────────────
  readonly #query = computed(() => ({
    search: this.searchText() || undefined,
    status: this.statusFilter().length ? this.statusFilter() : undefined,
    model:  this.modelFilter().length  ? this.modelFilter()  : undefined,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load allocations'); return of(null); }),
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
    !!this.searchText() || this.statusFilter().length > 0 || this.modelFilter().length > 0);

  // ── AG Grid ───────────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<AllocationListRow>[] = [
    {
      field: 'ruleName', headerName: 'Allocation rule', minWidth: 240, flex: 2,
      cellRenderer: (p: ICellRendererParams<AllocationListRow>) => {
        const r = p.data!;
        return `<div class="rule-cell">
          <span class="rule-name">${this.#escape(r.ruleName)}</span>
          <span class="rule-desc">${this.#escape(r.description)}</span>
        </div>`;
      },
    },
    {
      field: 'model', headerName: 'Model', maxWidth: 150,
      cellRenderer: (p: ICellRendererParams<AllocationListRow>) =>
        `<span class="model-pill model-${(p.value as string).toLowerCase().replace('_','-')}">${this.#escape((p.value as string).replace('_',' '))}</span>`,
    },
    {
      field: 'status', headerName: 'Status', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<AllocationListRow>) => {
        const vm: Record<string, string> = { Applied:'success', Pending:'info', Failed:'danger', Partial:'warning', Superseded:'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(p.value as string)}</span>`;
      },
    },
    { field: 'targetBu',     headerName: 'Target BU',   minWidth: 160 },
    { field: 'billingPeriod', headerName: 'Period',     maxWidth: 110 },
    {
      field: 'totalAmount', headerName: 'Total cost', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AllocationListRow>) =>
        `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>`,
    },
    {
      field: 'coverageRate', headerName: 'Coverage', maxWidth: 110, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AllocationListRow>) => {
        const v = p.value as number;
        const cls = v < 80 ? 'cov-low' : v < 95 ? 'cov-mid' : 'cov-full';
        return `<span class="${cls}">${v.toFixed(1)}%</span>`;
      },
    },
    {
      field: 'appliedAt', headerName: 'Applied', minWidth: 130,
      valueFormatter: p => p.value ? this.#relativeTime(p.value as string) : '—',
    },
    {
      headerName: '', field: 'allocationId',
      width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="Open allocation detail">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
         </button>`,
    },
  ];

  onGridReady(e: GridReadyEvent<AllocationListRow>) { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<AllocationListRow>) {
    if (e.data) this.#router.navigate(['/understand/allocations', e.data.allocationId]);
  }

  onSearchChange(v: string | null | undefined) { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: AllocationStatus) { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  toggleModelFilter(m: AllocationModel)   { this.modelFilter.update(c => c.includes(m) ? c.filter(x => x !== m) : [...c, m]); }
  clearFilters() { this.searchText.set(''); this.statusFilter.set([]); this.modelFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'allocations.csv' }); }
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
