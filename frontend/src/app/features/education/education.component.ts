// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Education & Training — List screen. Agent A25.
// Location: apps/frontend/src/app/features/manage/education/
//           education.component.ts
// Pattern: List (§3.2): summary row → 3-filter toolbar → AG Grid
// Key columns: Title, Type, Proficiency, Enrollments, Completion Rate, Rating, Status
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
  IonPopover, IonList, IonItem, IonCheckbox,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { AuthService }           from '@core/auth/auth.service';
import { EducationService }      from './manage.services';
import {
  type EducationContentRow,
  type ContentType, type ContentStatus, type ProficiencyLevel,
  CONTENT_TYPE_OPTIONS, CONTENT_STATUS_OPTIONS, PROFICIENCY_LEVEL_OPTIONS,
} from '@shared/types/manage.types';

@Component({
  selector: 'app-education',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
    IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
    IonPopover, IonList, IonItem, IonCheckbox,
    AgGridAngular,
    PageHeaderComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  templateUrl: './education.component.html',
  styleUrl:    './education.component.scss',
})
export class EducationComponent {
  readonly #svc    = inject(EducationService);
  readonly #auth   = inject(AuthService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<EducationContentRow>;

  constructor() { this.#title.setTitle('Education & Training · FinOps'); }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly searchText        = signal<string>('');
  readonly typeFilter        = signal<ContentType[]>([]);
  readonly statusFilter      = signal<ContentStatus[]>([]);
  readonly proficiencyFilter = signal<ProficiencyLevel[]>([]);
  readonly loadError         = signal<string | null>(null);

  readonly typeOptions        = CONTENT_TYPE_OPTIONS;
  readonly statusOptions      = CONTENT_STATUS_OPTIONS;
  readonly proficiencyOptions = PROFICIENCY_LEVEL_OPTIONS;

  // ── Query → data ──────────────────────────────────────────────────────────
  readonly #query = computed(() => ({
    search:     this.searchText()          || undefined,
    type:       this.typeFilter().length       ? this.typeFilter()       : undefined,
    status:     this.statusFilter().length     ? this.statusFilter()     : undefined,
    proficiency:this.proficiencyFilter().length? this.proficiencyFilter(): undefined,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load education content'); return of(null); }),
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
    !!this.searchText() || this.typeFilter().length > 0 ||
    this.statusFilter().length > 0 || this.proficiencyFilter().length > 0);
  readonly canCreate = computed(() => this.#auth.hasPermission('education:manage'));

  // ── AG Grid ───────────────────────────────────────────────────────────────
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<EducationContentRow>[] = [
    {
      field: 'title', headerName: 'Content', minWidth: 240, flex: 2,
      cellRenderer: (p: ICellRendererParams<EducationContentRow>) => {
        const r = p.data!;
        const dur = r.durationMinutes >= 60
          ? `${Math.floor(r.durationMinutes / 60)}h ${r.durationMinutes % 60}m`
          : `${r.durationMinutes}m`;
        return `<div class="rec-cell">
          <span class="rec-name">${this.#e(r.title)}</span>
          <span class="rec-meta">${this.#e(r.targetRole)} · ${dur}</span>
        </div>`;
      },
    },
    {
      field: 'contentType', headerName: 'Type', maxWidth: 190,
      cellRenderer: (p: ICellRendererParams<EducationContentRow>) =>
        `<span class="type-chip type-${(p.value as string).toLowerCase().replace(/_/g,'-')}">${this.#e((p.value as string).replace(/_/g,' '))}</span>`,
    },
    {
      field: 'proficiencyLevel', headerName: 'Level', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<EducationContentRow>) => {
        const vm: Record<string, string> = { Novice:'lev-novice', Beginner:'lev-beginner', Intermediate:'lev-intermediate', Advanced:'lev-advanced', Expert:'lev-expert' };
        return `<span class="level-badge ${vm[p.value as string] ?? 'lev-novice'}">${this.#e(p.value as string)}</span>`;
      },
    },
    {
      field: 'status', headerName: 'Status', maxWidth: 110,
      cellRenderer: (p: ICellRendererParams<EducationContentRow>) => {
        const vm: Record<string, string> = { Published:'success', Draft:'info', Archived:'neutral', Deprecated:'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`;
      },
    },
    {
      field: 'enrollmentCount', headerName: 'Enrolled', maxWidth: 100, type: 'numericColumn',
      valueFormatter: p => (p.value as number).toLocaleString('en-AE'),
    },
    {
      field: 'completionRate', headerName: 'Completion', maxWidth: 120, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<EducationContentRow>) => {
        const v = p.value as number;
        if (v === 0) return `<span class="comp-zero">—</span>`;
        const cls = v >= 80 ? 'comp-high' : v >= 60 ? 'comp-mid' : 'comp-low';
        return `<div class="prog-cell" aria-label="${v.toFixed(1)}% completion rate">
          <div class="prog-bar-track"><div class="prog-bar-fill ${v >= 80 ? 'prog-ok' : v >= 60 ? 'prog-warn' : 'prog-low'}" style="width:${v}%"></div></div>
          <span class="prog-label ${cls}">${v.toFixed(0)}%</span>
        </div>`;
      },
    },
    {
      field: 'avgRating', headerName: 'Rating', maxWidth: 100, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<EducationContentRow>) => {
        const v = p.value as number;
        if (v === 0) return `<span class="comp-zero">—</span>`;
        const stars = '★'.repeat(Math.round(v)) + '☆'.repeat(5 - Math.round(v));
        return `<span class="rating-cell" aria-label="${v.toFixed(1)} out of 5 stars"><span class="stars" aria-hidden="true">${stars}</span> <span class="rating-val">${v.toFixed(1)}</span></span>`;
      },
    },
    {
      headerName: '', field: 'contentId',
      width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right',
      cellRenderer: () =>
        `<button class="row-action-btn" aria-label="View content detail">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
         </button>`,
    },
  ];

  onGridReady(e: GridReadyEvent<EducationContentRow>) { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<EducationContentRow>) {
    if (e.data) this.#router.navigate(['/manage/education', e.data.contentId]);
  }

  onSearchChange(v: string | null | undefined)          { this.searchText.set(v ?? ''); }
  toggleTypeFilter(t: ContentType)                      { this.typeFilter.update(c => c.includes(t) ? c.filter(x => x !== t) : [...c, t]); }
  toggleStatusFilter(s: ContentStatus)                  { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  toggleProficiencyFilter(p: ProficiencyLevel)          { this.proficiencyFilter.update(c => c.includes(p) ? c.filter(x => x !== p) : [...c, p]); }
  clearFilters()  { this.searchText.set(''); this.typeFilter.set([]); this.statusFilter.set([]); this.proficiencyFilter.set([]); }
  exportCsv()     { this.#gridApi?.exportDataAsCsv({ fileName: 'education-content.csv' }); }

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}
