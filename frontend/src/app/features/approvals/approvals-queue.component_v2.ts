// FinOps Platform Design System v1.1 — Updated v2
// escHtml() → @lib/utils/html.utils | relativeTime() → @lib/utils/date.utils
// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Approvals Queue — List screen. Agent A30 (Human-in-the-Loop).
// Location: apps/frontend/src/app/features/coordinate/approvals/
//           approvals-queue.component.ts
// Pattern: List (§3.2): summary row → 3-filter → bulk approve/reject
//          → AG Grid: priority, title, agent, SLA countdown, impact, status
// ─────────────────────────────────────────────────────────────────────────────

import { SummaryStatRowComponent } from '@shared/components/summary-stat-row-component.component';
import { GridShellCardComponent } from '@shared/components/grid-shell-card-component.component';
import { BulkActionBarComponent } from '@shared/components/bulk-action-bar.component';
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
  IonPopover, IonList, IonItem, IonCheckbox,
  IonModal, IonTextarea, IonSpinner,
  ToastController, AlertController,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef, GridApi, GridReadyEvent, ICellRendererParams,
  RowClickedEvent, SelectionChangedEvent,
} from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { escHtml } from '@lib/utils/html.utils';
import type { SummaryStat } from '@shared/components/summary-stat-row.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { ApprovalsQueueService } from './coordinate.services';
import { formatCurrency }        from '@lib/chart-defaults';
import {
  type ApprovalQueueRow,
  type ApprovalPriority, type ApprovalStatus, type ApprovalDomain,
  APPROVAL_PRIORITY_OPTIONS, APPROVAL_STATUS_OPTIONS, APPROVAL_DOMAIN_OPTIONS,
} from '@shared/types/coordinate.types';

@Component({
  selector: 'app-approvals-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
    IonPopover, IonList, IonItem, IonCheckbox,
    IonModal, IonTextarea, IonSpinner,
    AgGridAngular,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent, SummaryStatRowComponent, GridShellCardComponent, BulkActionBarComponent,],
  templateUrl: './approvals-queue.component.html',
  styleUrl:    './approvals-queue.component.scss',
})
export class ApprovalsQueueComponent {
  readonly #svc    = inject(ApprovalsQueueService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  readonly #toast  = inject(ToastController);
  readonly #alert  = inject(AlertController);
  readonly #fb     = inject(FormBuilder);
  #gridApi?: GridApi<ApprovalQueueRow>;

  constructor() { this.#title.setTitle('Approvals Queue · FinOps'); }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly searchText      = signal('');
  readonly priorityFilter  = signal<ApprovalPriority[]>([]);
  readonly domainFilter    = signal<ApprovalDomain[]>([]);
  readonly statusFilter    = signal<ApprovalStatus[]>([]);
  readonly loadError       = signal<string | null>(null);
  readonly selectedIds     = signal<string[]>([]);
  readonly isRejectOpen    = signal(false);
  readonly isSubmitting    = signal(false);
  readonly pendingRejectIds = signal<string[]>([]);

  readonly priorityOptions = APPROVAL_PRIORITY_OPTIONS;
  readonly statusOptions   = APPROVAL_STATUS_OPTIONS;
  readonly domainOptions   = APPROVAL_DOMAIN_OPTIONS;

  readonly rejectForm: FormGroup = this.#fb.group({
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
  });

  readonly #query = computed(() => ({
    search:   this.searchText()       || undefined,
    priority: this.priorityFilter().length ? this.priorityFilter() : undefined,
    domain:   this.domainFilter().length   ? this.domainFilter()   : undefined,
    status:   this.statusFilter().length   ? this.statusFilter()   : undefined,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load approvals'); return of(null); }),
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
    !!this.searchText() || this.priorityFilter().length > 0 ||
    this.domainFilter().length > 0 || this.statusFilter().length > 0);
  readonly hasSelection   = computed(() => this.selectedIds().length > 0);
  readonly selectionCount = computed(() => this.selectedIds().length);

  // ── AG Grid ───────────────────────────────────────────────────────────────

  readonly summaryStats = computed<SummaryStat[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Pending', value: s.pending, colorClass: (s.pending > 0) ? 'warning' : undefined },
      { label: 'SLA at risk', value: s.slaAtRisk, colorClass: (s.slaAtRisk > 0) ? 'danger' : undefined },
      { label: 'Decided today', value: s.decidedToday, colorClass: 'success' },
      { label: 'Approval rate', value: s.approvalRate.toString() + '%', colorClass: 'success' },
      { label: 'Avg decision time', value: s.avgDecisionHours.toString() + 'h' },
    ];
  });
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<ApprovalQueueRow>[] = [
    {
      headerCheckboxSelection: true, checkboxSelection: true,
      width: 48, maxWidth: 48, minWidth: 48, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'left', headerName: '',
    },
    {
      field: 'priority', headerName: 'Priority', maxWidth: 115, pinned: 'left',
      cellRenderer: (p: ICellRendererParams<ApprovalQueueRow>) => {
        const vm: Record<ApprovalPriority, string> = { Critical:'prio-critical', High:'prio-high', Medium:'prio-medium', Low:'prio-low' };
        return `<span class="prio-badge ${vm[p.value as ApprovalPriority]}">${escHtml(p.value as string)}</span>`;
      },
    },
    {
      field: 'title', headerName: 'Escalation', minWidth: 260, flex: 2,
      cellRenderer: (p: ICellRendererParams<ApprovalQueueRow>) => {
        const r = p.data!;
        return `<div class="rec-cell">
          <span class="rec-name">${escHtml(r.title)}</span>
          <span class="rec-meta">${escHtml(r.originatingAgent)} · ${escHtml(r.businessUnit)} · ${escHtml(r.environment)}</span>
        </div>`;
      },
    },
    {
      field: 'domain', headerName: 'Domain', maxWidth: 140,
      cellRenderer: (p: ICellRendererParams<ApprovalQueueRow>) =>
        `<span class="domain-chip">${escHtml(p.value as string)}</span>`,
    },
    {
      field: 'status', headerName: 'Status', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<ApprovalQueueRow>) => {
        const vm: Record<string, string> = { Pending:'info', In_Review:'warning', Approved:'success', Rejected:'neutral', Deferred:'neutral', Delegated:'neutral', Expired:'danger' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${escHtml((p.value as string).replace('_',' '))}</span>`;
      },
    },
    {
      field: 'slaStatus', headerName: 'SLA', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<ApprovalQueueRow>) => {
        const r = p.data!;
        if (!r.slaRemainingHours) return `<span class="sla-breached">Breached</span>`;
        const cls = r.slaStatus === 'At_Risk' ? 'sla-approaching' : 'sla-ok';
        return `<span class="${cls}">${r.slaRemainingHours}h left</span>`;
      },
    },
    {
      field: 'financialImpact', headerName: 'Monthly impact', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<ApprovalQueueRow>) => {
        const v = p.value as number;
        return v > 0 ? `<span class="savings-cell">${formatCurrency(v, { code: p.data!.currency })}</span>` : `<span class="no-cost">Carbon only</span>`;
      },
    },
    {
      field: 'riskLevel', headerName: 'Risk', maxWidth: 90,
      cellRenderer: (p: ICellRendererParams<ApprovalQueueRow>) => {
        const vm: Record<string, string> = { Low:'risk-low', Medium:'risk-medium', High:'risk-high' };
        return `<span class="risk-badge ${vm[p.value as string] ?? 'risk-low'}">${escHtml(p.value as string)}</span>`;
      },
    },
    {
      field: 'confidenceScore', headerName: 'Conf.', maxWidth: 80, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<ApprovalQueueRow>) => {
        const v = p.value as number;
        const cls = v >= 90 ? 'conf-high' : v >= 75 ? 'conf-mid' : 'conf-low';
        return `<span class="${cls}">${v}%</span>`;
      },
    },
    {
      headerName: '', field: 'escalationId',
      width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="View escalation detail">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
         </button>`,
    },
  ];

  onGridReady(e: GridReadyEvent<ApprovalQueueRow>) { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<ApprovalQueueRow>) {
    if ((e.event?.target as HTMLElement)?.closest('.ag-selection-checkbox')) return;
    if (e.data) this.#router.navigate(['/coordinate/approvals', e.data.escalationId]);
  }
  onSelectionChanged(_e: SelectionChangedEvent) {
    this.selectedIds.set((this.#gridApi?.getSelectedRows() ?? []).map((r: ApprovalQueueRow) => r.escalationId));
  }

  onSearchChange(v: string | null | undefined)   { this.searchText.set(v ?? ''); }
  togglePriorityFilter(p: ApprovalPriority)      { this.priorityFilter.update(c => c.includes(p) ? c.filter(x => x !== p) : [...c, p]); }
  toggleDomainFilter(d: ApprovalDomain)          { this.domainFilter.update(c => c.includes(d) ? c.filter(x => x !== d) : [...c, d]); }
  toggleStatusFilter(s: ApprovalStatus)          { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  clearFilters() { this.searchText.set(''); this.priorityFilter.set([]); this.domainFilter.set([]); this.statusFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'approvals.csv' }); }

  async bulkApprove() {
    const ids = this.selectedIds();
    const alert = await this.#alert.create({
      header: 'Approve recommendations',
      message: `Approve ${ids.length} selected recommendation${ids.length > 1 ? 's' : ''}? They will enter the execution queue.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Approve all', handler: () => {
            this.isSubmitting.set(true);
            this.#svc.bulkApprove(ids).subscribe({
              next: async () => {
                this.isSubmitting.set(false);
                this.selectedIds.set([]);
                const t = await this.#toast.create({ message: `${ids.length} recommendation${ids.length > 1 ? 's' : ''} approved.`, duration: 2500, position: 'top', color: 'success' });
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

  openRejectModal() { this.pendingRejectIds.set(this.selectedIds()); this.rejectForm.reset(); this.isRejectOpen.set(true); }
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
    if (!ctrl?.errors || !ctrl.touched) return null;
    if (ctrl.errors['required'])  return 'A rejection reason is required.';
    if (ctrl.errors['minlength']) return 'Reason must be at least 10 characters.';
    return 'Invalid value.';
  }

  readonly retry = () => { this.loadError.set(null); };
}
