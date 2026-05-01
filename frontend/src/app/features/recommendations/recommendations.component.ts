// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Recommendations Queue — List screen with bulk approve / reject.
// Location: apps/frontend/src/app/features/optimize/queue/
//           recommendations.component.ts
// Pattern: List (§3.2): summary row → 3-filter toolbar → bulk action bar
//          → AG Grid with priority, type, savings, confidence, source columns
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
  IonPopover, IonList, IonItem, IonCheckbox, IonModal, IonTextarea, IonSpinner,
  ToastController, AlertController,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef, GridApi, GridReadyEvent, ICellRendererParams,
  RowClickedEvent, SelectionChangedEvent,
} from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }    from '@shared/components/page-header.component';
import { LoadingStateComponent }  from '@shared/components/loading-state.component';
import { EmptyStateComponent }    from '@shared/components/empty-state.component';
import { AuthService }            from '@core/auth/auth.service';
import { RecommendationsService } from './recommendations.service';
import { formatCurrency }         from '@lib/chart-defaults';
import {
  type RecommendationListRow,
  type RecommendationStatus,
  type RecommendationType,
  type RecommendationPriority,
  type RecommendationSource,
  REC_STATUS_OPTIONS, REC_TYPE_OPTIONS, REC_PRIORITY_OPTIONS, REC_SOURCE_LABELS,
} from '@shared/types/recommendations.types';

@Component({
  selector: 'app-recommendations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
    IonPopover, IonList, IonItem, IonCheckbox, IonModal, IonTextarea, IonSpinner,
    AgGridAngular,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './recommendations.component.html',
  styleUrl:    './recommendations.component.scss',
})
export class RecommendationsComponent {
  readonly #svc       = inject(RecommendationsService);
  readonly #auth      = inject(AuthService);
  readonly #router    = inject(Router);
  readonly #title     = inject(Title);
  readonly #toast     = inject(ToastController);
  readonly #alert     = inject(AlertController);
  readonly #fb        = inject(FormBuilder);
  #gridApi?: GridApi<RecommendationListRow>;

  constructor() { this.#title.setTitle('Recommendations Queue · FinOps'); }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly searchText      = signal<string>('');
  readonly statusFilter    = signal<RecommendationStatus[]>([]);
  readonly priorityFilter  = signal<RecommendationPriority[]>([]);
  readonly typeFilter      = signal<RecommendationType[]>([]);
  readonly loadError       = signal<string | null>(null);
  readonly selectedIds     = signal<string[]>([]);
  readonly isRejectOpen    = signal<boolean>(false);
  readonly isSubmitting    = signal<boolean>(false);
  readonly pendingRejectIds = signal<string[]>([]);

  readonly statusOptions   = REC_STATUS_OPTIONS;
  readonly priorityOptions = REC_PRIORITY_OPTIONS;
  readonly typeOptions     = REC_TYPE_OPTIONS;
  readonly sourceLabels    = REC_SOURCE_LABELS;

  readonly rejectForm: FormGroup = this.#fb.group({
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
  });

  readonly #query = computed(() => ({
    search:   this.searchText()       || undefined,
    status:   this.statusFilter().length   ? this.statusFilter()   : undefined,
    priority: this.priorityFilter().length ? this.priorityFilter() : undefined,
    type:     this.typeFilter().length     ? this.typeFilter()      : undefined,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load recommendations'); return of(null); }),
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
    !!this.searchText() || this.statusFilter().length > 0 ||
    this.priorityFilter().length > 0 || this.typeFilter().length > 0);
  readonly hasSelection   = computed(() => this.selectedIds().length > 0);
  readonly selectionCount = computed(() => this.selectedIds().length);
  readonly canApprove     = computed(() => this.#auth.hasPermission('optimization:approve'));
  readonly canReject      = computed(() => this.#auth.hasPermission('optimization:approve'));

  // ── AG Grid ───────────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<RecommendationListRow>[] = [
    {
      headerCheckboxSelection: true, checkboxSelection: true,
      width: 48, maxWidth: 48, minWidth: 48, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'left', headerName: '',
    },
    {
      field: 'priority', headerName: 'Priority', maxWidth: 115, pinned: 'left',
      cellRenderer: (p: ICellRendererParams<RecommendationListRow>) => {
        const vm: Record<string, string> = { Critical:'prio-critical', High:'prio-high', Medium:'prio-medium', Low:'prio-low' };
        return `<span class="prio-badge ${vm[p.value as string] ?? 'prio-low'}">${this.#escape(p.value as string)}</span>`;
      },
    },
    {
      field: 'title', headerName: 'Recommendation', minWidth: 260, flex: 2,
      cellRenderer: (p: ICellRendererParams<RecommendationListRow>) => {
        const r = p.data!;
        return `<div class="rec-cell">
          <span class="rec-title">${this.#escape(r.title)}</span>
          <span class="rec-meta">${this.#escape(r.provider)} · ${this.#escape(r.resourceType)} · ${this.#escape(r.businessUnit)}</span>
        </div>`;
      },
    },
    {
      field: 'type', headerName: 'Type', maxWidth: 180,
      cellRenderer: (p: ICellRendererParams<RecommendationListRow>) =>
        `<span class="type-pill type-${(p.value as string).toLowerCase().replace(/_/g,'-')}">${this.#escape((p.value as string).replace(/_/g,' '))}</span>`,
    },
    {
      field: 'status', headerName: 'Status', maxWidth: 120,
      cellRenderer: (p: ICellRendererParams<RecommendationListRow>) => {
        const vm: Record<string, string> = { Pending:'info', Approved:'success', Rejected:'neutral', Executed:'success', Failed:'danger', Expired:'neutral', Superseded:'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(p.value as string)}</span>`;
      },
    },
    {
      field: 'estimatedSavings', headerName: 'Est. savings', maxWidth: 170, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<RecommendationListRow>) => {
        const r = p.data!;
        if (r.estimatedSavings === 0) return `<span class="savings-zero">Carbon only</span>`;
        return `<span class="savings-cell">${formatCurrency(r.estimatedSavings, { code: r.currency })} <span class="savings-period">/${r.savingsPeriod === 'annual' ? 'yr' : 'mo'}</span></span>`;
      },
    },
    {
      field: 'confidenceScore', headerName: 'Conf.', maxWidth: 90, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<RecommendationListRow>) => {
        const v = p.value as number;
        const cls = v >= 90 ? 'conf-high' : v >= 75 ? 'conf-mid' : 'conf-low';
        return `<span class="${cls}">${v}%</span>`;
      },
    },
    {
      field: 'source', headerName: 'Source', maxWidth: 160,
      cellRenderer: (p: ICellRendererParams<RecommendationListRow>) =>
        `<span class="source-label">${this.#escape(REC_SOURCE_LABELS[p.value as RecommendationSource] ?? p.value as string)}</span>`,
    },
    {
      field: 'risk', headerName: 'Risk', maxWidth: 90,
      cellRenderer: (p: ICellRendererParams<RecommendationListRow>) => {
        const vm: Record<string, string> = { Low:'risk-low', Medium:'risk-medium', High:'risk-high' };
        return `<span class="risk-badge ${vm[p.value as string] ?? 'risk-low'}">${this.#escape(p.value as string)}</span>`;
      },
    },
    {
      headerName: '', field: 'recommendationId',
      width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="View recommendation detail">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
         </button>`,
    },
  ];

  onGridReady(e: GridReadyEvent<RecommendationListRow>)       { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<RecommendationListRow>)     {
    if ((e.event?.target as HTMLElement)?.closest('.ag-selection-checkbox')) return;
    if (e.data) this.#router.navigate(['/optimize/recommendations', e.data.recommendationId]);
  }
  onSelectionChanged(_e: SelectionChangedEvent<RecommendationListRow>) {
    this.selectedIds.set((this.#gridApi?.getSelectedRows() ?? []).map(r => r.recommendationId));
  }

  onSearchChange(v: string | null | undefined)    { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: RecommendationStatus)     { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  togglePriorityFilter(p: RecommendationPriority) { this.priorityFilter.update(c => c.includes(p) ? c.filter(x => x !== p) : [...c, p]); }
  toggleTypeFilter(t: RecommendationType)         { this.typeFilter.update(c => c.includes(t) ? c.filter(x => x !== t) : [...c, t]); }
  clearFilters() { this.searchText.set(''); this.statusFilter.set([]); this.priorityFilter.set([]); this.typeFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'recommendations.csv' }); }

  // ── Approve / Reject ──────────────────────────────────────────────────────
  async bulkApprove() {
    const ids   = this.selectedIds();
    const count = ids.length;
    const alert = await this.#alert.create({
      header: 'Approve recommendations',
      message: `Approve ${count} selected recommendation${count > 1 ? 's' : ''}? Approved items enter the execution queue.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Approve', handler: () => {
            this.isSubmitting.set(true);
            this.#svc.bulkApprove(ids).subscribe({
              next: async () => {
                this.isSubmitting.set(false);
                this.selectedIds.set([]);
                const t = await this.#toast.create({ message: `${count} recommendation${count > 1 ? 's' : ''} approved.`, duration: 2500, position: 'top', color: 'success' });
                await t.present();
              },
              error: async () => {
                this.isSubmitting.set(false);
                const t = await this.#toast.create({ message: 'Unable to approve. Please try again.', duration: 3000, position: 'top', color: 'danger' });
                await t.present();
              },
            });
          }},
      ],
    });
    await alert.present();
  }

  openRejectModal() {
    this.pendingRejectIds.set(this.selectedIds());
    this.rejectForm.reset();
    this.isRejectOpen.set(true);
  }
  closeRejectModal() { this.isRejectOpen.set(false); }

  async submitReject() {
    if (this.rejectForm.invalid) { this.rejectForm.markAllAsTouched(); return; }
    const ids    = this.pendingRejectIds();
    const reason = this.rejectForm.value.reason as string;
    this.isSubmitting.set(true);
    this.#svc.bulkReject(ids, reason).subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        this.isRejectOpen.set(false);
        this.selectedIds.set([]);
        const t = await this.#toast.create({ message: `${ids.length} recommendation${ids.length > 1 ? 's' : ''} rejected.`, duration: 2500, position: 'top', color: 'warning' });
        await t.present();
      },
      error: async () => {
        this.isSubmitting.set(false);
        const t = await this.#toast.create({ message: 'Unable to reject. Please try again.', duration: 3000, position: 'top', color: 'danger' });
        await t.present();
      },
    });
  }

  rejectFieldError(): string | null {
    const ctrl = this.rejectForm.get('reason');
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required'])   return 'A rejection reason is required.';
    if (ctrl.errors['minlength'])  return 'Reason must be at least 10 characters.';
    if (ctrl.errors['maxlength'])  return 'Reason must be at most 500 characters.';
    return 'Invalid value.';
  }

  readonly retry = () => { this.loadError.set(null); };
  #escape(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
