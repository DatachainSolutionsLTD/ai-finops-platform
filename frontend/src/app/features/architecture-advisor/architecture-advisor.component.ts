// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Architecture Advisor — List screen (Agent A13).
// Pattern: List (§3.2): summary → filter toolbar → AG Grid

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
import { ArchitectureAdvisorService } from './optimize-1.services';
import { formatCurrency } from '@lib/chart-defaults';
import { type ArchRecommendationRow, type ArchRecStatus, type ArchRecType, type ArchRecPriority, ARCH_STATUS_OPTIONS, ARCH_TYPE_OPTIONS, ARCH_PRIORITY_OPTIONS } from '@shared/types/optimize-dashboards.types';

@Component({
  selector: 'app-architecture-advisor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './architecture-advisor.component.html',
  styleUrl:    './architecture-advisor.component.scss',
})
export class ArchitectureAdvisorComponent {
  readonly #svc    = inject(ArchitectureAdvisorService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<ArchRecommendationRow>;
  constructor() { this.#title.setTitle('Architecture Advisor · FinOps'); }

  readonly searchText     = signal<string>('');
  readonly statusFilter   = signal<ArchRecStatus[]>([]);
  readonly priorityFilter = signal<ArchRecPriority[]>([]);
  readonly typeFilter     = signal<ArchRecType[]>([]);
  readonly loadError      = signal<string | null>(null);
  readonly statusOptions   = ARCH_STATUS_OPTIONS;
  readonly priorityOptions = ARCH_PRIORITY_OPTIONS;
  readonly typeOptions     = ARCH_TYPE_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, status: this.statusFilter().length ? this.statusFilter() : undefined, priority: this.priorityFilter().length ? this.priorityFilter() : undefined }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load architecture recommendations'); return of(null); }))),
    ),
    { initialValue: null },
  );
  readonly summary = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.statusFilter().length > 0 || this.priorityFilter().length > 0 || this.typeFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<ArchRecommendationRow>[] = [
    { field: 'priority', headerName: 'Priority', maxWidth: 115, cellRenderer: (p: ICellRendererParams<ArchRecommendationRow>) => { const vm: Record<string,string> = { Critical:'prio-critical', High:'prio-high', Medium:'prio-medium', Low:'prio-low' }; return `<span class="prio-badge ${vm[p.value as string]}">${this.#e(p.value as string)}</span>`; } },
    { field: 'title', headerName: 'Recommendation', minWidth: 240, flex: 2, cellRenderer: (p: ICellRendererParams<ArchRecommendationRow>) => { const r = p.data!; return `<div class="res-cell"><span class="res-name">${this.#e(r.title)}</span><span class="res-meta">${this.#e(r.application)} · ${this.#e(r.businessUnit)}</span></div>`; } },
    { field: 'type', headerName: 'Type', maxWidth: 180, cellRenderer: (p: ICellRendererParams<ArchRecommendationRow>) => `<span class="type-chip">${this.#e((p.value as string).replace(/_/g,' '))}</span>` },
    { field: 'status', headerName: 'Status', maxWidth: 140, cellRenderer: (p: ICellRendererParams<ArchRecommendationRow>) => { const vm: Record<string,string> = { Open:'info', Under_Review:'warning', Approved:'success', In_Progress:'info', Completed:'success', Rejected:'neutral' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e((p.value as string).replace('_',' '))}</span>`; } },
    { field: 'monthlySavings', headerName: 'Monthly savings', maxWidth: 160, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<ArchRecommendationRow>) => `<span class="savings-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>` },
    { field: 'paybackMonths', headerName: 'Payback', maxWidth: 100, type: 'numericColumn', valueFormatter: p => `${(p.value as number).toFixed(1)} mo` },
    { field: 'complexityScore', headerName: 'Complexity', maxWidth: 110, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<ArchRecommendationRow>) => { const v = p.value as number; const cls = v >= 8 ? 'cmplx-high' : v >= 5 ? 'cmplx-mid' : 'cmplx-low'; return `<span class="${cls}">${v}/10</span>`; } },
    { field: 'confidenceScore', headerName: 'Conf.', maxWidth: 80, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<ArchRecommendationRow>) => { const v = p.value as number; return `<span class="${v >= 85 ? 'conf-high' : v >= 70 ? 'conf-mid' : 'conf-low'}">${v}%</span>`; } },
    { headerName: '', field: 'recommendationId', width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right', cellRenderer: () => `<button class="row-action-btn" aria-label="View recommendation detail"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<ArchRecommendationRow>) { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<ArchRecommendationRow>) { if (e.data) this.#router.navigate(['/optimize/architecture', e.data.recommendationId]); }

  onSearchChange(v: string | null | undefined)    { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: ArchRecStatus)            { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  togglePriorityFilter(p: ArchRecPriority)        { this.priorityFilter.update(c => c.includes(p) ? c.filter(x => x !== p) : [...c, p]); }
  clearFilters() { this.searchText.set(''); this.statusFilter.set([]); this.priorityFilter.set([]); this.typeFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'architecture-recommendations.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
