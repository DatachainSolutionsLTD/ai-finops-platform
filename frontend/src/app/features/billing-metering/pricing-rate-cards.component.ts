// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Pricing & Rate Cards — List screen.
// Location: apps/frontend/src/app/features/platform/pricing/
//           pricing-rate-cards.component.ts
// Pattern: List (§3.2) — multi-currency rate display, filter by status and
// resource type, create-new modal with Reactive Form.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
  IonPopover, IonList, IonItem, IonCheckbox,
  IonModal, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner,
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
import { AuthService }           from '@core/auth/auth.service';
import { PricingRateCardsService } from './pricing-rate-cards.service';
import { formatCurrency }        from '@lib/chart-defaults';
import {
  type RateCardListRow,
  type RateCardStatus,
  type RateCardResourceType,
  RATE_CARD_STATUS_OPTIONS,
  RATE_CARD_RESOURCE_TYPE_OPTIONS,
  PRICING_UNIT_OPTIONS,
} from '@shared/types/pricing-rate-cards.types';

@Component({
  selector: 'app-pricing-rate-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
    IonPopover, IonList, IonItem, IonCheckbox,
    IonModal, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner,
    AgGridAngular,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './pricing-rate-cards.component.html',
  styleUrl:    './pricing-rate-cards.component.scss',
})
export class PricingRateCardsComponent {
  readonly #svc       = inject(PricingRateCardsService);
  readonly #auth      = inject(AuthService);
  readonly #router    = inject(Router);
  readonly #title     = inject(Title);
  readonly #toast     = inject(ToastController);
  readonly #alert     = inject(AlertController);
  readonly #fb        = inject(FormBuilder);

  #gridApi?: GridApi<RateCardListRow>;

  constructor() { this.#title.setTitle('Pricing & Rate Cards · FinOps'); }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly searchText          = signal<string>('');
  readonly statusFilter        = signal<RateCardStatus[]>([]);
  readonly resourceTypeFilter  = signal<RateCardResourceType[]>([]);
  readonly loadError           = signal<string | null>(null);
  readonly selectedIds         = signal<string[]>([]);
  readonly isCreateOpen        = signal<boolean>(false);
  readonly isCreating          = signal<boolean>(false);

  readonly statusOptions       = RATE_CARD_STATUS_OPTIONS;
  readonly resourceTypeOptions = RATE_CARD_RESOURCE_TYPE_OPTIONS;
  readonly pricingUnitOptions  = PRICING_UNIT_OPTIONS;

  // ── Query → data ──────────────────────────────────────────────────────────
  readonly #query = computed(() => ({
    search:       this.searchText() || undefined,
    status:       this.statusFilter().length        ? this.statusFilter()       : undefined,
    resourceType: this.resourceTypeFilter().length  ? this.resourceTypeFilter() : undefined,
    page: 0, limit: 50,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load rate cards'); return of(null); }),
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
    !!this.searchText() || this.statusFilter().length > 0 || this.resourceTypeFilter().length > 0);
  readonly hasSelection   = computed(() => this.selectedIds().length > 0);
  readonly selectionCount = computed(() => this.selectedIds().length);

  readonly canCreate  = computed(() => this.#auth.hasPermission('pricing:create'));
  readonly canArchive = computed(() => this.#auth.hasPermission('pricing:archive'));

  // ── Create form ───────────────────────────────────────────────────────────
  readonly createForm: FormGroup = this.#fb.group({
    name:          ['', [Validators.required, Validators.maxLength(100)]],
    description:   ['', [Validators.maxLength(300)]],
    resourceType:  ['Compute', Validators.required],
    rate:          [null, [Validators.required, Validators.min(0.0001)]],
    pricingUnit:   ['vCPU-hour', Validators.required],
    effectiveFrom: ['', Validators.required],
    effectiveTo:   [null],
  });

  readonly createFieldError = (path: string): string | null => {
    const ctrl = this.createForm.get(path);
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required'])   return 'This field is required.';
    if (ctrl.errors['maxlength'])  return `Must be at most ${ctrl.errors['maxlength'].requiredLength} characters.`;
    if (ctrl.errors['min'])        return 'Rate must be greater than zero.';
    return 'Invalid value.';
  };

  // ── AG Grid ───────────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110,
  };

  readonly colDefs: ColDef<RateCardListRow>[] = [
    {
      headerCheckboxSelection: true, checkboxSelection: true,
      width: 48, maxWidth: 48, minWidth: 48, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'left', headerName: '',
    },
    {
      field: 'name',
      headerName: 'Rate card',
      minWidth: 220, flex: 2,
      cellRenderer: (p: ICellRendererParams<RateCardListRow>) => {
        const r = p.data!;
        return `<div class="rc-cell">
          <span class="rc-name">${this.#escape(r.name)}</span>
          <span class="rc-desc">${this.#escape(r.description)}</span>
        </div>`;
      },
    },
    {
      field: 'resourceType',
      headerName: 'Resource type',
      maxWidth: 150,
      cellRenderer: (p: ICellRendererParams<RateCardListRow>) =>
        `<span class="type-pill type-${(p.value as string).toLowerCase()}">${this.#escape(p.value as string)}</span>`,
    },
    {
      field: 'rate',
      headerName: 'Rate',
      maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<RateCardListRow>) => {
        const r = p.data!;
        return `<span class="rate-value">${formatCurrency(r.rate, { code: r.currency })}</span>`;
      },
    },
    {
      field: 'pricingUnit',
      headerName: 'Unit',
      maxWidth: 150,
      cellRenderer: (p: ICellRendererParams<RateCardListRow>) =>
        `<span class="unit-label">${this.#escape(p.value as string)}</span>`,
    },
    {
      field: 'status',
      headerName: 'Status',
      maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<RateCardListRow>) => {
        const vm: Record<string, string> = { Active: 'success', Draft: 'info', Superseded: 'warning', Archived: 'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(p.value as string)}</span>`;
      },
    },
    {
      field: 'effectiveFrom',
      headerName: 'Effective from',
      minWidth: 130,
      valueFormatter: p => new Date(p.value as string).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      field: 'version',
      headerName: 'Ver.',
      maxWidth: 70, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<RateCardListRow>) => `<span class="version-pill">v${p.value}</span>`,
    },
    {
      headerName: '',
      field: 'rateCardId',
      width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="Open rate card details">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="9 18 15 12 9 6"/>
           </svg>
         </button>`,
    },
  ];

  onGridReady(e: GridReadyEvent<RateCardListRow>)     { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<RateCardListRow>)   {
    if ((e.event?.target as HTMLElement)?.closest('.ag-selection-checkbox')) return;
    if (e.data) this.#router.navigate(['/platform/pricing', e.data.rateCardId]);
  }
  onSelectionChanged(e: SelectionChangedEvent<RateCardListRow>) {
    this.selectedIds.set((this.#gridApi?.getSelectedRows() ?? []).map(r => r.rateCardId));
  }

  onSearchChange(v: string | null | undefined) { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: RateCardStatus)        { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  toggleTypeFilter(t: RateCardResourceType)    { this.resourceTypeFilter.update(c => c.includes(t) ? c.filter(x => x !== t) : [...c, t]); }
  clearFilters()                               { this.searchText.set(''); this.statusFilter.set([]); this.resourceTypeFilter.set([]); }

  exportCsv() { this.#gridApi?.exportDataAsCsv({ fileName: 'rate-cards.csv' }); }

  openCreateModal() { this.createForm.reset({ resourceType: 'Compute', pricingUnit: 'vCPU-hour' }); this.isCreateOpen.set(true); }
  closeCreateModal() { this.isCreateOpen.set(false); }

  async submitCreate() {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    this.isCreating.set(true);
    this.#svc.create({ ...this.createForm.value, currency: 'AED' }).subscribe({
      next: async () => {
        this.isCreating.set(false);
        this.isCreateOpen.set(false);
        const t = await this.#toast.create({ message: 'Rate card created.', duration: 2500, position: 'top', color: 'success' });
        await t.present();
      },
      error: async err => {
        this.isCreating.set(false);
        const t = await this.#toast.create({ message: err.title ?? 'Unable to create rate card.', duration: 3000, position: 'top', color: 'danger' });
        await t.present();
      },
    });
  }

  async bulkArchive() {
    const count = this.selectionCount();
    const alert = await this.#alert.create({
      header: 'Archive rate cards',
      message: `Archive ${count} selected rate card${count > 1 ? 's' : ''}? Archived cards are retained for audit but cannot be used for new normalizations.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Archive', role: 'destructive', handler: () => {
            this.selectedIds().forEach(id => this.#svc.archive(id).subscribe());
            this.selectedIds.set([]);
          }},
      ],
    });
    await alert.present();
  }

  readonly retry = () => { this.loadError.set(null); };

  #escape(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}
