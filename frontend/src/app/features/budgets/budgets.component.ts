// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Budgets — List screen.
// Location: apps/frontend/src/app/features/quantify/budgets/budgets.component.ts
// Pattern: List (§3.2): 5-stat summary → filter toolbar → AG Grid
// Key feature: budget health badge + consumption progress bar in cells.
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
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { AuthService }           from '@core/auth/auth.service';
import { BudgetsService }        from './budgets.service';
import { formatCurrency }        from '@lib/chart-defaults';
import {
  type BudgetListRow,
  type BudgetStatus,
  type BudgetHealth,
  type BudgetDimensionType,
  BUDGET_STATUS_OPTIONS,
  BUDGET_HEALTH_OPTIONS,
  BUDGET_DIMENSION_OPTIONS,
} from '@shared/types/budgets.types';

@Component({
  selector: 'app-budgets',
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
  templateUrl: './budgets.component.html',
  styleUrl:    './budgets.component.scss',
})
export class BudgetsComponent {
  readonly #svc    = inject(BudgetsService);
  readonly #auth   = inject(AuthService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<BudgetListRow>;

  constructor() { this.#title.setTitle('Budgets · FinOps'); }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly searchText     = signal<string>('');
  readonly healthFilter   = signal<BudgetHealth[]>([]);
  readonly statusFilter   = signal<BudgetStatus[]>([]);
  readonly dimensionFilter = signal<BudgetDimensionType[]>([]);
  readonly loadError      = signal<string | null>(null);

  readonly healthOptions    = BUDGET_HEALTH_OPTIONS;
  readonly statusOptions    = BUDGET_STATUS_OPTIONS;
  readonly dimensionOptions = BUDGET_DIMENSION_OPTIONS;

  readonly #query = computed(() => ({
    search:    this.searchText()        || undefined,
    health:    this.healthFilter().length   ? this.healthFilter()    : undefined,
    status:    this.statusFilter().length   ? this.statusFilter()    : undefined,
    dimension: this.dimensionFilter().length ? this.dimensionFilter() : undefined,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load budgets'); return of(null); }),
        ),
      ),
    ),
    { initialValue: null },
  );

  readonly summary = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() =>
    !!this.searchText() || this.healthFilter().length > 0 ||
    this.statusFilter().length > 0 || this.dimensionFilter().length > 0);
  readonly canCreate = computed(() => this.#auth.hasPermission('budget:create'));

  // ── AG Grid ───────────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<BudgetListRow>[] = [
    {
      field: 'name', headerName: 'Budget', minWidth: 220, flex: 2,
      cellRenderer: (p: ICellRendererParams<BudgetListRow>) => {
        const r = p.data!;
        return `<div class="budget-cell">
          <span class="budget-name">${this.#escape(r.name)}</span>
          <span class="budget-dim">${this.#escape(r.dimensionType.replace('_',' '))} · ${this.#escape(r.dimensionName)}</span>
        </div>`;
      },
    },
    {
      field: 'health', headerName: 'Health', maxWidth: 140,
      cellRenderer: (p: ICellRendererParams<BudgetListRow>) => {
        const vm: Record<string, string> = { On_Track:'success', At_Risk:'warning', Over_Budget:'danger', No_Spend:'neutral' };
        const label = (p.value as string).replace('_', ' ');
        return `<span class="health-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(label)}</span>`;
      },
    },
    { field: 'periodType',   headerName: 'Period',    maxWidth: 110 },
    { field: 'billingPeriod', headerName: 'Cycle',    maxWidth: 110 },
    {
      field: 'budgetAmount', headerName: 'Budget', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<BudgetListRow>) =>
        `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>`,
    },
    {
      field: 'consumptionPct', headerName: 'Consumption', minWidth: 170,
      cellRenderer: (p: ICellRendererParams<BudgetListRow>) => {
        const pct = Math.min(p.value as number, 100);
        const cls = pct >= 100 ? 'prog-over' : pct >= 80 ? 'prog-warn' : 'prog-ok';
        return `<div class="prog-cell" aria-label="${pct.toFixed(1)}% consumed">
          <div class="prog-bar-track">
            <div class="prog-bar-fill ${cls}" style="width:${Math.min(pct, 100)}%"></div>
          </div>
          <span class="prog-label">${(p.value as number).toFixed(1)}%</span>
        </div>`;
      },
    },
    {
      field: 'variancePct', headerName: 'Forecast variance', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<BudgetListRow>) => {
        const v = p.value as number;
        const cls = v >= 10 ? 'var-high' : v >= 0 ? 'var-mid' : 'var-ok';
        return `<span class="${cls}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
      },
    },
    { field: 'ownedBy', headerName: 'Owner', minWidth: 140 },
    {
      headerName: '', field: 'budgetId',
      width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="Open budget detail">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
         </button>`,
    },
  ];

  onGridReady(e: GridReadyEvent<BudgetListRow>) { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<BudgetListRow>) {
    if (e.data) this.#router.navigate(['/quantify/budgets', e.data.budgetId]);
  }

  onSearchChange(v: string | null | undefined)   { this.searchText.set(v ?? ''); }
  toggleHealthFilter(h: BudgetHealth)            { this.healthFilter.update(c => c.includes(h) ? c.filter(x => x !== h) : [...c, h]); }
  toggleStatusFilter(s: BudgetStatus)            { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  toggleDimensionFilter(d: BudgetDimensionType)  { this.dimensionFilter.update(c => c.includes(d) ? c.filter(x => x !== d) : [...c, d]); }
  clearFilters() { this.searchText.set(''); this.healthFilter.set([]); this.statusFilter.set([]); this.dimensionFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'budgets.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
  #escape(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
