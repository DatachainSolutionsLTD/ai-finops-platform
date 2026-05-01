// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Platform Settings — Detail/Edit screen.
// Location: apps/frontend/src/app/features/platform/settings/
//           platform-settings.component.ts
// Pattern: Detail/Edit (§3.3): PageHeader → tab nav → form card → sticky footer
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
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';

import {
  IonContent, IonCard, IonCardContent, IonInput, IonTextarea, IonSelect,
  IonSelectOption, IonToggle, IonButton, IonIcon, IonSpinner,
  ToastController, AlertController,
} from '@ionic/angular/standalone';

import { catchError, of } from 'rxjs';

import { PageHeaderComponent }     from '@shared/components/page-header.component';
import { LoadingStateComponent }   from '@shared/components/loading-state.component';
import { EmptyStateComponent }     from '@shared/components/empty-state.component';
import { AuthService }             from '@core/auth/auth.service';
import { PlatformSettingsService } from './platform-settings.service';
import {
  type PlatformSettings,
  type PlatformSettingsPatch,
  type PlatformSettingsTabId,
  DATA_RETENTION_OPTIONS,
  AUTONOMY_CEILING_OPTIONS,
  MAINTENANCE_MODE_OPTIONS,
} from '@shared/types/platform-settings.types';

interface Tab { id: PlatformSettingsTabId; label: string; icon: string; }

@Component({
  selector: 'app-platform-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonCard, IonCardContent, IonInput, IonTextarea, IonSelect,
    IonSelectOption, IonToggle, IonButton, IonIcon, IonSpinner,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './platform-settings.component.html',
  styleUrl:    './platform-settings.component.scss',
})
export class PlatformSettingsComponent {
  readonly #fb         = inject(FormBuilder);
  readonly #svc        = inject(PlatformSettingsService);
  readonly #auth       = inject(AuthService);
  readonly #title      = inject(Title);
  readonly #toastCtrl  = inject(ToastController);
  readonly #alertCtrl  = inject(AlertController);

  constructor() {
    this.#title.setTitle('Platform Settings · FinOps');
    effect(() => {
      const s = this.settings();
      if (s) this.#buildForm(s);
    });
  }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly activeTab       = signal<PlatformSettingsTabId>('general');
  readonly isSaving        = signal<boolean>(false);
  readonly loadError       = signal<string | null>(null);
  readonly formDirtySignal = signal<number>(0);

  readonly dataRetentionOptions  = DATA_RETENTION_OPTIONS;
  readonly autonomyCeilingOptions = AUTONOMY_CEILING_OPTIONS;
  readonly maintenanceModeOptions = MAINTENANCE_MODE_OPTIONS;

  readonly tabs: Tab[] = [
    { id: 'general',       label: 'General',       icon: 'settings-outline' },
    { id: 'agents',        label: 'Agents',         icon: 'cube-outline' },
    { id: 'data',          label: 'Data & Audit',   icon: 'server-outline' },
    { id: 'security',      label: 'Security',       icon: 'shield-outline' },
    { id: 'notifications', label: 'Notifications',  icon: 'notifications-outline' },
    { id: 'maintenance',   label: 'Maintenance',    icon: 'construct-outline' },
  ];

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly settings = toSignal(
    this.#svc.get().pipe(
      catchError(err => { this.loadError.set(err.title ?? 'Unable to load platform settings'); return of(null as PlatformSettings | null); }),
    ),
    { initialValue: null },
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly isLoading = computed(() => this.settings() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.settings() !== null);
  readonly isDirty   = computed(() => { this.formDirtySignal(); return this.form.dirty; });
  readonly isValid   = computed(() => { this.formDirtySignal(); return this.form.valid; });
  readonly canSave   = computed(() => this.isDirty() && this.isValid() && !this.isSaving());
  readonly canEdit   = computed(() => this.#auth.hasPermission('platform:settings:edit'));

  // ── Form ──────────────────────────────────────────────────────────────────
  form: FormGroup = this.#fb.group({});

  #buildForm(s: PlatformSettings) {
    this.form = this.#fb.group({
      // General
      platformName:       [s.platformName,     [Validators.required, Validators.maxLength(100)]],
      platformUrl:        [s.platformUrl,       [Validators.required, this.#urlValidator]],
      supportEmail:       [s.supportEmail,      [Validators.required, Validators.email]],
      maxTenantsAllowed:  [s.maxTenantsAllowed, [Validators.required, Validators.min(1), Validators.max(10000)]],
      // Agents
      globalAutonomyCeiling: [s.globalAutonomyCeiling, Validators.required],
      defaultRetryLimit:     [s.defaultRetryLimit,     [Validators.required, Validators.min(0), Validators.max(10)]],
      defaultRetryBackoffSec:[s.defaultRetryBackoffSec,[Validators.required, Validators.min(30)]],
      // Data
      dataRetentionPeriod:  [s.dataRetentionPeriod,   Validators.required],
      enableAuditLog:       [s.enableAuditLog],
      auditLogRetentionDays:[s.auditLogRetentionDays,  [Validators.required, Validators.min(30), Validators.max(3650)]],
      // Security
      enforceGlobalMfa:    [s.enforceGlobalMfa],
      sessionTimeoutMinutes:[s.sessionTimeoutMinutes,  [Validators.required, Validators.min(5), Validators.max(1440)]],
      maxConcurrentSessionsPerUser:[s.maxConcurrentSessionsPerUser,[Validators.required, Validators.min(1), Validators.max(20)]],
      passwordMinLength:   [s.passwordMinLength,       [Validators.required, Validators.min(8), Validators.max(64)]],
      allowedIpRanges:     [s.allowedIpRanges],
      // Notifications
      alertEmailEnabled:   [s.alertEmailEnabled],
      alertEmailFrom:      [s.alertEmailFrom,    [Validators.email]],
      alertWebhookUrl:     [s.alertWebhookUrl,   [this.#urlValidator]],
      // Maintenance
      maintenanceMode:     [s.maintenanceMode,   Validators.required],
      maintenanceMessage:  [s.maintenanceMessage,[Validators.maxLength(500)]],
    });

    if (!this.canEdit()) this.form.disable();

    this.form.valueChanges.subscribe(() => this.formDirtySignal.update(n => n + 1));
    this.form.statusChanges.subscribe(() => this.formDirtySignal.update(n => n + 1));
  }

  #urlValidator(ctrl: AbstractControl): Record<string, boolean> | null {
    const v = ctrl.value;
    if (!v) return null;
    try { new URL(v); return null; }
    catch { return { url: true }; }
  }

  // ── Tab helpers ───────────────────────────────────────────────────────────
  selectTab(id: PlatformSettingsTabId) { this.activeTab.set(id); }

  tabHasErrors(tab: PlatformSettingsTabId): boolean {
    this.formDirtySignal();
    const map: Record<PlatformSettingsTabId, string[]> = {
      general:       ['platformName', 'platformUrl', 'supportEmail', 'maxTenantsAllowed'],
      agents:        ['globalAutonomyCeiling', 'defaultRetryLimit', 'defaultRetryBackoffSec'],
      data:          ['dataRetentionPeriod', 'enableAuditLog', 'auditLogRetentionDays'],
      security:      ['enforceGlobalMfa', 'sessionTimeoutMinutes', 'maxConcurrentSessionsPerUser', 'passwordMinLength', 'allowedIpRanges'],
      notifications: ['alertEmailEnabled', 'alertEmailFrom', 'alertWebhookUrl'],
      maintenance:   ['maintenanceMode', 'maintenanceMessage'],
    };
    return map[tab].some(name => {
      const ctrl = this.form.get(name);
      return ctrl && ctrl.invalid && ctrl.touched;
    });
  }

  fieldError(path: string): string | null {
    const ctrl = this.form.get(path);
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required'])  return 'This field is required.';
    if (ctrl.errors['email'])     return 'Please enter a valid email address.';
    if (ctrl.errors['url'])       return 'Please enter a valid URL.';
    if (ctrl.errors['minlength']) return `Must be at least ${ctrl.errors['minlength'].requiredLength} characters.`;
    if (ctrl.errors['maxlength']) return `Must be at most ${ctrl.errors['maxlength'].requiredLength} characters.`;
    if (ctrl.errors['min'])       return `Minimum value is ${ctrl.errors['min'].min}.`;
    if (ctrl.errors['max'])       return `Maximum value is ${ctrl.errors['max'].max}.`;
    return 'Invalid value.';
  }

  // ── Save / Cancel ─────────────────────────────────────────────────────────
  async save() {
    if (!this.canSave()) return;
    const s = this.settings();
    if (!s) return;
    this.isSaving.set(true);
    this.#svc.update(this.form.value as PlatformSettingsPatch, s.etag).subscribe({
      next: async () => {
        this.isSaving.set(false);
        this.form.markAsPristine();
        this.formDirtySignal.update(n => n + 1);
        const t = await this.#toastCtrl.create({ message: 'Platform settings saved.', duration: 2500, position: 'top', color: 'success' });
        await t.present();
      },
      error: async err => {
        this.isSaving.set(false);
        if (err.status === 409) {
          const a = await this.#alertCtrl.create({
            header: 'Conflict detected',
            message: 'Platform settings were modified since you loaded them. Reload to get the latest version.',
            buttons: [{ text: 'Keep my changes', role: 'cancel' }, { text: 'Reload', handler: () => location.reload() }],
          });
          await a.present();
          return;
        }
        const t = await this.#toastCtrl.create({ message: err.title ?? 'Unable to save settings.', duration: 3000, position: 'top', color: 'danger' });
        await t.present();
      },
    });
  }

  async cancel() {
    if (!this.isDirty()) return;
    const alert = await this.#alertCtrl.create({
      header: 'Discard unsaved changes?',
      message: 'Your changes will be lost.',
      buttons: [
        { text: 'Keep editing', role: 'cancel' },
        { text: 'Discard', role: 'destructive', handler: () => {
            const s = this.settings();
            if (s) this.#buildForm(s);
          }},
      ],
    });
    await alert.present();
  }

  readonly retry = () => { this.loadError.set(null); location.reload(); };
}
