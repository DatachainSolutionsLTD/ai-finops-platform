// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Platform Users — List screen for platform-level user management.
// Location: apps/frontend/src/app/features/platform/users/
//           platform-users.component.ts
//
// Implements the List pattern from 02_Component_Pattern_Library.md §3.2:
//   PageHeader with primary CTA → summary stat row → filter/search toolbar
//   → active filter chips → AG Grid → pagination
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
  IonModal,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
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

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { combineLatest, switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { AuthService }           from '@core/auth/auth.service';
import { PlatformUsersService }  from './platform-users.service';
import {
  type PlatformUserListRow,
  type PlatformUserStatus,
  type PlatformUserRole,
  ROLE_LABELS,
  USER_STATUS_OPTIONS,
  USER_ROLE_OPTIONS,
} from '@shared/types/platform-users.types';

@Component({
  selector: 'app-platform-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonToolbar, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
    IonPopover, IonList, IonItem, IonCheckbox,
    IonModal, IonInput, IonSelect, IonSelectOption, IonSpinner,
    AgGridAngular,
    PageHeaderComponent,
    LoadingStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './platform-users.component.html',
  styleUrl:    './platform-users.component.scss',
})
export class PlatformUsersComponent {
  readonly #usersService = inject(PlatformUsersService);
  readonly #auth         = inject(AuthService);
  readonly #router       = inject(Router);
  readonly #title        = inject(Title);
  readonly #toastCtrl    = inject(ToastController);
  readonly #alertCtrl    = inject(AlertController);
  readonly #fb           = inject(FormBuilder);

  #gridApi?: GridApi<PlatformUserListRow>;

  constructor() {
    this.#title.setTitle('Platform Users · FinOps');
  }

  // ── Filter & pagination state ─────────────────────────────────────────────
  readonly searchText    = signal<string>('');
  readonly statusFilter  = signal<PlatformUserStatus[]>([]);
  readonly roleFilter    = signal<PlatformUserRole[]>([]);
  readonly currentPage   = signal<number>(0);
  readonly loadError     = signal<string | null>(null);
  readonly selectedIds   = signal<string[]>([]);
  readonly isInviteOpen  = signal<boolean>(false);
  readonly isInviting    = signal<boolean>(false);

  // ── Reference lists ───────────────────────────────────────────────────────
  readonly statusOptions = USER_STATUS_OPTIONS;
  readonly roleOptions   = USER_ROLE_OPTIONS;
  readonly roleLabels    = ROLE_LABELS;

  // ── Query signal (drives data fetch) ─────────────────────────────────────
  readonly #query = computed(() => ({
    search:  this.searchText() || undefined,
    status:  this.statusFilter().length ? this.statusFilter() : undefined,
    role:    this.roleFilter().length   ? this.roleFilter()   : undefined,
    page:    this.currentPage(),
    limit:   20,
  }));

  // ── Data signals ──────────────────────────────────────────────────────────
  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#usersService.list(q).pipe(
          startWith(null),
          catchError(err => {
            this.loadError.set(err.title ?? 'Unable to load users');
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  readonly summary = toSignal(
    this.#usersService.summary().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  // ── Derived signals ───────────────────────────────────────────────────────
  readonly isLoading  = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData    = computed(() => this.listResponse() !== null);
  readonly rows       = computed(() => this.listResponse()?.data ?? []);
  readonly total      = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows    = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() =>
    !!this.searchText() || this.statusFilter().length > 0 || this.roleFilter().length > 0);
  readonly hasSelection  = computed(() => this.selectedIds().length > 0);
  readonly selectionCount = computed(() => this.selectedIds().length);

  readonly canInviteUser    = computed(() => this.#auth.hasPermission('user:invite'));
  readonly canSuspendUser   = computed(() => this.#auth.hasPermission('user:suspend'));
  readonly canDeactivateUser = computed(() => this.#auth.hasPermission('user:deactivate'));

  // ── Invite form ───────────────────────────────────────────────────────────
  readonly inviteForm: FormGroup = this.#fb.group({
    email:       ['', [Validators.required, Validators.email]],
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    role:        ['FinOps_Analyst', [Validators.required]],
  });

  readonly inviteFieldError = (path: string): string | null => {
    const ctrl = this.inviteForm.get(path);
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required'])  return 'This field is required.';
    if (ctrl.errors['email'])     return 'Please enter a valid email address.';
    if (ctrl.errors['minlength']) return `Must be at least ${ctrl.errors['minlength'].requiredLength} characters.`;
    if (ctrl.errors['maxlength']) return `Must be at most ${ctrl.errors['maxlength'].requiredLength} characters.`;
    return 'Invalid value.';
  };

  // ── AG Grid config ────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110,
  };

  readonly colDefs: ColDef<PlatformUserListRow>[] = [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 48, maxWidth: 48, minWidth: 48,
      sortable: false, filter: false, resizable: false, flex: 0,
      pinned: 'left', headerName: '',
    },
    {
      field: 'displayName',
      headerName: 'User',
      minWidth: 220,
      flex: 2,
      pinned: 'left',
      cellRenderer: (p: ICellRendererParams<PlatformUserListRow>) => {
        const r = p.data!;
        return `
          <div class="user-cell">
            <span class="user-avatar" aria-hidden="true">${this.#escape(r.avatarInitials)}</span>
            <div class="user-info">
              <span class="user-name">${this.#escape(r.displayName)}</span>
              <span class="user-email">${this.#escape(r.email)}</span>
            </div>
          </div>`;
      },
    },
    {
      field: 'role',
      headerName: 'Role',
      minWidth: 160,
      cellRenderer: (p: ICellRendererParams<PlatformUserListRow>) => {
        const label = ROLE_LABELS[p.value as PlatformUserRole] ?? p.value;
        return `<span class="role-pill role-${(p.value as string).toLowerCase().replace('_', '-')}">${this.#escape(label)}</span>`;
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      maxWidth: 140,
      cellRenderer: (p: ICellRendererParams<PlatformUserListRow>) => {
        const variantMap: Record<string, string> = {
          Active:      'success',
          Invited:     'info',
          Suspended:   'warning',
          Deactivated: 'neutral',
        };
        const variant = variantMap[p.value as string] ?? 'neutral';
        return `<span class="status-badge ${variant}">${this.#escape(p.value as string)}</span>`;
      },
    },
    {
      field: 'mfaStatus',
      headerName: 'MFA',
      maxWidth: 120,
      cellRenderer: (p: ICellRendererParams<PlatformUserListRow>) => {
        const v = p.value as string;
        const icons: Record<string, string> = {
          Enabled:  '✓',
          Enforced: '⊛',
          Disabled: '✗',
        };
        const cls = v === 'Disabled' ? 'mfa-off' : 'mfa-on';
        return `<span class="${cls}" aria-label="MFA ${v}">${icons[v] ?? v} ${v}</span>`;
      },
    },
    {
      field: 'tenantCount',
      headerName: 'Tenants',
      maxWidth: 100,
      type: 'numericColumn',
    },
    {
      field: 'lastLoginAt',
      headerName: 'Last login',
      minWidth: 150,
      valueFormatter: p => this.#relativeTime(p.value as string | null),
    },
    {
      headerName: '',
      field: 'userId',
      width: 60, maxWidth: 60, minWidth: 60,
      sortable: false, filter: false, resizable: false, flex: 0,
      pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="Open user details">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="9 18 15 12 9 6"/>
           </svg>
         </button>`,
    },
  ];

  // ── Grid events ───────────────────────────────────────────────────────────
  onGridReady(evt: GridReadyEvent<PlatformUserListRow>) {
    this.#gridApi = evt.api;
  }

  onRowClicked(evt: RowClickedEvent<PlatformUserListRow>) {
    const target = evt.event?.target as HTMLElement | undefined;
    if (target?.closest('.ag-selection-checkbox')) return;
    if (evt.data) {
      this.#router.navigate(['/platform/users', evt.data.userId]);
    }
  }

  onSelectionChanged(_evt: SelectionChangedEvent<PlatformUserListRow>) {
    const selected = this.#gridApi?.getSelectedRows() ?? [];
    this.selectedIds.set(selected.map(r => r.userId));
  }

  // ── Filter events ─────────────────────────────────────────────────────────
  onSearchChange(value: string | null | undefined) {
    this.searchText.set(value ?? '');
    this.currentPage.set(0);
  }

  toggleStatusFilter(s: PlatformUserStatus) {
    this.statusFilter.update(cur =>
      cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]);
    this.currentPage.set(0);
  }

  toggleRoleFilter(r: PlatformUserRole) {
    this.roleFilter.update(cur =>
      cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r]);
    this.currentPage.set(0);
  }

  clearFilters() {
    this.searchText.set('');
    this.statusFilter.set([]);
    this.roleFilter.set([]);
    this.currentPage.set(0);
  }

  removeStatusChip(s: PlatformUserStatus) { this.toggleStatusFilter(s); }
  removeRoleChip(r: PlatformUserRole)     { this.toggleRoleFilter(r); }

  // ── Actions ───────────────────────────────────────────────────────────────
  exportCsv() {
    this.#gridApi?.exportDataAsCsv({ fileName: 'platform-users.csv' });
  }

  openInviteModal() {
    this.inviteForm.reset({ role: 'FinOps_Analyst' });
    this.isInviteOpen.set(true);
  }

  closeInviteModal() { this.isInviteOpen.set(false); }

  async submitInvite() {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    this.isInviting.set(true);
    this.#usersService.invite(this.inviteForm.value).subscribe({
      next: async () => {
        this.isInviting.set(false);
        this.isInviteOpen.set(false);
        const toast = await this.#toastCtrl.create({
          message: 'Invitation sent successfully.',
          duration: 2500, position: 'top', color: 'success',
        });
        await toast.present();
      },
      error: async (err) => {
        this.isInviting.set(false);
        const toast = await this.#toastCtrl.create({
          message: err.title ?? 'Unable to send invitation. Please try again.',
          duration: 3000, position: 'top', color: 'danger',
        });
        await toast.present();
      },
    });
  }

  async bulkSuspend() {
    const count = this.selectionCount();
    const alert = await this.#alertCtrl.create({
      header: 'Suspend users',
      message: `Suspend ${count} selected user${count > 1 ? 's' : ''}? They will lose platform access until reinstated.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Suspend', role: 'destructive',
          handler: () => {
            // SWAP TO REAL: bulk suspend API call
            this.selectedIds().forEach(id => this.#usersService.suspend(id).subscribe());
            this.selectedIds.set([]);
            this.#showToast('Users suspended.', 'warning');
          },
        },
      ],
    });
    await alert.present();
  }

  async bulkDeactivate() {
    const count = this.selectionCount();
    const alert = await this.#alertCtrl.create({
      header: 'Deactivate users',
      message: `Permanently deactivate ${count} selected user${count > 1 ? 's' : ''}? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Deactivate', role: 'destructive',
          handler: () => {
            this.selectedIds().forEach(id => this.#usersService.deactivate(id).subscribe());
            this.selectedIds.set([]);
            this.#showToast('Users deactivated.', 'danger');
          },
        },
      ],
    });
    await alert.present();
  }

  readonly retry = () => {
    this.loadError.set(null);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  async #showToast(message: string, color: string) {
    const toast = await this.#toastCtrl.create({ message, duration: 2500, position: 'top', color });
    await toast.present();
  }

  #escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  #relativeTime(iso: string | null): string {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
