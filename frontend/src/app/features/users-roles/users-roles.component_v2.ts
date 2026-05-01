// FinOps Platform Design System v1.1 — Updated v2
// escHtml() → @lib/utils/html.utils | relativeTime() → @lib/utils/date.utils
// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Users & Roles — List screen. Tenant Admin scope.
// Pattern: List — summary row → 2-filter toolbar → AG Grid → Invite modal
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, IonModal, IonSelect, IonSelectOption, IonInput, IonSpinner, ToastController } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { escHtml } from '@lib/utils/html.utils';
import type { SummaryStat } from '@shared/components/summary-stat-row.component';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { GridShellCardComponent } from '@shared/components/grid-shell-card-component.component';
import { SummaryStatRowComponent } from '@shared/components/summary-stat-row-component.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { UsersRolesService } from './tenant-admin.services';
import { type TenantUserRow, type TenantUserRole, type TenantUserStatus, TENANT_USER_ROLE_OPTIONS, TENANT_USER_STATUS_OPTIONS } from '@shared/types/tenant-admin.types';

@Component({
  selector: 'app-users-roles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, IonModal, IonSelect, IonSelectOption, IonInput, IonSpinner, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent SummaryStatRowComponent, GridShellCardComponent,],
  templateUrl: './users-roles.component.html',
  styleUrl:    './users-roles.component.scss',
})
export class UsersRolesComponent {
  readonly #svc    = inject(UsersRolesService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  readonly #toast  = inject(ToastController);
  readonly #fb     = inject(FormBuilder);
  #gridApi?: GridApi<TenantUserRow>;
  constructor() { this.#title.setTitle('Users & Roles · FinOps'); }

  readonly searchText    = signal('');
  readonly roleFilter    = signal<TenantUserRole[]>([]);
  readonly statusFilter  = signal<TenantUserStatus[]>([]);
  readonly loadError     = signal<string | null>(null);
  readonly isInviteOpen  = signal(false);
  readonly isSubmitting  = signal(false);
  readonly roleOptions   = TENANT_USER_ROLE_OPTIONS;
  readonly statusOptions = TENANT_USER_STATUS_OPTIONS;

  readonly inviteForm: FormGroup = this.#fb.group({
    email: ['', [Validators.required, Validators.email]],
    role:  ['FinOps_Analyst', Validators.required],
  });

  readonly #query = computed(() => ({ search: this.searchText() || undefined, role: this.roleFilter().length ? this.roleFilter() : undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load users'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.roleFilter().length > 0 || this.statusFilter().length > 0);


  readonly summaryStats = computed<SummaryStat[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Total users', value: s.total },
      { label: 'Active', value: s.active, colorClass: 'success' },
      { label: 'Invited', value: s.invited, colorClass: 'info' },
      { label: 'Suspended', value: s.suspended, colorClass: (s.suspended > 0) ? 'warning' : undefined },
      { label: 'MFA enabled', value: s.mfaEnabled, colorClass: (s.mfaEnabled >= s.active) ? 'success' : undefined },
    ];
  });
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<TenantUserRow>[] = [
    { field: 'fullName', headerName: 'User', minWidth: 200, flex: 2, cellRenderer: (p: ICellRendererParams<TenantUserRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${escHtml(r.fullName)}</span><span class="rec-meta">${escHtml(r.email)}</span></div>`; } },
    { field: 'role', headerName: 'Role', maxWidth: 170, cellRenderer: (p: ICellRendererParams<TenantUserRow>) => { const vm: Record<string,string> = { Tenant_Admin:'role-admin', FinOps_Analyst:'role-analyst', Finance:'role-finance', Engineering:'role-eng', Executive_Viewer:'role-exec', Auditor:'role-audit', Read_Only:'role-read' }; return `<span class="role-badge ${vm[p.value as string] ?? 'role-read'}">${escHtml((p.value as string).replace('_',' '))}</span>`; } },
    { field: 'status', headerName: 'Status', maxWidth: 120, cellRenderer: (p: ICellRendererParams<TenantUserRow>) => { const vm: Record<string,string> = { Active:'success', Invited:'info', Suspended:'warning', Deactivated:'neutral' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${escHtml(p.value as string)}</span>`; } },
    { field: 'mfaStatus', headerName: 'MFA', maxWidth: 90, cellRenderer: (p: ICellRendererParams<TenantUserRow>) => { const vm: Record<string,string> = { Enabled:'mfa-ok', Enforced:'mfa-ok', Disabled:'mfa-off' }; return `<span class="${vm[p.value as string] ?? 'mfa-off'}">${escHtml(p.value as string)}</span>`; } },
    { field: 'businessUnit', headerName: 'Business unit', maxWidth: 160, valueFormatter: p => (p.value as string | null) ?? '—' },
    { field: 'lastLoginAt', headerName: 'Last login', minWidth: 130, valueFormatter: p => { if (!p.value) return 'Never'; const d = new Date(p.value as string); return relativeTime(p.value as string); } },
    { headerName: '', field: 'userId', width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right', cellRenderer: () => `<button class="row-action-btn" aria-label="Manage user"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<TenantUserRow>) { this.#gridApi = e.api; }
  onSearchChange(v: string | null | undefined)  { this.searchText.set(v ?? ''); }
  toggleRoleFilter(r: TenantUserRole)           { this.roleFilter.update(c => c.includes(r) ? c.filter(x => x !== r) : [...c, r]); }
  toggleStatusFilter(s: TenantUserStatus)       { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  clearFilters() { this.searchText.set(''); this.roleFilter.set([]); this.statusFilter.set([]); }
  exportCsv()    { this.#gridApi?.exportDataAsCsv({ fileName: 'users.csv' }); }
  openInvite()   { this.inviteForm.reset({ role: 'FinOps_Analyst' }); this.isInviteOpen.set(true); }
  closeInvite()  { this.isInviteOpen.set(false); }

  async submitInvite() {
    if (this.inviteForm.invalid) { this.inviteForm.markAllAsTouched(); return; }
    this.isSubmitting.set(true);
    const { email, role } = this.inviteForm.value as { email: string; role: string };
    this.#svc.invite(email, role).subscribe({
      next: async () => {
        this.isSubmitting.set(false); this.isInviteOpen.set(false);
        const t = await this.#toast.create({ message: `Invitation sent to ${email}.`, duration: 2500, position: 'top', color: 'success' }); await t.present();
      },
      error: async () => {
        this.isSubmitting.set(false);
        const t = await this.#toast.create({ message: 'Unable to send invitation. Please try again.', duration: 3000, position: 'top', color: 'danger' }); await t.present();
      },
    });
  }

  fieldError(name: string): string | null {
    const ctrl = this.inviteForm.get(name);
    if (!ctrl?.errors || !ctrl.touched) return null;
    if (ctrl.errors['required']) return 'This field is required.';
    if (ctrl.errors['email'])    return 'Enter a valid email address.';
    return 'Invalid value.';
  }

  readonly retry = () => { this.loadError.set(null); };
}
