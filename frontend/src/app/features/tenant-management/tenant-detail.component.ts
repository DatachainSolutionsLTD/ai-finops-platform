// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Tenant Detail — Detail/Edit screen for a single tenant record.
// Location: apps/frontend/src/app/features/platform/tenants/
//           tenant-detail.component.ts
//
// Pattern: Detail/Edit (§3.3):
//   PageHeader with meta chips → tab nav with error dots → form card
//   → identity read-only block → sticky action footer
// Mirrors organization.component.ts: same tab/form/ETag/dirty-footer patterns.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ActivatedRoute,
  Router,
  CanDeactivateFn,
} from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';

import {
  IonContent, IonCard, IonCardContent,
  IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonToggle, IonButton, IonIcon, IonSpinner, IonChip, IonLabel,
  ToastController, AlertController,
} from '@ionic/angular/standalone';

import { map, switchMap, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { AuthService }           from '@core/auth/auth.service';
import { TenantDetailService }   from './tenant-detail.service';
import { formatCurrency }        from '@lib/chart-defaults';
import {
  type TenantDetail,
  type TenantDetailPatch,
  type TenantDetailTabId,
  TENANT_STATUS_OPTIONS,
  TENANT_TIER_OPTIONS,
  BILLING_STATUS_OPTIONS,
  DATA_RESIDENCY_OPTIONS,
  AUTONOMY_OPTIONS,
  SENSITIVITY_OPTIONS,
  RETENTION_OPTIONS,
} from '@shared/types/tenant-detail.types';

interface Tab { id: TenantDetailTabId; label: string; icon: string; }

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, DatePipe,
    IonContent, IonCard, IonCardContent,
    IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonToggle, IonButton, IonIcon, IonSpinner, IonChip, IonLabel,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './tenant-detail.component.html',
  styleUrl:    './tenant-detail.component.scss',
})
export class TenantDetailComponent {
  readonly #fb         = inject(FormBuilder);
  readonly #svc        = inject(TenantDetailService);
  readonly #auth       = inject(AuthService);
  readonly #route      = inject(ActivatedRoute);
  readonly #router     = inject(Router);
  readonly #title      = inject(Title);
  readonly #toastCtrl  = inject(ToastController);
  readonly #alertCtrl  = inject(AlertController);

  constructor() {
    this.#title.setTitle('Tenant Detail · FinOps');
    effect(() => {
      const t = this.tenant();
      if (t) {
        this.#title.setTitle(`${t.displayName} · FinOps`);
        this.#buildForm(t);
      }
    });
  }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly activeTab       = signal<TenantDetailTabId>('overview');
  readonly isSaving        = signal<boolean>(false);
  readonly loadError       = signal<string | null>(null);
  readonly formDirtySignal = signal<number>(0);

  readonly statusOptions         = TENANT_STATUS_OPTIONS;
  readonly tierOptions           = TENANT_TIER_OPTIONS;
  readonly billingStatusOptions  = BILLING_STATUS_OPTIONS;
  readonly dataResidencyOptions  = DATA_RESIDENCY_OPTIONS;
  readonly autonomyOptions       = AUTONOMY_OPTIONS;
  readonly sensitivityOptions    = SENSITIVITY_OPTIONS;
  readonly retentionOptions      = RETENTION_OPTIONS;

  readonly tabs: Tab[] = [
    { id: 'overview', label: 'Overview',  icon: 'grid-outline' },
    { id: 'contact',  label: 'Contact',   icon: 'mail-outline' },
    { id: 'quotas',   label: 'Quotas',    icon: 'speedometer-outline' },
    { id: 'platform', label: 'Platform',  icon: 'settings-outline' },
  ];

  // ── Data: load tenant from route param ────────────────────────────────────
  readonly #tenantId$ = this.#route.params.pipe(map(p => p['id'] as string));

  readonly tenant = toSignal(
    this.#tenantId$.pipe(
      switchMap(id =>
        this.#svc.get(id).pipe(
          catchError(err => {
            this.loadError.set(err.title ?? 'Unable to load tenant');
            return of(null as TenantDetail | null);
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly isLoading  = computed(() => this.tenant() === null && this.loadError() === null);
  readonly hasData    = computed(() => this.tenant() !== null);
  readonly isDirty    = computed(() => { this.formDirtySignal(); return this.form.dirty; });
  readonly isValid    = computed(() => { this.formDirtySignal(); return this.form.valid; });
  readonly canSave    = computed(() => this.isDirty() && this.isValid() && !this.isSaving());
  readonly canEdit    = computed(() => this.#auth.hasPermission('tenant:edit'));
  readonly canSuspend = computed(() => this.#auth.hasPermission('tenant:suspend'));

  readonly metaChips = computed(() => {
    const t = this.tenant();
    if (!t) return [];
    return [
      { label: t.tierCode,      variant: 'tier'    },
      { label: t.status,        variant: 'status'  },
      { label: t.billingStatus.replace('_', ' '), variant: 'billing' },
    ];
  });

  readonly spendDisplay = computed(() => {
    const t = this.tenant();
    if (!t) return '';
    return formatCurrency(t.spendThisMonth.amount, { code: t.spendThisMonth.currency });
  });

  // ── Form ──────────────────────────────────────────────────────────────────
  form: FormGroup = this.#fb.group({});

  #buildForm(t: TenantDetail) {
    this.form = this.#fb.group({
      // Overview
      displayName:            [t.displayName,          [Validators.required, Validators.maxLength(100)]],
      legalName:              [t.legalName,            [Validators.required, Validators.maxLength(200)]],
      industry:               [t.industry,             [Validators.maxLength(100)]],
      status:                 [t.status,               Validators.required],
      tierCode:               [t.tierCode,             Validators.required],
      billingStatus:          [t.billingStatus,        Validators.required],
      primaryCurrencyCode:    [t.primaryCurrencyCode,  [Validators.required, Validators.maxLength(3)]],
      dataResidencyRegion:    [t.dataResidencyRegion,  Validators.required],
      subscriptionRenewsAt:   [t.subscriptionRenewsAt ? t.subscriptionRenewsAt.substring(0, 10) : null],
      // Contact
      billingContactEmail:    [t.billingContactEmail,    [Validators.required, Validators.email]],
      billingContactPhone:    [t.billingContactPhone,    [Validators.maxLength(30)]],
      technicalContactEmail:  [t.technicalContactEmail,  [Validators.required, Validators.email]],
      technicalContactPhone:  [t.technicalContactPhone,  [Validators.maxLength(30)]],
      // Quotas
      maxUsers:               [t.maxUsers,           [Validators.required, Validators.min(1)]],
      maxConnectors:          [t.maxConnectors,      [Validators.required, Validators.min(1)]],
      storageQuotaGb:         [t.storageQuotaGb,     [Validators.required, Validators.min(1)]],
      fpQuotaMonthly:         [t.fpQuotaMonthly,     [Validators.required, Validators.min(1)]],
      // Platform
      agentAutonomyCeiling:      [t.agentAutonomyCeiling,      Validators.required],
      anomalyAlertSensitivity:   [t.anomalyAlertSensitivity,   Validators.required],
      autoRemediationEnabled:    [t.autoRemediationEnabled],
      dataRetentionPeriod:       [t.dataRetentionPeriod,       Validators.required],
    });

    if (!this.canEdit()) this.form.disable();
    this.form.valueChanges.subscribe(() => this.formDirtySignal.update(n => n + 1));
    this.form.statusChanges.subscribe(() => this.formDirtySignal.update(n => n + 1));
  }

  // ── Tab helpers ───────────────────────────────────────────────────────────
  selectTab(id: TenantDetailTabId) { this.activeTab.set(id); }

  tabHasErrors(tab: TenantDetailTabId): boolean {
    this.formDirtySignal();
    const map: Record<TenantDetailTabId, string[]> = {
      overview: ['displayName','legalName','industry','status','tierCode','billingStatus','primaryCurrencyCode','dataResidencyRegion'],
      contact:  ['billingContactEmail','billingContactPhone','technicalContactEmail','technicalContactPhone'],
      quotas:   ['maxUsers','maxConnectors','storageQuotaGb','fpQuotaMonthly'],
      platform: ['agentAutonomyCeiling','anomalyAlertSensitivity','dataRetentionPeriod'],
    };
    return map[tab].some(n => {
      const c = this.form.get(n);
      return c && c.invalid && c.touched;
    });
  }

  fieldError(path: string): string | null {
    const ctrl = this.form.get(path);
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required'])  return 'This field is required.';
    if (ctrl.errors['email'])     return 'Please enter a valid email address.';
    if (ctrl.errors['maxlength']) return `Must be at most ${ctrl.errors['maxlength'].requiredLength} characters.`;
    if (ctrl.errors['min'])       return `Minimum value is ${ctrl.errors['min'].min}.`;
    return 'Invalid value.';
  }

  // ── Save / Cancel ─────────────────────────────────────────────────────────
  async save() {
    if (!this.canSave()) return;
    const t = this.tenant();
    if (!t) return;
    this.isSaving.set(true);
    this.#svc.update(t.tenantId, this.form.value as TenantDetailPatch, t.etag).subscribe({
      next: async () => {
        this.isSaving.set(false);
        this.form.markAsPristine();
        this.formDirtySignal.update(n => n + 1);
        const toast = await this.#toastCtrl.create({ message: 'Tenant updated.', duration: 2500, position: 'top', color: 'success' });
        await toast.present();
      },
      error: async err => {
        this.isSaving.set(false);
        if (err.status === 409) {
          const a = await this.#alertCtrl.create({
            header: 'Conflict detected',
            message: 'This tenant was modified since you loaded it. Reload to see the latest data.',
            buttons: [
              { text: 'Keep my changes', role: 'cancel' },
              { text: 'Reload', handler: () => location.reload() },
            ],
          });
          await a.present();
          return;
        }
        const toast = await this.#toastCtrl.create({ message: err.title ?? 'Unable to save tenant.', duration: 3000, position: 'top', color: 'danger' });
        await toast.present();
      },
    });
  }

  async cancel() {
    if (!this.isDirty()) { this.#router.navigate(['/platform/tenants']); return; }
    const alert = await this.#alertCtrl.create({
      header: 'Discard unsaved changes?',
      message: 'Your changes will be lost.',
      buttons: [
        { text: 'Keep editing', role: 'cancel' },
        { text: 'Discard', role: 'destructive', handler: () => {
            const t = this.tenant();
            if (t) this.#buildForm(t);
            this.#router.navigate(['/platform/tenants']);
          }},
      ],
    });
    await alert.present();
  }

  async suspendTenant() {
    const t = this.tenant();
    if (!t) return;
    const alert = await this.#alertCtrl.create({
      header: 'Suspend tenant',
      message: `Suspend ${t.displayName}? All users will lose platform access until reinstated.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Suspend', role: 'destructive', handler: () => {
            this.#svc.suspend(t.tenantId).subscribe({
              next: async () => {
                const toast = await this.#toastCtrl.create({ message: 'Tenant suspended.', duration: 2500, position: 'top', color: 'warning' });
                await toast.present();
              },
            });
          }},
      ],
    });
    await alert.present();
  }

  readonly retry = () => { this.loadError.set(null); location.reload(); };
}

// ── CanDeactivate guard (register on the route) ───────────────────────────
export const tenantDetailUnsavedGuard: CanDeactivateFn<TenantDetailComponent> =
  (component) => {
    if (!component.isDirty()) return true;
    return component['#alertCtrl'] // guard handled inline via cancel() flow
      ? true
      : confirm('You have unsaved changes. Leave anyway?');
  };
