// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Agent Configuration — List + Detail Drawer screen.
// Location: apps/frontend/src/app/features/platform/agents/
//           agent-config.component.ts
//
// Pattern: List (§3.2) + inline detail drawer for agent config editing.
// Drawer opens when a row is clicked, loads AgentDetail, edits config JSON
// and operational parameters via Reactive Form.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonCardTitle,
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
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonSpinner,
  IonBadge,
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
} from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { AuthService }           from '@core/auth/auth.service';
import { AgentConfigService }    from './agent-config.service';
import {
  type AgentListRow,
  type AgentStatus,
  type AgentCategory,
  type AgentDetail,
  AGENT_STATUS_OPTIONS,
  AGENT_CATEGORY_OPTIONS,
  AUTONOMY_LEVEL_LABELS,
} from '@shared/types/agent-config.types';

@Component({
  selector: 'app-agent-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
    IonPopover, IonList, IonItem, IonCheckbox,
    IonModal, IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle,
    IonSpinner, IonBadge,
    AgGridAngular,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './agent-config.component.html',
  styleUrl:    './agent-config.component.scss',
})
export class AgentConfigComponent {
  readonly #svc       = inject(AgentConfigService);
  readonly #auth      = inject(AuthService);
  readonly #title     = inject(Title);
  readonly #toastCtrl = inject(ToastController);
  readonly #alertCtrl = inject(AlertController);
  readonly #fb        = inject(FormBuilder);

  #gridApi?: GridApi<AgentListRow>;

  constructor() {
    this.#title.setTitle('Agent Configuration · FinOps');
    effect(() => {
      const detail = this.selectedDetail();
      if (detail) this.#buildDrawerForm(detail);
    });
  }

  // ── List state ────────────────────────────────────────────────────────────
  readonly searchText     = signal<string>('');
  readonly statusFilter   = signal<AgentStatus[]>([]);
  readonly categoryFilter = signal<AgentCategory[]>([]);
  readonly loadError      = signal<string | null>(null);
  readonly statusOptions  = AGENT_STATUS_OPTIONS;
  readonly categoryOptions = AGENT_CATEGORY_OPTIONS;
  readonly autonomyLabels  = AUTONOMY_LEVEL_LABELS;

  // ── Drawer state ──────────────────────────────────────────────────────────
  readonly isDrawerOpen       = signal<boolean>(false);
  readonly selectedAgentId    = signal<string | null>(null);
  readonly drawerLoadError    = signal<string | null>(null);
  readonly isSaving           = signal<boolean>(false);
  readonly formDirtySignal    = signal<number>(0);

  // ── Query → data ──────────────────────────────────────────────────────────
  readonly #query = computed(() => ({
    search:   this.searchText() || undefined,
    status:   this.statusFilter().length   ? this.statusFilter()   : undefined,
    category: this.categoryFilter().length ? this.categoryFilter() : undefined,
    page: 0, limit: 50,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load agents'); return of(null); }),
        ),
      ),
    ),
    { initialValue: null },
  );

  readonly summary = toSignal(
    this.#svc.summary().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  readonly selectedDetail = toSignal(
    toObservable(this.selectedAgentId).pipe(
      switchMap(id => id
        ? this.#svc.getDetail(id).pipe(
            startWith(null),
            catchError(err => { this.drawerLoadError.set(err.title ?? 'Unable to load agent detail'); return of(null); }),
          )
        : of(null),
      ),
    ),
    { initialValue: null as AgentDetail | null },
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly isLoading  = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData    = computed(() => this.listResponse() !== null);
  readonly rows       = computed(() => this.listResponse()?.data ?? []);
  readonly hasRows    = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() =>
    !!this.searchText() || this.statusFilter().length > 0 || this.categoryFilter().length > 0);
  readonly isDrawerLoading  = computed(() => this.selectedAgentId() !== null && this.selectedDetail() === null && this.drawerLoadError() === null);
  readonly drawerIsDirty    = computed(() => { this.formDirtySignal(); return this.drawerForm.dirty; });
  readonly drawerIsValid    = computed(() => { this.formDirtySignal(); return this.drawerForm.valid; });
  readonly canSave          = computed(() => this.drawerIsDirty() && this.drawerIsValid() && !this.isSaving());
  readonly canConfigAgent   = computed(() => this.#auth.hasPermission('agent:configure'));

  // ── Drawer form ───────────────────────────────────────────────────────────
  drawerForm: FormGroup = this.#fb.group({});

  #buildDrawerForm(d: AgentDetail) {
    this.drawerForm = this.#fb.group({
      enabled:            [d.enabled],
      autonomyLevel:      [d.autonomyLevel, Validators.required],
      scheduleExpression: [d.scheduleExpression],
      maxConcurrentJobs:  [d.maxConcurrentJobs, [Validators.required, Validators.min(1), Validators.max(20)]],
      retryLimit:         [d.retryLimit,         [Validators.required, Validators.min(0), Validators.max(10)]],
      retryBackoffSec:    [d.retryBackoffSec,    [Validators.required, Validators.min(30)]],
      configJson:         [d.configJson],
    });
    if (!this.canConfigAgent()) this.drawerForm.disable();
    this.drawerForm.valueChanges.subscribe(() => this.formDirtySignal.update(n => n + 1));
    this.drawerForm.statusChanges.subscribe(() => this.formDirtySignal.update(n => n + 1));
  }

  readonly drawerFieldError = (path: string): string | null => {
    const ctrl = this.drawerForm.get(path);
    if (!ctrl || !ctrl.errors || !ctrl.touched) return null;
    if (ctrl.errors['required']) return 'This field is required.';
    if (ctrl.errors['min'])      return `Must be at least ${ctrl.errors['min'].min}.`;
    if (ctrl.errors['max'])      return `Must be at most ${ctrl.errors['max'].max}.`;
    return 'Invalid value.';
  };

  // ── AG Grid ───────────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110,
  };

  readonly colDefs: ColDef<AgentListRow>[] = [
    {
      field: 'displayName',
      headerName: 'Agent',
      minWidth: 260, flex: 2,
      pinned: 'left',
      cellRenderer: (p: ICellRendererParams<AgentListRow>) => {
        const r = p.data!;
        return `<div class="agent-cell">
          <span class="agent-code">${this.#escape(r.agentCode)}</span>
          <span class="agent-name">${this.#escape(r.displayName)}</span>
        </div>`;
      },
    },
    {
      field: 'category',
      headerName: 'Category',
      maxWidth: 150,
      cellRenderer: (p: ICellRendererParams<AgentListRow>) =>
        `<span class="category-pill cat-${(p.value as string).toLowerCase()}">${this.#escape(p.value as string)}</span>`,
    },
    {
      field: 'status',
      headerName: 'Status',
      maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<AgentListRow>) => {
        const vm: Record<string, string> = {
          Running: 'success', Idle: 'neutral', Degraded: 'warning', Disabled: 'neutral', Error: 'danger',
        };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(p.value as string)}</span>`;
      },
    },
    { field: 'autonomyLevel', headerName: 'Autonomy', maxWidth: 100 },
    { field: 'version',       headerName: 'Version',  maxWidth: 100 },
    {
      field: 'pendingJobCount',
      headerName: 'Pending',
      maxWidth: 100, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AgentListRow>) => {
        const n = p.value as number;
        return n > 0
          ? `<span class="pending-pill">${n}</span>`
          : `<span class="pending-zero">0</span>`;
      },
    },
    {
      field: 'errorCount24h',
      headerName: 'Errors (24h)',
      maxWidth: 120, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AgentListRow>) => {
        const n = p.value as number;
        return n > 0
          ? `<span class="error-pill" aria-label="${n} errors in last 24 hours">${n}</span>`
          : `<span class="error-zero">—</span>`;
      },
    },
    {
      field: 'lastRunAt',
      headerName: 'Last run',
      minWidth: 130,
      valueFormatter: p => this.#relativeTime(p.value as string | null),
    },
    {
      field: 'enabled',
      headerName: 'Enabled',
      maxWidth: 90, sortable: false, filter: false,
      cellRenderer: (p: ICellRendererParams<AgentListRow>) =>
        p.value ? `<span class="mfa-on">✓</span>` : `<span class="mfa-off">✗</span>`,
    },
    {
      headerName: '',
      field: 'agentId',
      width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0,
      pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="Open agent configuration">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="9 18 15 12 9 6"/>
           </svg>
         </button>`,
    },
  ];

  onGridReady(evt: GridReadyEvent<AgentListRow>) { this.#gridApi = evt.api; }

  onRowClicked(evt: RowClickedEvent<AgentListRow>) {
    if (!evt.data) return;
    this.drawerLoadError.set(null);
    this.selectedAgentId.set(evt.data.agentId);
    this.isDrawerOpen.set(true);
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  onSearchChange(v: string | null | undefined) { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: AgentStatus)           { this.statusFilter.update(cur => cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]); }
  toggleCategoryFilter(c: AgentCategory)       { this.categoryFilter.update(cur => cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]); }
  clearFilters()                               { this.searchText.set(''); this.statusFilter.set([]); this.categoryFilter.set([]); }

  exportCsv() { this.#gridApi?.exportDataAsCsv({ fileName: 'agent-config.csv' }); }

  // ── Drawer actions ────────────────────────────────────────────────────────
  closeDrawer() {
    this.isDrawerOpen.set(false);
    this.selectedAgentId.set(null);
    this.drawerLoadError.set(null);
  }

  async triggerRun() {
    const id = this.selectedAgentId();
    if (!id) return;
    const alert = await this.#alertCtrl.create({
      header: 'Trigger manual run',
      message: 'Manually trigger an immediate run of this agent?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Run now', handler: () => {
            this.#svc.triggerRun(id).subscribe({
              next: () => this.#toast('Agent run triggered.', 'success'),
              error: err => this.#toast(err.title ?? 'Failed to trigger run.', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async saveDrawer() {
    if (!this.canSave()) return;
    const detail = this.selectedDetail();
    if (!detail) return;
    this.isSaving.set(true);
    this.#svc.patch(detail.agentId, this.drawerForm.value, detail.etag).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.drawerForm.markAsPristine();
        this.formDirtySignal.update(n => n + 1);
        this.#toast('Agent configuration saved.', 'success');
      },
      error: async err => {
        this.isSaving.set(false);
        if (err.status === 409) {
          const a = await this.#alertCtrl.create({
            header: 'Conflict detected',
            message: 'This agent was modified since you opened it. Reload to see the latest settings.',
            buttons: [{ text: 'Keep my changes', role: 'cancel' }, { text: 'Reload', handler: () => this.selectedAgentId.set(this.selectedAgentId()) }],
          });
          await a.present();
          return;
        }
        this.#toast(err.title ?? 'Unable to save configuration.', 'danger');
      },
    });
  }

  readonly retry       = () => { this.loadError.set(null); };
  readonly retryDrawer = () => { this.drawerLoadError.set(null); this.selectedAgentId.set(this.selectedAgentId()); };

  // ── Helpers ───────────────────────────────────────────────────────────────
  async #toast(message: string, color: string) {
    const t = await this.#toastCtrl.create({ message, duration: 2500, position: 'top', color });
    await t.present();
  }

  #escape(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  #relativeTime(iso: string | null): string {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
}
