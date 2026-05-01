// FinOps Platform Design System v1.1 — Notifications — Detail/Edit screen.
// Pattern: Detail/Edit (§3.3): PageHeader → Tab Nav → Form Card → Sticky Action Footer
// Tabs: Global | Channels | Quiet Hours
import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { CanDeactivate } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  IonContent, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonButton, IonIcon, IonToggle, IonSelect, IonSelectOption,
  IonInput, IonCheckbox, IonItem, IonLabel, IonSpinner,
  ToastController, AlertController,
} from '@ionic/angular/standalone';

import { startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { NotificationsService }  from './tenant-admin.services';
import {
  type NotificationSettings, type NotificationChannelConfig,
  type NotificationChannel, type NotificationEventType,
} from '@shared/types/tenant-admin.types';

type TabId = 'global' | 'channels' | 'quiet';
const ALL_EVENTS: NotificationEventType[] = [
  'Budget_Alert_Warning','Budget_Alert_Critical','Budget_Breach',
  'Anomaly_Detected','Anomaly_Confirmed',
  'Governance_Violation','Governance_SLA_Breach',
  'Approval_Required','Approval_Reminder',
  'Agent_Degraded','Agent_Failed',
  'Chargeback_Ready','Chargeback_Disputed',
  'Tag_Compliance_Alert','Renewal_Alert',
];

@Component({
  selector: 'app-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonButton, IonIcon, IonToggle, IonSelect, IonSelectOption,
    IonInput, IonCheckbox, IonItem, IonLabel, IonSpinner,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './notifications.component.html',
  styleUrl:    './notifications.component.scss',
})
export class NotificationsComponent {
  readonly #svc   = inject(NotificationsService);
  readonly #title = inject(Title);
  readonly #toast = inject(ToastController);
  readonly #alert = inject(AlertController);
  readonly #fb    = inject(FormBuilder);

  constructor() { this.#title.setTitle('Notification Settings · FinOps'); }

  readonly activeTab   = signal<TabId>('global');
  readonly loadError   = signal<string | null>(null);
  readonly isSaving    = signal(false);
  readonly isDirty     = signal(false);
  readonly allEvents   = ALL_EVENTS;

  // ── Load settings ─────────────────────────────────────────────────────────
  readonly settings = toSignal(
    this.#svc.get().pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load notification settings'); return of(null); })),
    { initialValue: null as NotificationSettings | null },
  );

  readonly isLoading = computed(() => this.settings() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.settings() !== null);

  // ── Local editable state ─────────────────────────────────────────────────
  // We keep a mutable signal copy so we can dirty-track without full RF form
  readonly editSettings = signal<NotificationSettings | null>(null);

  // Initialise once settings load
  readonly #initEffect = computed(() => {
    const s = this.settings();
    if (s && !this.editSettings()) { this.editSettings.set(JSON.parse(JSON.stringify(s))); }
    return null;
  });

  readonly formData = computed(() => this.#initEffect() === null ? this.editSettings() : null);
  readonly globalEnabled = computed(() => this.editSettings()?.globalEnabled ?? false);
  readonly quietEnabled  = computed(() => this.editSettings()?.quietHoursEnabled ?? false);
  readonly channels      = computed(() => this.editSettings()?.channels ?? []);

  setActiveTab(id: TabId) { this.activeTab.set(id); }

  toggleGlobal(val: boolean) {
    this.editSettings.update(s => s ? { ...s, globalEnabled: val } : s);
    this.isDirty.set(true);
  }
  toggleQuiet(val: boolean) {
    this.editSettings.update(s => s ? { ...s, quietHoursEnabled: val } : s);
    this.isDirty.set(true);
  }
  setQuietField(field: 'quietHoursStart'|'quietHoursEnd', val: string) {
    this.editSettings.update(s => s ? { ...s, [field]: val } : s);
    this.isDirty.set(true);
  }
  toggleChannelEnabled(channelId: string, val: boolean) {
    this.editSettings.update(s => { if (!s) return s; return { ...s, channels: s.channels.map(c => c.channelId === channelId ? { ...c, isEnabled: val } : c) }; });
    this.isDirty.set(true);
  }
  setChannelDestination(channelId: string, val: string) {
    this.editSettings.update(s => { if (!s) return s; return { ...s, channels: s.channels.map(c => c.channelId === channelId ? { ...c, destination: val } : c) }; });
    this.isDirty.set(true);
  }
  toggleChannelEvent(channelId: string, event: NotificationEventType) {
    this.editSettings.update(s => {
      if (!s) return s;
      return { ...s, channels: s.channels.map(c => { if (c.channelId !== channelId) return c; const events = c.events.includes(event) ? c.events.filter(e => e !== event) : [...c.events, event]; return { ...c, events }; }) };
    });
    this.isDirty.set(true);
  }

  async save() {
    const data = this.editSettings();
    if (!data) return;
    this.isSaving.set(true);
    this.#svc.save(data).subscribe({
      next: async (saved) => {
        this.isSaving.set(false); this.isDirty.set(false); this.editSettings.set(saved);
        const t = await this.#toast.create({ message: 'Notification settings saved.', duration: 2500, position: 'top', color: 'success' }); await t.present();
      },
      error: async () => {
        this.isSaving.set(false);
        const t = await this.#toast.create({ message: 'Unable to save settings. Please try again.', duration: 3000, position: 'top', color: 'danger' }); await t.present();
      },
    });
  }

  async cancel() {
    if (!this.isDirty()) return;
    const alert = await this.#alert.create({
      header: 'Discard changes?', message: 'You have unsaved changes. Are you sure you want to discard them?',
      buttons: [{ text:'Keep editing', role:'cancel' }, { text:'Discard', handler: () => { const original = this.settings(); this.editSettings.set(original ? JSON.parse(JSON.stringify(original)) : null); this.isDirty.set(false); } }],
    });
    await alert.present();
  }

  eventLabel(e: NotificationEventType): string { return e.replace(/_/g,' '); }
  channelHasEvent(c: NotificationChannelConfig, e: NotificationEventType): boolean { return c.events.includes(e); }

  readonly retry = () => { this.loadError.set(null); };
}
