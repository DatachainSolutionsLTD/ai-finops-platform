// FinOps Platform Design System v1.1 — Updated v2
// escHtml() → @lib/utils/html.utils | relativeTime() → @lib/utils/date.utils
// FinOps Platform Design System v1.1 — Governance Policies — List screen (Agent A20).
// Pattern: List — summary → filter toolbar → AG Grid
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { escHtml } from '@lib/utils/html.utils';
import type { SummaryStat } from '@shared/components/summary-stat-row.component';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { GridShellCardComponent } from '@shared/components/grid-shell-card-component.component';
import { SummaryStatRowComponent } from '@shared/components/summary-stat-row-component.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { AuthService } from '@core/auth/auth.service';
import { GovernancePoliciesService } from './manage.services';
import {
  type PolicyListRow, type PolicyType, type PolicyStatus, type PolicySeverity,
  POLICY_TYPE_OPTIONS, POLICY_STATUS_OPTIONS, POLICY_SEVERITY_OPTIONS,
} from '@shared/types/manage.types';

@Component({
  selector: 'app-governance-policies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent, SummaryStatRowComponent, GridShellCardComponent,],
  templateUrl: './governance-policies.component.html',
  styleUrl:    './governance-policies.component.scss',
})
export class GovernancePoliciesComponent {
  readonly #svc    = inject(GovernancePoliciesService);
  readonly #auth   = inject(AuthService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<PolicyListRow>;
  constructor() { this.#title.setTitle('Governance Policies · FinOps'); }

  readonly searchText     = signal('');
  readonly typeFilter     = signal<PolicyType[]>([]);
  readonly statusFilter   = signal<PolicyStatus[]>([]);
  readonly severityFilter = signal<PolicySeverity[]>([]);
  readonly loadError      = signal<string | null>(null);
  readonly typeOptions     = POLICY_TYPE_OPTIONS;
  readonly statusOptions   = POLICY_STATUS_OPTIONS;
  readonly severityOptions = POLICY_SEVERITY_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, type: this.typeFilter().length ? this.typeFilter() : undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load policies'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.typeFilter().length > 0 || this.statusFilter().length > 0 || this.severityFilter().length > 0);
  readonly canCreate = computed(() => this.#auth.hasPermission('governance:manage'));


  readonly summaryStats = computed<SummaryStat[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Total', value: s.total },
      { label: 'Active', value: s.active, colorClass: 'success' },
      { label: 'Draft', value: s.draft, colorClass: 'info' },
      { label: 'With violations', value: s.withViolations, colorClass: (s.withViolations > 0) ? 'danger' : undefined },
      { label: 'Auto-remediated', value: s.autoRemediated, colorClass: 'success' },
    ];
  });
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<PolicyListRow>[] = [
    { field: 'severity', headerName: 'Severity', maxWidth: 120, cellRenderer: (p: ICellRendererParams<PolicyListRow>) => { const vm: Record<string,string> = { Critical:'sev-critical', High:'sev-high', Medium:'sev-medium', Low:'sev-low', Informational:'sev-info' }; return `<span class="sev-badge ${vm[p.value as string]}">${escHtml(p.value as string)}</span>`; } },
    { field: 'name', headerName: 'Policy', minWidth: 240, flex: 2, cellRenderer: (p: ICellRendererParams<PolicyListRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${escHtml(r.name)}</span><span class="rec-meta">${escHtml(r.scope)}</span></div>`; } },
    { field: 'policyType', headerName: 'Type', maxWidth: 190, cellRenderer: (p: ICellRendererParams<PolicyListRow>) => `<span class="type-chip">${escHtml((p.value as string).replace(/_/g,' '))}</span>` },
    { field: 'status', headerName: 'Status', maxWidth: 110, cellRenderer: (p: ICellRendererParams<PolicyListRow>) => { const vm: Record<string,string> = { Active:'success', Draft:'info', Archived:'neutral' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${escHtml(p.value as string)}</span>`; } },
    { field: 'enforcement', headerName: 'Enforcement', maxWidth: 190, cellRenderer: (p: ICellRendererParams<PolicyListRow>) => `<span class="enf-chip enf-${(p.value as string).toLowerCase().replace(/_/g,'-')}">${escHtml((p.value as string).replace(/_/g,' '))}</span>` },
    { field: 'violationCount', headerName: 'Violations', maxWidth: 100, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<PolicyListRow>) => { const v = p.value as number; return v > 0 ? `<span class="viol-count">${v}</span>` : `<span class="viol-zero">0</span>`; } },
    { field: 'updatedAt', headerName: 'Updated', minWidth: 120, valueFormatter: p => new Date(p.value as string).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) },
    { headerName:'', field:'policyId', width:60, maxWidth:60, minWidth:60, sortable:false, filter:false, resizable:false, flex:0, pinned:'right', cellRenderer: () => `<button class="row-action-btn" aria-label="View policy detail"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<PolicyListRow>) { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<PolicyListRow>) { if (e.data) this.#router.navigate(['/manage/policies', e.data.policyId]); }
  onSearchChange(v: string | null | undefined) { this.searchText.set(v ?? ''); }
  toggleTypeFilter(t: PolicyType)         { this.typeFilter.update(c => c.includes(t) ? c.filter(x => x !== t) : [...c, t]); }
  toggleStatusFilter(s: PolicyStatus)     { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  toggleSeverityFilter(sv: PolicySeverity){ this.severityFilter.update(c => c.includes(sv) ? c.filter(x => x !== sv) : [...c, sv]); }
  clearFilters() { this.searchText.set(''); this.typeFilter.set([]); this.statusFilter.set([]); this.severityFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'governance-policies.csv' }); }
  readonly retry = () => { this.loadError.set(null); };
}
