// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Tenant Onboarding Wizard — the reference exemplar for the Wizard pattern.
// Location: apps/frontend/src/app/features/onboarding/onboarding-wizard.component.ts
//
// Implements the Wizard pattern from 02_Component_Pattern_Library.md §3.4:
//   PageHeader → WizardStepper → active step body → navigation footer
// With: per-step validation, draft auto-save, summary review, async provisioning.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { Router, CanDeactivateFn } from '@angular/router';
import { Title } from '@angular/platform-browser';

import {
  IonContent,
  IonCard,
  IonCardContent,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonButton,
  IonIcon,
  IonSpinner,
  IonCheckbox,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';

import { catchError, of, debounceTime, distinctUntilChanged, switchMap, Subject, takeUntil } from 'rxjs';

import { PageHeaderComponent } from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';

import { OnboardingService } from './onboarding.service';
import {
  ONBOARDING_STEPS,
  type OnboardingStepId,
  type OnboardingStep,
  type OnboardingDraft,
  type TenantCodeAvailability,
  type IntegrationProvider,
} from '@shared/types/onboarding.types';
import { INDUSTRY_OPTIONS } from '@shared/types/organization.types';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonCard,
    IonCardContent,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonButton,
    IonIcon,
    IonSpinner,
    IonCheckbox,
    PageHeaderComponent,
    LoadingStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './onboarding-wizard.component.html',
  styleUrl: './onboarding-wizard.component.scss',
})
export class OnboardingWizardComponent {
  readonly #fb = inject(FormBuilder);
  readonly #onboarding = inject(OnboardingService);
  readonly #router = inject(Router);
  readonly #title = inject(Title);
  readonly #toastCtrl = inject(ToastController);
  readonly #alertCtrl = inject(AlertController);

  #destroy$ = new Subject<void>();

  constructor() {
    this.#title.setTitle('Tenant Onboarding · FinOps');
    // When draft loads, hydrate form and set current step
    effect(() => {
      const draft = this.draft();
      if (draft) this.#hydrateFromDraft(draft);
    });
  }

  // ── Wizard metadata ──────────────────────────────────────────────────────
  readonly steps: OnboardingStep[] = ONBOARDING_STEPS;
  readonly integrationCatalog: { code: IntegrationProvider; name: string; category: string; icon: string }[] = [
    { code: 'AWS',        name: 'Amazon Web Services', category: 'Cloud',           icon: 'cloud-outline' },
    { code: 'Azure',      name: 'Microsoft Azure',     category: 'Cloud',           icon: 'cloud-outline' },
    { code: 'GCP',        name: 'Google Cloud',        category: 'Cloud',           icon: 'cloud-outline' },
    { code: 'OCI',        name: 'Oracle Cloud',        category: 'Cloud',           icon: 'cloud-outline' },
    { code: 'Snowflake',  name: 'Snowflake',           category: 'Data',            icon: 'server-outline' },
    { code: 'Databricks', name: 'Databricks',          category: 'Data',            icon: 'server-outline' },
    { code: 'Salesforce', name: 'Salesforce',          category: 'SaaS',            icon: 'briefcase-outline' },
    { code: 'ServiceNow', name: 'ServiceNow',          category: 'SaaS',            icon: 'briefcase-outline' },
    { code: 'Slack',      name: 'Slack',               category: 'Notifications',   icon: 'chatbubble-outline' },
    { code: 'Teams',      name: 'Microsoft Teams',     category: 'Notifications',   icon: 'chatbubble-outline' },
    { code: 'Jira',       name: 'Atlassian Jira',      category: 'ITSM',            icon: 'construct-outline' },
    { code: 'PagerDuty',  name: 'PagerDuty',           category: 'ITSM',            icon: 'alert-circle-outline' },
  ];
  readonly industryOptions = INDUSTRY_OPTIONS;

  // ── State ────────────────────────────────────────────────────────────────
  readonly currentStepId = signal<OnboardingStepId>('organization');
  readonly completedSteps = signal<OnboardingStepId[]>([]);
  readonly codeCheck = signal<TenantCodeAvailability | null>(null);
  readonly isSaving = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly formDirtySignal = signal<number>(0);
  readonly loadError = signal<string | null>(null);

  // ── Data signals ─────────────────────────────────────────────────────────
  readonly draft = toSignal(
    this.#onboarding.getOrCreateDraft().pipe(
      catchError(err => {
        this.loadError.set(err.title ?? 'Unable to load onboarding draft');
        return of(null as OnboardingDraft | null);
      }),
    ),
    { initialValue: null },
  );

  // ── Forms (one per step, composed into parent) ───────────────────────────
  readonly form: FormGroup = this.#fb.group({
    organization:  this.#fb.group({
      legalName:    ['', [Validators.required, Validators.maxLength(200)]],
      displayName:  ['', [Validators.required, Validators.maxLength(100)]],
      tenantCode:   ['', [Validators.required, Validators.pattern(/^[A-Z0-9][A-Z0-9-]{2,29}$/)]],
      tierCode:     ['PROFESSIONAL', [Validators.required]],
      industry:     [null],
      websiteUrl:   ['', [this.#urlValidator]],
      taxId:        [''],
    }),
    localization: this.#fb.group({
      primaryCurrencyCode: ['AED', [Validators.required]],
      primaryLocale:       ['en-AE', [Validators.required]],
      primaryTimezone:     ['Asia/Dubai', [Validators.required]],
      dateFormat:          ['DMY', [Validators.required]],
      fiscalYearStart:     ['January', [Validators.required]],
    }),
    residency: this.#fb.group({
      dataResidencyRegion: ['UAE', [Validators.required]],
      gdprApplicable:  [false],
      pdplApplicable:  [true],
      hipaaApplicable: [false],
      soxApplicable:   [false],
    }),
    primaryAdmin: this.#fb.group({
      email:           ['', [Validators.required, Validators.email]],
      displayName:     ['', [Validators.required, Validators.maxLength(100)]],
      phone:           [''],
      sendInviteEmail: [true],
      requireMfa:      [true],
    }),
    integrations: this.#fb.group({
      selectedProviders: [[] as IntegrationProvider[]],
      skipForNow:        [false],
    }),
    agentDefaults: this.#fb.group({
      agentAutonomyCeiling:    ['L3_Act_With_Notify', [Validators.required]],
      defaultApprovalSla:      [24, [Validators.required, Validators.min(1), Validators.max(168)]],
      anomalyAlertSensitivity: ['Medium', [Validators.required]],
      autoRemediationEnabled:  [true],
    }),
  });

  // ── Derived signals ──────────────────────────────────────────────────────
  readonly isLoading = computed(() => this.draft() === null && this.loadError() === null);

  readonly currentStep = computed(() =>
    this.steps.find(s => s.id === this.currentStepId())!);

  readonly currentStepIndex = computed(() =>
    this.steps.findIndex(s => s.id === this.currentStepId()));

  readonly isFirstStep = computed(() => this.currentStepIndex() === 0);
  readonly isLastStep = computed(() => this.currentStepIndex() === this.steps.length - 1);

  readonly currentStepGroup = computed<FormGroup>(() => {
    this.formDirtySignal(); // subscribe
    const map: Record<OnboardingStepId, string> = {
      'organization':   'organization',
      'localization':   'localization',
      'residency':      'residency',
      'primary-admin':  'primaryAdmin',
      'integrations':   'integrations',
      'agent-defaults': 'agentDefaults',
      'review':         '',
    };
    const key = map[this.currentStepId()];
    return key ? this.form.get(key) as FormGroup : this.form;
  });

  readonly currentStepValid = computed(() => {
    this.formDirtySignal();
    const stepId = this.currentStepId();
    if (stepId === 'review') return true;
    if (stepId === 'organization') {
      const group = this.currentStepGroup();
      const check = this.codeCheck();
      return group.valid && (check === null || check.available);
    }
    return this.currentStepGroup().valid;
  });

  readonly canProceed = computed(() => this.currentStepValid() && !this.isSaving());
  readonly canGoBack = computed(() => !this.isFirstStep() && !this.isSubmitting());

  readonly overallProgress = computed(() => {
    const total = this.steps.length;
    const done = this.completedSteps().length;
    return Math.round((done / total) * 100);
  });

  stepStatus(stepId: OnboardingStepId): 'complete' | 'active' | 'upcoming' {
    if (this.completedSteps().includes(stepId)) return 'complete';
    if (this.currentStepId() === stepId) return 'active';
    return 'upcoming';
  }

  // ── Form wiring ──────────────────────────────────────────────────────────
  ngOnInit() {
    this.form.valueChanges.pipe(takeUntil(this.#destroy$))
      .subscribe(() => this.formDirtySignal.update(n => n + 1));
    this.form.statusChanges.pipe(takeUntil(this.#destroy$))
      .subscribe(() => this.formDirtySignal.update(n => n + 1));

    // Debounced tenant code availability check
    const codeCtrl = this.form.get('organization.tenantCode')!;
    codeCtrl.valueChanges.pipe(
      takeUntil(this.#destroy$),
      debounceTime(450),
      distinctUntilChanged(),
      switchMap((code: string) =>
        code && code.length >= 3 && codeCtrl.valid
          ? this.#onboarding.checkTenantCodeAvailability(code)
          : of(null),
      ),
    ).subscribe(result => this.codeCheck.set(result));
  }

  ngOnDestroy() {
    this.#destroy$.next();
    this.#destroy$.complete();
  }

  #hydrateFromDraft(draft: OnboardingDraft) {
    if (draft.organization)  this.form.get('organization')!.patchValue(draft.organization);
    if (draft.localization)  this.form.get('localization')!.patchValue(draft.localization);
    if (draft.residency)     this.form.get('residency')!.patchValue(draft.residency);
    if (draft.primaryAdmin)  this.form.get('primaryAdmin')!.patchValue(draft.primaryAdmin);
    if (draft.integrations)  this.form.get('integrations')!.patchValue(draft.integrations);
    if (draft.agentDefaults) this.form.get('agentDefaults')!.patchValue(draft.agentDefaults);
    this.currentStepId.set(draft.currentStep);
    this.completedSteps.set(draft.completedSteps);
  }

  #urlValidator(ctrl: AbstractControl) {
    if (!ctrl.value) return null;
    try { new URL(ctrl.value); return null; }
    catch { return { url: true }; }
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  async goNext() {
    if (!this.canProceed()) {
      this.#markCurrentGroupTouched();
      return;
    }
    const current = this.currentStepId();
    // Mark current step complete
    this.completedSteps.update(list => list.includes(current) ? list : [...list, current]);

    const nextIdx = this.currentStepIndex() + 1;
    if (nextIdx < this.steps.length) {
      const nextId = this.steps[nextIdx].id;
      await this.#saveDraft(nextId);
      this.currentStepId.set(nextId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async goBack() {
    if (!this.canGoBack()) return;
    const prevIdx = this.currentStepIndex() - 1;
    if (prevIdx >= 0) {
      this.currentStepId.set(this.steps[prevIdx].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async jumpToStep(stepId: OnboardingStepId) {
    // Can only jump to completed steps or the current step's immediate neighbors
    if (this.completedSteps().includes(stepId) || stepId === this.currentStepId()) {
      this.currentStepId.set(stepId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async saveAndExit() {
    await this.#saveDraft(this.currentStepId());
    const toast = await this.#toastCtrl.create({
      message: 'Draft saved. You can resume onboarding later.',
      duration: 3000, position: 'top', color: 'success',
    });
    await toast.present();
    this.#router.navigate(['/platform/tenants']);
  }

  async cancel() {
    const alert = await this.#alertCtrl.create({
      header: 'Cancel onboarding?',
      message: 'Your draft will be discarded. This action cannot be undone.',
      buttons: [
        { text: 'Keep editing', role: 'cancel' },
        {
          text: 'Discard draft',
          role: 'destructive',
          handler: async () => {
            const d = this.draft();
            if (d) await this.#onboarding.discardDraft(d.draftId).toPromise();
            this.#router.navigate(['/platform/tenants']);
          },
        },
      ],
    });
    await alert.present();
  }

  async submit() {
    if (this.isSubmitting()) return;
    const d = this.draft();
    if (!d) return;

    this.isSubmitting.set(true);
    const finalDraft: OnboardingDraft = {
      ...d,
      ...this.form.value,
      currentStep: 'review',
      completedSteps: this.steps.map(s => s.id),
      updatedAt: new Date().toISOString(),
    };

    this.#onboarding.submit(finalDraft).subscribe({
      next: async (response) => {
        this.isSubmitting.set(false);
        const toast = await this.#toastCtrl.create({
          message: `Tenant ${response.tenantCode} is being provisioned (~${response.estimatedCompletionSeconds}s).`,
          duration: 4000, position: 'top', color: 'success',
        });
        await toast.present();
        this.#router.navigate(['/platform/tenants', response.tenantId]);
      },
      error: async (err) => {
        this.isSubmitting.set(false);
        const toast = await this.#toastCtrl.create({
          message: err.title ?? 'Unable to provision tenant. Please try again.',
          duration: 4000, position: 'top', color: 'danger',
        });
        await toast.present();
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  async #saveDraft(advanceTo: OnboardingStepId) {
    this.isSaving.set(true);
    const d = this.draft();
    if (!d) { this.isSaving.set(false); return; }
    const updated: OnboardingDraft = {
      ...d,
      ...this.form.value,
      currentStep: advanceTo,
      completedSteps: this.completedSteps(),
    };
    try {
      await this.#onboarding.saveDraft(updated).toPromise();
    } finally {
      this.isSaving.set(false);
    }
  }

  #markCurrentGroupTouched() {
    const group = this.currentStepGroup();
    Object.values(group.controls).forEach(c => c.markAsTouched());
    this.formDirtySignal.update(n => n + 1);
  }

  toggleIntegration(code: IntegrationProvider) {
    const ctrl = this.form.get('integrations.selectedProviders')!;
    const current = (ctrl.value ?? []) as IntegrationProvider[];
    ctrl.setValue(current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code]);
  }

  isIntegrationSelected(code: IntegrationProvider): boolean {
    const selected = (this.form.get('integrations.selectedProviders')!.value ?? []) as IntegrationProvider[];
    return selected.includes(code);
  }

  retry = () => {
    this.loadError.set(null);
    location.reload();
  };

  fieldError(path: string): string | null {
    const ctrl = this.form.get(path);
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required'])  return 'This field is required.';
    if (ctrl.errors['email'])     return 'Please enter a valid email address.';
    if (ctrl.errors['url'])       return 'Please enter a valid URL.';
    if (ctrl.errors['pattern'])   return 'Use uppercase letters, digits, and hyphens only (3-30 characters).';
    if (ctrl.errors['maxlength']) return `Must be at most ${ctrl.errors['maxlength'].requiredLength} characters.`;
    if (ctrl.errors['min'])       return `Must be at least ${ctrl.errors['min'].min}.`;
    if (ctrl.errors['max'])       return `Must be at most ${ctrl.errors['max'].max}.`;
    return 'Invalid value.';
  }

  // Summary helpers (for Review step)
  getSummaryValue(path: string): string {
    const v = this.form.get(path)?.value;
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Enabled' : 'Disabled';
    if (Array.isArray(v)) return v.length === 0 ? 'None selected' : v.join(', ');
    return String(v);
  }
}

// ── Unsaved changes guard ────────────────────────────────────────────────────
export const onboardingUnsavedGuard: CanDeactivateFn<OnboardingWizardComponent> =
  async (component) => {
    // Submitting or already at review with no dirty fields - allow
    if (component['isSubmitting']()) return true;
    if (!component['form'].dirty) return true;
    // Otherwise show confirm dialog (not implemented here — wire to AlertController)
    return confirm('You have unsaved changes. Leave without saving?');
  };
