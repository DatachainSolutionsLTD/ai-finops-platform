// FinOps Platform Design System v1.1 — Compliance Reports — List screen.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, ToastController } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { ComplianceReportsService } from './compliance.services';
import { type ComplianceReportRow, type ComplianceReportType, type ReportSchedule, REPORT_TYPE_OPTIONS, REPORT_SCHEDULE_OPTIONS } from '@shared/types/compliance.types';

@Component({
  selector: 'app-compliance-reports',
  standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './compliance-reports.component.html',
  styleUrl:    './compliance-reports.component.scss',
})
export class ComplianceReportsComponent {
  readonly #svc   = inject(ComplianceReportsService);
  readonly #toast = inject(ToastController);
  readonly #title = inject(Title);
  #gridApi?: GridApi<ComplianceReportRow>;
  constructor() { this.#title.setTitle('Compliance Reports · FinOps'); }

  readonly searchText      = signal('');
  readonly typeFilter      = signal<ComplianceReportType[]>([]);
  readonly loadError       = signal<string | null>(null);
  readonly typeOptions     = REPORT_TYPE_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, type: this.typeFilter().length ? this.typeFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load reports'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.typeFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<ComplianceReportRow>[] = [
    { field: 'status', headerName: 'Status', maxWidth: 120, cellRenderer: (p: ICellRendererParams<ComplianceReportRow>) => { const vm: Record<string,string> = { Ready:'success', Generating:'info', Scheduled:'neutral', Failed:'danger', Expired:'neutral' }; return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e(p.value as string)}</span>`; } },
    { field: 'reportName', headerName: 'Report', minWidth: 260, flex: 2, cellRenderer: (p: ICellRendererParams<ComplianceReportRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${this.#e(r.reportName)}</span><span class="rec-meta">${this.#e(r.reportType.replace(/_/g,' '))} · ${this.#e(r.schedule)} · ${this.#e(r.format)}</span></div>`; } },
    { field: 'generatedAt', headerName: 'Generated', minWidth: 130, valueFormatter: p => p.value ? new Date(p.value as string).toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'}) : '—' },
    { field: 'expiresAt', headerName: 'Expires', minWidth: 130, valueFormatter: p => p.value ? new Date(p.value as string).toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'}) : '—' },
    { field: 'fileSizeKb', headerName: 'Size', maxWidth: 90, type: 'numericColumn', valueFormatter: p => p.value ? (p.value as number) >= 1024 ? `${((p.value as number) / 1024).toFixed(1)} MB` : `${p.value} KB` : '—' },
    { field: 'downloadUrl', headerName: 'Download', maxWidth: 100, sortable: false, filter: false,
      cellRenderer: (p: ICellRendererParams<ComplianceReportRow>) => p.value ? `<a class="dl-link" href="${this.#e(p.value as string)}" download aria-label="Download ${this.#e(p.data!.reportName)}"><ion-icon name="download-outline"></ion-icon> Download</a>` : '—'
    },
  ];

  onGridReady(e: GridReadyEvent<ComplianceReportRow>) { this.#gridApi = e.api; }
  onSearchChange(v: string | null | undefined)        { this.searchText.set(v ?? ''); }
  toggleTypeFilter(t: ComplianceReportType)           { this.typeFilter.update(c => c.includes(t) ? c.filter(x => x !== t) : [...c, t]); }
  clearFilters()  { this.searchText.set(''); this.typeFilter.set([]); }

  async generateOnDemand() {
    this.#svc.generate('Audit_Trail_Export').subscribe({ next: async () => { const t = await this.#toast.create({ message: 'Report generation queued. You will be notified when ready.', duration: 3000, position: 'top', color: 'success' }); await t.present(); } });
  }

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
