// FinOps Platform Design System v1.1 — Updated v2
// escHtml() → @lib/utils/html.utils | relativeTime() → @lib/utils/date.utils
// FinOps Platform Design System v1.1 — Policy Violations — List screen.
// Pattern: List with SLA countdown indicators + bulk acknowledge
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, ToastController } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClickedEvent, SelectionChangedEvent } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { escHtml } from '@lib/utils/html.utils';
import type { SummaryStat } from '@shared/components/summary-stat-row.component';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { BulkActionBarComponent, type BulkAction } from '@shared/components/bulk-action-bar.component';
import { GridShellCardComponent } from '@shared/components/grid-shell-card-component.component';
import { SummaryStatRowComponent } from '@shared/components/summary-stat-row-component.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { PolicyViolationsService } from './manage.services';
import { formatCurrency } from '@lib/chart-defaults';
import { type ViolationListRow, type PolicySeverity, type ViolationStatus, type ViolationSlaStatus, VIOLATION_STATUS_OPTIONS, VIOLATION_SEVERITY_OPTIONS } from '@shared/types/manage.types';

@Component({
  selector: 'app-policy-violations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent, SummaryStatRowComponent, GridShellCardComponent, BulkActionBarComponent,],
  templateUrl: './policy-violations.component.html',
  styleUrl:    './policy-violations.component.scss',
})
export class PolicyViolationsComponent {
  readonly #svc    = inject(PolicyViolationsService);
  readonly #router = inject(Router);
  readonly #title  = inject(Title);
  readonly #toast  = inject(ToastController);
  #gridApi?: GridApi<ViolationListRow>;
  constructor() { this.#title.setTitle('Policy Violations · FinOps'); }

  readonly searchText      = signal('');
  readonly severityFilter  = signal<PolicySeverity[]>([]);
  readonly statusFilter    = signal<ViolationStatus[]>([]);
  readonly loadError       = signal<string | null>(null);
  readonly selectedIds     = signal<string[]>([]);
  readonly severityOptions = VIOLATION_SEVERITY_OPTIONS;
  readonly statusOptions   = VIOLATION_STATUS_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, severity: this.severityFilter().length ? this.severityFilter() : undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load violations'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.severityFilter().length > 0 || this.statusFilter().length > 0);
  readonly hasSelection   = computed(() => this.selectedIds().length > 0);
  readonly selectionCount = computed(() => this.selectedIds().length);


  readonly summaryStats = computed<SummaryStat[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Total', value: s.total },
      { label: 'Open', value: s.open, colorClass: (s.open > 0) ? 'danger' : undefined },
      { label: 'Critical', value: s.critical, colorClass: (s.critical > 0) ? 'danger' : undefined },
      { label: 'SLA breached', value: s.slaBreached, colorClass: (s.slaBreached > 0) ? 'danger' : undefined },
      { label: 'Cost impact', value: s.totalCostImpact },
    ];
  });
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<ViolationListRow>[] = [
    { headerCheckboxSelection: true, checkboxSelection: true, width: 48, maxWidth: 48, minWidth: 48, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'left', headerName: '' },
    { field: 'severity', headerName: 'Severity', maxWidth: 120, pinned: 'left', cellRenderer: (p: ICellRendererParams<ViolationListRow>) => { const vm: Record<string,string> = { Critical:'sev-critical', High:'sev-high', Medium:'sev-medium', Low:'sev-low', Informational:'sev-info' }; return `<span class="sev-badge ${vm[p.value as string]}">${escHtml(p.value as string)}</span>`; } },
    { field: 'policyName', headerName: 'Policy violated', minWidth: 220, flex: 2, cellRenderer: (p: ICellRendererParams<ViolationListRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${escHtml(r.policyName)}</span><span class="rec-meta">${escHtml(r.resourceType)} · ${escHtml(r.provider)} · ${escHtml(r.businessUnit)}</span></div>`; } },
    { field: 'status', headerName: 'Status', maxWidth: 155, cellRenderer: (p: ICellRendererParams<ViolationListRow>) => { const vm: Record<string,string> = { Open:'danger', Acknowledged:'warning', In_Remediation:'info', Remediated:'success', Waived:'neutral' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${escHtml((p.value as string).replace('_',' '))}</span>`; } },
    {
      field: 'slaStatus', headerName: 'SLA', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<ViolationListRow>) => {
        const r = p.data!;
        if (!r.slaRemainingHours) return `<span class="sla-breached">Breached</span>`;
        const cls = r.slaStatus === 'Approaching' ? 'sla-approaching' : 'sla-ok';
        return `<span class="${cls}">${r.slaRemainingHours}h left</span>`;
      },
    },
    { field: 'costImpact', headerName: 'Cost impact', maxWidth: 150, type: 'numericColumn', cellRenderer: (p: ICellRendererParams<ViolationListRow>) => { const v = p.value as number; return v > 0 ? `<span class="savings-cell">${formatCurrency(v, { code: p.data!.currency })}</span>` : `<span class="no-cost">—</span>`; } },
    { field: 'assignedTo', headerName: 'Assigned', minWidth: 130, valueFormatter: p => (p.value as string | null) ?? 'Unassigned' },
    { field: 'detectedAt', headerName: 'Detected', minWidth: 130, valueFormatter: p => { const d = new Date(p.value as string); const mins = Math.floor((Date.now() - d.getTime()) / 60_000); return mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins/60)}h ago` : `${Math.floor(mins/1440)}d ago`; } },
    { headerName: '', field: 'violationId', width: 60, maxWidth: 60, minWidth: 60, sortable: false, filter: false, resizable: false, flex: 0, pinned: 'right', cellRenderer: () => `<button class="row-action-btn" aria-label="View violation detail"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` },
  ];

  onGridReady(e: GridReadyEvent<ViolationListRow>)        { this.#gridApi = e.api; }
  onRowClicked(e: RowClickedEvent<ViolationListRow>)      { if ((e.event?.target as HTMLElement)?.closest('.ag-selection-checkbox')) return; if (e.data) this.#router.navigate(['/manage/violations', e.data.violationId]); }
  onSelectionChanged(_e: SelectionChangedEvent)           { this.selectedIds.set((this.#gridApi?.getSelectedRows() ?? []).map((r: ViolationListRow) => r.violationId)); }

  onSearchChange(v: string | null | undefined)         { this.searchText.set(v ?? ''); }
  toggleSeverityFilter(sv: PolicySeverity)             { this.severityFilter.update(c => c.includes(sv) ? c.filter(x => x !== sv) : [...c, sv]); }
  toggleStatusFilter(s: ViolationStatus)               { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  clearFilters() { this.searchText.set(''); this.severityFilter.set([]); this.statusFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'violations.csv' }); }

  async bulkAcknowledge() {
    const ids = this.selectedIds();
    ids.forEach(id => this.#svc.acknowledge(id).subscribe());
    this.selectedIds.set([]);
    const t = await this.#toast.create({ message: `${ids.length} violation${ids.length > 1 ? 's' : ''} acknowledged.`, duration: 2500, position: 'top', color: 'success' });
    await t.present();
  }

  readonly retry = () => { this.loadError.set(null); };
}
