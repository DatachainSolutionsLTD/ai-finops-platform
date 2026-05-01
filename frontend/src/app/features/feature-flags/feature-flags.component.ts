// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Feature Flag Management — List with per-row toggle variant.
// Location: apps/frontend/src/app/features/platform/features/
//           feature-flags.component.ts
//
// Pattern: List (§3.2) toggle variant — AG Grid with an ion-toggle cell
// renderer that persists immediately on change. No bulk actions (toggles are
// immediate and per-row). Filter by Category + Enabled state.
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
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
  IonPopover, IonList, IonItem, IonCheckbox, IonToggle,
  ToastController,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef, GridApi, GridReadyEvent, ICellRendererParams,
} from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { AuthService }           from '@core/auth/auth.service';
import { FeatureFlagsService }   from './feature-flags.service';
import {
  type FeatureFlagRow,
  type FeatureFlagCategory,
  FEATURE_FLAG_CATEGORY_OPTIONS,
} from '@shared/types/feature-flags.types';

@Component({
  selector: 'app-feature-flags',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
    IonPopover, IonList, IonItem, IonCheckbox, IonToggle,
    AgGridAngular,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './feature-flags.component.html',
  styleUrl:    './feature-flags.component.scss',
})
export class FeatureFlagsComponent {
  readonly #svc       = inject(FeatureFlagsService);
  readonly #auth      = inject(AuthService);
  readonly #title     = inject(Title);
  readonly #toastCtrl = inject(ToastController);

  #gridApi?: GridApi<FeatureFlagRow>;

  constructor() { this.#title.setTitle('Feature Flags · FinOps'); }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly searchText      = signal<string>('');
  readonly categoryFilter  = signal<FeatureFlagCategory[]>([]);
  readonly enabledFilter   = signal<boolean | null>(null);
  readonly loadError       = signal<string | null>(null);
  readonly categoryOptions = FEATURE_FLAG_CATEGORY_OPTIONS;

  // ── Query → data ──────────────────────────────────────────────────────────
  readonly #query = computed(() => ({
    search:   this.searchText()       || undefined,
    category: this.categoryFilter().length ? this.categoryFilter() : undefined,
    enabled:  this.enabledFilter()    ?? undefined,
    page: 0, limit: 50,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load feature flags'); return of(null); }),
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
    !!this.searchText() || this.categoryFilter().length > 0 || this.enabledFilter() !== null);
  readonly canToggle = computed(() => this.#auth.hasPermission('feature:toggle'));

  // ── AG Grid ───────────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110,
  };

  readonly colDefs: ColDef<FeatureFlagRow>[] = [
    {
      field: 'name',
      headerName: 'Feature flag',
      minWidth: 260, flex: 2,
      cellRenderer: (p: ICellRendererParams<FeatureFlagRow>) => {
        const r = p.data!;
        return `<div class="flag-cell">
          <span class="flag-name">${this.#escape(r.name)}</span>
          <span class="flag-key">${this.#escape(r.key)}</span>
        </div>`;
      },
    },
    {
      field: 'description',
      headerName: 'Description',
      minWidth: 280, flex: 3,
      cellRenderer: (p: ICellRendererParams<FeatureFlagRow>) =>
        `<span class="flag-desc">${this.#escape(p.value as string)}</span>`,
    },
    {
      field: 'category',
      headerName: 'Category',
      maxWidth: 140,
      cellRenderer: (p: ICellRendererParams<FeatureFlagRow>) =>
        `<span class="cat-pill cat-${(p.value as string).toLowerCase()}">${this.#escape(p.value as string)}</span>`,
    },
    {
      field: 'audience',
      headerName: 'Audience',
      maxWidth: 150,
      cellRenderer: (p: ICellRendererParams<FeatureFlagRow>) =>
        `<span class="audience-label">${this.#escape((p.value as string).replace('_', ' '))}</span>`,
    },
    {
      field: 'rolloutPct',
      headerName: 'Rollout',
      maxWidth: 90, type: 'numericColumn',
      valueFormatter: p => `${p.value as number}%`,
    },
    {
      field: 'enabled',
      headerName: 'Enabled',
      maxWidth: 100,
      sortable: false, filter: false,
      // Uses AG Grid cellRenderer to render an inline toggle via DOM
      // Actual toggling calls onToggleFlag via a custom event bubbled to the grid host
      cellRenderer: (p: ICellRendererParams<FeatureFlagRow>) => {
        const checked = p.value as boolean;
        const canToggle = this.canToggle();
        return `<label class="toggle-label" aria-label="Toggle ${this.#escape(p.data!.name)}">
          <input type="checkbox" class="flag-toggle-input" data-flag-id="${p.data!.flagId}"
            ${checked ? 'checked' : ''} ${canToggle ? '' : 'disabled'} />
          <span class="toggle-track ${checked ? 'on' : 'off'}"></span>
        </label>`;
      },
    },
    {
      field: 'updatedAt',
      headerName: 'Last changed',
      minWidth: 130,
      valueFormatter: p => this.#relativeTime(p.value as string),
    },
    {
      field: 'updatedBy',
      headerName: 'Changed by',
      minWidth: 140,
    },
  ];

  onGridReady(e: GridReadyEvent<FeatureFlagRow>) { this.#gridApi = e.api; }

  // Toggle handled via click delegation on the grid host element
  onGridClick(event: Event) {
    const target = event.target as HTMLElement;
    const input  = target.closest('.flag-toggle-input') as HTMLInputElement | null;
    if (!input || !this.canToggle()) return;
    const flagId  = input.dataset['flagId']!;
    const enabled = input.checked;
    this.onToggleFlag(flagId, enabled);
  }

  onToggleFlag(flagId: string, enabled: boolean) {
    this.#svc.setEnabled(flagId, enabled).subscribe({
      next: async () => {
        const t = await this.#toastCtrl.create({
          message: `Feature flag ${enabled ? 'enabled' : 'disabled'}.`,
          duration: 1800, position: 'top', color: enabled ? 'success' : 'warning',
        });
        await t.present();
      },
      error: async err => {
        const t = await this.#toastCtrl.create({
          message: err.title ?? 'Unable to update feature flag.',
          duration: 3000, position: 'top', color: 'danger',
        });
        await t.present();
      },
    });
  }

  exportCsv() { this.#gridApi?.exportDataAsCsv({ fileName: 'feature-flags.csv' }); }

  onSearchChange(v: string | null | undefined) { this.searchText.set(v ?? ''); }
  toggleCategoryFilter(c: FeatureFlagCategory) { this.categoryFilter.update(cur => cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]); }
  setEnabledFilter(val: boolean | null) { this.enabledFilter.set(val); }
  clearFilters() { this.searchText.set(''); this.categoryFilter.set([]); this.enabledFilter.set(null); }

  readonly retry = () => { this.loadError.set(null); };

  #escape(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  #relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
}
