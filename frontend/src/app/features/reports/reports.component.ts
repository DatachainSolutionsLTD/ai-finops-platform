// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Reports — List screen.
// Location: apps/frontend/src/app/features/understand/reports/
//           reports.component.ts
// Pattern: List (§3.2): summary row → filter toolbar → AG Grid with
// download action, generate button, status badge, format pill.
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
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
  IonPopover, IonList, IonItem, IonCheckbox,
  ToastController,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef, GridApi, GridReadyEvent, ICellRendererParams,
} from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { AuthService }           from '@core/auth/auth.service';
import { ReportsService }        from './reports.service';
import {
  type ReportListRow,
  type ReportStatus,
  type ReportCategory,
  REPORT_STATUS_OPTIONS,
  REPORT_CATEGORY_OPTIONS,
} from '@shared/types/understand-lists.types';

@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
    IonPopover, IonList, IonItem, IonCheckbox,
    AgGridAngular,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './reports.component.html',
  styleUrl:    './reports.component.scss',
})
export class ReportsComponent {
  readonly #svc       = inject(ReportsService);
  readonly #auth      = inject(AuthService);
  readonly #title     = inject(Title);
  readonly #toastCtrl = inject(ToastController);
  #gridApi?: GridApi<ReportListRow>;

  constructor() { this.#title.setTitle('Reports · FinOps'); }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly searchText      = signal<string>('');
  readonly statusFilter    = signal<ReportStatus[]>([]);
  readonly categoryFilter  = signal<ReportCategory[]>([]);
  readonly loadError       = signal<string | null>(null);

  readonly statusOptions   = REPORT_STATUS_OPTIONS;
  readonly categoryOptions = REPORT_CATEGORY_OPTIONS;

  // ── Query → data ──────────────────────────────────────────────────────────
  readonly #query = computed(() => ({
    search:   this.searchText()      || undefined,
    status:   this.statusFilter().length   ? this.statusFilter()   : undefined,
    category: this.categoryFilter().length ? this.categoryFilter() : undefined,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load reports'); return of(null); }),
        ),
      ),
    ),
    { initialValue: null },
  );

  readonly summary = toSignal(
    this.#svc.summary().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() =>
    !!this.searchText() || this.statusFilter().length > 0 || this.categoryFilter().length > 0);
  readonly canGenerate = computed(() => this.#auth.hasPermission('report:generate'));

  // ── AG Grid ───────────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<ReportListRow>[] = [
    {
      field: 'name', headerName: 'Report', minWidth: 240, flex: 2,
      cellRenderer: (p: ICellRendererParams<ReportListRow>) => {
        const r = p.data!;
        return `<div class="report-cell">
          <span class="report-name">${this.#escape(r.name)}</span>
          <span class="report-desc">${this.#escape(r.description)}</span>
        </div>`;
      },
    },
    {
      field: 'category', headerName: 'Category', maxWidth: 140,
      cellRenderer: (p: ICellRendererParams<ReportListRow>) =>
        `<span class="cat-pill cat-${(p.value as string).toLowerCase()}">${this.#escape(p.value as string)}</span>`,
    },
    {
      field: 'status', headerName: 'Status', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<ReportListRow>) => {
        const vm: Record<string, string> = { Ready:'success', Generating:'info', Scheduled:'info', Failed:'danger', Expired:'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#escape(p.value as string)}</span>`;
      },
    },
    {
      field: 'format', headerName: 'Format', maxWidth: 90,
      cellRenderer: (p: ICellRendererParams<ReportListRow>) =>
        `<span class="format-pill">${this.#escape(p.value as string)}</span>`,
    },
    { field: 'billingPeriod', headerName: 'Period', maxWidth: 110 },
    {
      field: 'fileSize', headerName: 'Size', maxWidth: 100,
      valueFormatter: p => (p.value as string | null) ?? '—',
    },
    {
      field: 'generatedAt', headerName: 'Generated', minWidth: 140,
      valueFormatter: p => p.value ? new Date(p.value as string).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) : '—',
    },
    {
      headerName: '', field: 'reportId',
      width: 120, maxWidth: 120, minWidth: 120, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right',
      cellRenderer: (p: ICellRendererParams<ReportListRow>) => {
        const r = p.data!;
        if (r.downloadUrl && r.status === 'Ready') {
          return `<button class="download-btn" data-url="${this.#escape(r.downloadUrl)}" aria-label="Download ${this.#escape(r.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>`;
        }
        return `<span class="no-download">—</span>`;
      },
    },
  ];

  onGridReady(e: GridReadyEvent<ReportListRow>) { this.#gridApi = e.api; }

  onGridClick(event: Event) {
    const btn = (event.target as HTMLElement).closest('.download-btn') as HTMLElement | null;
    if (!btn) return;
    const url = btn.dataset['url'];
    if (url) window.open(url, '_blank', 'noopener');
  }

  onSearchChange(v: string | null | undefined) { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: ReportStatus)     { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  toggleCategoryFilter(c: ReportCategory) { this.categoryFilter.update(cur => cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]); }
  clearFilters() { this.searchText.set(''); this.statusFilter.set([]); this.categoryFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'reports.csv' }); }

  async generateReport() {
    this.#svc.generate({ type: 'cost', period: 'current' }).subscribe({
      next: async () => {
        const t = await this.#toastCtrl.create({ message: 'Report generation queued.', duration: 2500, position: 'top', color: 'success' });
        await t.present();
      },
    });
  }

  readonly retry = () => { this.loadError.set(null); };
  #escape(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}
