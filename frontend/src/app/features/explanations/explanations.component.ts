// FinOps Platform Design System v1.1 — Agent Explanations — List screen (Agent A29).
// Pattern: List — summary → filter toolbar → AG Grid with explanation summary truncation
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { ExplanationsService } from './coordinate.services';
import { formatCurrency } from '@lib/chart-defaults';
import { type ExplanationRow, type ExplanationAudience, type ExplanationStatus, EXPLANATION_AUDIENCE_OPTIONS, EXPLANATION_STATUS_OPTIONS } from '@shared/types/coordinate.types';

@Component({
  selector: 'app-explanations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './explanations.component.html',
  styleUrl:    './explanations.component.scss',
})
export class ExplanationsComponent {
  readonly #svc    = inject(ExplanationsService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<ExplanationRow>;
  constructor() { this.#title.setTitle('Agent Explanations · FinOps'); }

  readonly searchText      = signal('');
  readonly audienceFilter  = signal<ExplanationAudience[]>([]);
  readonly statusFilter    = signal<ExplanationStatus[]>([]);
  readonly loadError       = signal<string | null>(null);
  readonly audienceOptions = EXPLANATION_AUDIENCE_OPTIONS;
  readonly statusOptions   = EXPLANATION_STATUS_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, audience: this.audienceFilter().length ? this.audienceFilter() : undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load explanations'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.audienceFilter().length > 0 || this.statusFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<ExplanationRow>[] = [
    { field: 'audience', headerName: 'Audience', maxWidth: 150,
      cellRenderer: (p: ICellRendererParams<ExplanationRow>) => {
        const vm: Record<string, string> = { Executive:'aud-executive', FinOps_Analyst:'aud-analyst', Engineering:'aud-engineering', Finance:'aud-finance', All:'aud-all' };
        return `<span class="aud-badge ${vm[p.value as string] ?? 'aud-all'}">${this.#e((p.value as string).replace('_',' '))}</span>`;
      }
    },
    { field: 'title', headerName: 'Explanation', minWidth: 260, flex: 2,
      cellRenderer: (p: ICellRendererParams<ExplanationRow>) => {
        const r = p.data!;
        const preview = r.summary.length > 110 ? r.summary.slice(0, 110) + '…' : r.summary;
        return `<div class="rec-cell">
          <span class="rec-name">${this.#e(r.title)}</span>
          <span class="rec-meta exp-preview">${this.#e(preview)}</span>
        </div>`;
      }
    },
    { field: 'originatingAgent', headerName: 'Agent', maxWidth: 180,
      cellRenderer: (p: ICellRendererParams<ExplanationRow>) => {
        const r = p.data!;
        return `<span class="agent-chip">${this.#e(r.agentId)}: ${this.#e(r.originatingAgent)}</span>`;
      }
    },
    { field: 'status', headerName: 'Status', maxWidth: 110,
      cellRenderer: (p: ICellRendererParams<ExplanationRow>) => {
        const vm: Record<string, string> = { Generated:'info', Delivered:'success', Viewed:'success', Archived:'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`;
      }
    },
    { field: 'financialImpact', headerName: 'Impact', maxWidth: 150, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<ExplanationRow>) => {
        const v = p.value as number;
        return v > 0 ? `<span class="savings-cell">${formatCurrency(v, { code: p.data!.currency })}</span>` : `<span class="no-cost">—</span>`;
      }
    },
    { field: 'confidenceScore', headerName: 'Conf.', maxWidth: 80, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<ExplanationRow>) => { const v = p.value as number; const cls = v >= 90 ? 'conf-high' : v >= 75 ? 'conf-mid' : 'conf-low'; return `<span class="${cls}">${v}%</span>`; }
    },
    { field: 'viewCount', headerName: 'Views', maxWidth: 70, type: 'numericColumn' },
    { field: 'generatedAt', headerName: 'Generated', minWidth: 120, valueFormatter: p => { const d = new Date(p.value as string); const hrs = Math.floor((Date.now() - d.getTime()) / 3_600_000); return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs/24)}d ago`; } },
    { headerName: '', field: 'explanationId', width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right', cellRenderer: () => `<button class="row-action-btn" aria-label="View full explanation"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<ExplanationRow>)   { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<ExplanationRow>) { if (e.data) this.#router.navigate(['/coordinate/explanations', e.data.explanationId]); }
  onSearchChange(v: string | null | undefined)     { this.searchText.set(v ?? ''); }
  toggleAudienceFilter(a: ExplanationAudience)     { this.audienceFilter.update(c => c.includes(a) ? c.filter(x => x !== a) : [...c, a]); }
  toggleStatusFilter(s: ExplanationStatus)         { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  clearFilters()  { this.searchText.set(''); this.audienceFilter.set([]); this.statusFilter.set([]); }
  exportCsv()     { this.#gridApi?.exportDataAsCsv({ fileName: 'explanations.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
