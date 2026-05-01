// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Tenant Management — the reference exemplar for the List pattern.
// Location: apps/frontend/src/app/features/platform/tenants/
//           tenant-list.component.ts
//
// Implements the List / Grid pattern from 02_Component_Pattern_Library.md §3.2:
//   PageHeader with primary CTA → Filter/Search toolbar → AG Grid → Pagination
// Extends it with a summary stat row (which many List screens benefit from).
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
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonCardTitle,
  IonToolbar,
  IonSearchbar,
  IonButton,
  IonIcon,
  IonChip,
  IonLabel,
  IonPopover,
  IonList,
  IonItem,
  IonCheckbox,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowClickedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';

import { combineLatest, switchMap, startWith, catchError, of } from 'rxjs';

// Platform component library
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { StatusBadgeComponent } from '@shared/components/status-badge.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';

// Shared helpers
import { formatAmount, formatCurrency, formatPercent } from '@shared/charts/chart-defaults';

// Auth
import { AuthService } from '@core/auth/auth.service';

// Feature local
import { TenantManagementService } from './tenant-management.service';
import type {
  TenantListRow,
  TenantListFilters,
  TenantListQuery,
  TenantListSummary,
  TenantStatus,
  TenantTierCode,
  TenantBulkAction,
} from '@shared/types/tenant-management.types';

@Component({
  selector: 'app-tenant-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonCardTitle,
    IonToolbar,
    IonSearchbar,
    IonButton,
    IonIcon,
    IonChip,
    IonLabel,
    IonPopover,
    IonList,
    IonItem,
    IonCheckbox,
    AgGridAngular,
    PageHeaderComponent,
    StatusBadgeComponent,
    LoadingStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './tenant-list.component.html',
  styleUrl: './tenant-list.component.scss',
})
export class TenantListComponent {
  readonly #tenantService = inject(TenantManagementService);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #title = inject(Title);
  readonly #toastCtrl = inject(ToastController);
  readonly #alertCtrl = inject(AlertController);

  constructor() {
    this.#title.setTitle('Tenant Management · FinOps');
  }

  // ── Local state ──────────────────────────────────────────────────────────
  readonly searchText = signal<string>('');
  readonly statusFilter = signal<TenantStatus[]>([]);
  readonly tierFilter = signal<TenantTierCode[]>([]);
  readonly regionFilter = signal<string[]>([]);
  readonly currentPage = signal<number>(0);
  readonly pageSize = signal<number>(20);
  readonly selectedIds = signal<string[]>([]);
  readonly loadError = signal<string | null>(null);

  #gridApi: GridApi<TenantListRow> | null = null;

  // ── Available filter values ──────────────────────────────────────────────
  readonly statusOptions: TenantStatus[] = ['Active','Onboarding','Suspended','Degraded','Offboarding','Archived'];
  readonly tierOptions: TenantTierCode[] = ['STARTER','PROFESSIONAL','ENTERPRISE'];
  readonly regionOptions = ['UAE','Saudi Arabia','Europe','North America','Asia Pacific','Global'];

  // ── Combined query derived from filter signals ───────────────────────────
  readonly query = computed<TenantListQuery>(() => ({
    limit: this.pageSize(),
    offset: this.currentPage() * this.pageSize(),
    filters: {
      status: this.statusFilter().length ? this.statusFilter() : undefined,
      tierCode: this.tierFilter().length ? this.tierFilter() : undefined,
      region: this.regionFilter().length ? this.regionFilter() : undefined,
      search: this.searchText() || undefined,
    },
  }));

  // ── Data signals ─────────────────────────────────────────────────────────
  readonly listResponse = toSignal(
    toObservable(this.query).pipe(
      switchMap(q =>
        this.#tenantService.list(q).pipe(
          startWith(null),
          catchError(err => {
            this.loadError.set(err.title ?? 'Unable to load tenants');
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  readonly summary = toSignal(
    this.#tenantService.summary().pipe(catchError(() => of(null))),
    { initialValue: null as TenantListSummary | null },
  );

  // ── Derived signals ──────────────────────────────────────────────────────
  readonly isLoading = computed(() =>
    this.listResponse() === null && this.loadError() === null);
  readonly hasData = computed(() => this.listResponse() !== null);
  readonly rows = computed(() => this.listResponse()?.data ?? []);
  readonly total = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() =>
    !!this.searchText() ||
    this.statusFilter().length > 0 ||
    this.tierFilter().length > 0 ||
    this.regionFilter().length > 0,
  );
  readonly hasSelection = computed(() => this.selectedIds().length > 0);
  readonly selectionCount = computed(() => this.selectedIds().length);

  readonly canCreateTenant = computed(() => this.#auth.hasPermission('tenant:create'));
  readonly canBulkSuspend  = computed(() => this.#auth.hasPermission('tenant:suspend'));
  readonly canBulkArchive  = computed(() => this.#auth.hasPermission('tenant:archive'));

  // ── AG Grid config ───────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true,
    flex: 1, minWidth: 110,
  };

  readonly colDefs: ColDef<TenantListRow>[] = [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 48, maxWidth: 48, minWidth: 48,
      sortable: false, filter: false, resizable: false, flex: 0,
      pinned: 'left',
      headerName: '',
    },
    {
      field: 'displayName',
      headerName: 'Tenant',
      minWidth: 220,
      flex: 2,
      pinned: 'left',
      cellRenderer: (p: ICellRendererParams<TenantListRow>) => {
        const r = p.data!;
        return `<div class="tenant-cell">
          <div class="tenant-name">${this.#escape(r.displayName)}</div>
          <div class="tenant-meta">${this.#escape(r.tenantCode)} · ${this.#escape(r.region)}</div>
        </div>`;
      },
    },
    {
      field: 'tierName',
      headerName: 'Tier',
      maxWidth: 140,
      cellRenderer: (p: ICellRendererParams<TenantListRow>) =>
        `<span class="tier-pill tier-${p.data!.tierCode.toLowerCase()}">${this.#escape(p.value)}</span>`,
    },
    {
      field: 'status',
      headerName: 'Status',
      maxWidth: 140,
      cellRenderer: StatusBadgeComponent,
      cellRendererParams: (p: ICellRendererParams<TenantListRow>) => ({
        label: p.data!.status,
        variant: this.#statusToVariant(p.data!.status),
      }),
    },
    {
      field: 'userCount',
      headerName: 'Users',
      type: 'numericColumn',
      maxWidth: 100,
      valueFormatter: p => formatAmount(p.value),
    },
    {
      field: 'fpQuotaPercent',
      headerName: 'Quota used',
      type: 'numericColumn',
      minWidth: 160,
      cellRenderer: (p: ICellRendererParams<TenantListRow>) => {
        const pct = p.value as number;
        const tier = pct >= 85 ? 'danger' : pct >= 70 ? 'warning' : 'normal';
        return `<div class="quota-cell">
          <div class="quota-bar">
            <div class="quota-fill quota-${tier}" style="width:${Math.min(pct, 100)}%"></div>
          </div>
          <div class="quota-text">${pct}%</div>
        </div>`;
      },
    },
    {
      field: 'spendThisMonth',
      headerName: 'Spend (this month)',
      type: 'numericColumn',
      minWidth: 170,
      valueGetter: p => Number(p.data?.spendThisMonth.amount ?? 0),
      valueFormatter: p => {
        const row = p.data as TenantListRow | undefined;
        return row
          ? formatCurrency(Number(row.spendThisMonth.amount), { code: row.spendThisMonth.currency })
          : '';
      },
    },
    {
      field: 'criticalAlerts',
      headerName: 'Critical',
      type: 'numericColumn',
      maxWidth: 110,
      cellRenderer: (p: ICellRendererParams<TenantListRow>) => {
        const n = p.value as number;
        return n > 0
          ? `<span class="critical-pill" aria-label="${n} critical alerts">${n}</span>`
          : `<span class="critical-zero" aria-label="no critical alerts">0</span>`;
      },
    },
    {
      field: 'billingStatus',
      headerName: 'Billing',
      maxWidth: 140,
      cellRenderer: (p: ICellRendererParams<TenantListRow>) => {
        const variantMap: Record<string, string> = {
          Current: 'success', Trial: 'info', Grace_Period: 'warning',
          Overdue: 'danger', Pre_Paid: 'success',
        };
        const variant = variantMap[p.value] ?? 'neutral';
        const label = (p.value as string).replace('_', ' ');
        return `<span class="status-badge ${variant}">${this.#escape(label)}</span>`;
      },
    },
    {
      field: 'lastActivityAt',
      headerName: 'Last activity',
      minWidth: 150,
      valueFormatter: p => this.#relativeTime(p.value as string),
    },
    {
      field: 'subscriptionRenewsAt',
      headerName: 'Renews in',
      minWidth: 140,
      valueFormatter: p => this.#daysUntil(p.value as string | null),
    },
    {
      headerName: '',
      field: 'tenantId',
      width: 60, maxWidth: 60, minWidth: 60,
      sortable: false, filter: false, resizable: false, flex: 0,
      pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="Open tenant details">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="9 18 15 12 9 6"/>
           </svg>
         </button>`,
    },
  ];

  // ── Event handlers ───────────────────────────────────────────────────────
  onGridReady(evt: GridReadyEvent<TenantListRow>) {
    this.#gridApi = evt.api;
  }

  onRowClicked(evt: RowClickedEvent<TenantListRow>) {
    // Ignore clicks on the checkbox column to avoid navigation during selection
    const target = evt.event?.target as HTMLElement | undefined;
    if (target?.closest('.ag-selection-checkbox')) return;
    if (evt.data) {
      this.#router.navigate(['/platform/tenants', evt.data.tenantId]);
    }
  }

  onSelectionChanged(_evt: SelectionChangedEvent<TenantListRow>) {
    const selected = this.#gridApi?.getSelectedRows() ?? [];
    this.selectedIds.set(selected.map(r => r.tenantId));
  }

  onSearchChange(value: string | null | undefined) {
    this.searchText.set(value ?? '');
    this.currentPage.set(0);
  }

  toggleStatusFilter(status: TenantStatus) {
    this.statusFilter.update(cur =>
      cur.includes(status) ? cur.filter(s => s !== status) : [...cur, status]);
    this.currentPage.set(0);
  }

  toggleTierFilter(tier: TenantTierCode) {
    this.tierFilter.update(cur =>
      cur.includes(tier) ? cur.filter(t => t !== tier) : [...cur, tier]);
    this.currentPage.set(0);
  }

  toggleRegionFilter(region: string) {
    this.regionFilter.update(cur =>
      cur.includes(region) ? cur.filter(r => r !== region) : [...cur, region]);
    this.currentPage.set(0);
  }

  clearAllFilters() {
    this.searchText.set('');
    this.statusFilter.set([]);
    this.tierFilter.set([]);
    this.regionFilter.set([]);
    this.currentPage.set(0);
  }

  async createTenant() {
    this.#router.navigate(['/onboarding/new']);
  }

  async runBulkAction(action: TenantBulkAction) {
    const ids = this.selectedIds();
    if (ids.length === 0) return;

    // Destructive actions require confirmation per Pattern Library §7 bans (no nested modals) —
    // IonAlert is not a nested modal, it's a native dialog so this pattern is compliant.
    if (action === 'Suspend' || action === 'Archive') {
      const alert = await this.#alertCtrl.create({
        header: `${action} ${ids.length} tenant${ids.length === 1 ? '' : 's'}?`,
        message: action === 'Suspend'
          ? 'Suspended tenants cannot access the platform but their data is retained.'
          : 'Archived tenants are removed from operations. This is reversible for 30 days.',
        inputs: action === 'Suspend'
          ? [{ name: 'reason', type: 'textarea', placeholder: 'Reason for suspension (required)' }]
          : undefined,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: action,
            role: 'destructive',
            handler: (data?: { reason?: string }) => {
              if (action === 'Suspend' && !data?.reason?.trim()) return false;
              this.#executeBulkAction(action, ids, data?.reason);
              return true;
            },
          },
        ],
      });
      await alert.present();
      return;
    }

    this.#executeBulkAction(action, ids);
  }

  exportCsv() {
    this.#gridApi?.exportDataAsCsv({
      fileName: `platform-tenants-${new Date().toISOString().slice(0, 10)}.csv`,
      columnKeys: this.colDefs
        .filter(c => c.field && c.field !== 'tenantId')
        .map(c => c.field as string),
    });
  }

  retry = () => {
    this.loadError.set(null);
    this.currentPage.set(this.currentPage());
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  #executeBulkAction(action: TenantBulkAction, ids: string[], reason?: string) {
    this.#tenantService.bulkAction({ tenantIds: ids, action, reason }).subscribe({
      next: async (affected) => {
        const toast = await this.#toastCtrl.create({
          message: `${action} applied to ${affected} tenant${affected === 1 ? '' : 's'}.`,
          duration: 3000, position: 'top', color: 'success',
        });
        await toast.present();
        this.#gridApi?.deselectAll();
        this.selectedIds.set([]);
        this.currentPage.set(this.currentPage()); // refetch
      },
      error: async () => {
        const toast = await this.#toastCtrl.create({
          message: `Unable to ${action.toLowerCase()} selected tenants.`,
          duration: 3000, position: 'top', color: 'danger',
        });
        await toast.present();
      },
    });
  }

  #statusToVariant(status: TenantStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (status) {
      case 'Active':       return 'success';
      case 'Degraded':     return 'warning';
      case 'Suspended':    return 'danger';
      case 'Onboarding':   return 'info';
      case 'Offboarding':  return 'neutral';
      case 'Archived':     return 'neutral';
      default:             return 'neutral';
    }
  }

  #relativeTime(iso: string): string {
    if (!iso) return '\u2014';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  #daysUntil(iso: string | null): string {
    if (!iso) return '\u2014';
    const diffMs = new Date(iso).getTime() - Date.now();
    const days = Math.floor(diffMs / 86_400_000);
    if (days < 0)  return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  }

  #escape(s: string): string {
    return s.replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }
}
