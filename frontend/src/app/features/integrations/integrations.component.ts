// FinOps Platform Design System v1.1 — Integrations — List screen.
// Location: apps/frontend/src/app/features/admin/integrations/
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, ToastController } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { IntegrationsService } from './tenant-admin.services';
import { type IntegrationRow, type IntegrationCategory, type IntegrationStatus, INTEGRATION_CATEGORY_OPTIONS, INTEGRATION_STATUS_OPTIONS } from '@shared/types/tenant-admin.types';

@Component({
  selector: 'app-integrations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './integrations.component.html',
  styleUrl:    './integrations.component.scss',
})
export class IntegrationsComponent {
  readonly #svc    = inject(IntegrationsService);
  readonly #toast  = inject(ToastController);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<IntegrationRow>;
  constructor() { this.#title.setTitle('Integrations · FinOps'); }

  readonly searchText      = signal('');
  readonly categoryFilter  = signal<IntegrationCategory[]>([]);
  readonly statusFilter    = signal<IntegrationStatus[]>([]);
  readonly loadError       = signal<string | null>(null);
  readonly categoryOptions = INTEGRATION_CATEGORY_OPTIONS;
  readonly statusOptions   = INTEGRATION_STATUS_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, category: this.categoryFilter().length ? this.categoryFilter() : undefined, status: this.statusFilter().length ? this.statusFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load integrations'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.categoryFilter().length > 0 || this.statusFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<IntegrationRow>[] = [
    { field: 'status', headerName: 'Status', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<IntegrationRow>) => { const vm: Record<string,string> = { Connected:'stat-ok', Degraded:'stat-warn', Disconnected:'stat-off', Pending:'stat-pending', Error:'stat-err' }; return `<span class="int-status ${vm[p.value as string]}" aria-label="${this.#e(p.value as string)} integration status">● ${this.#e(p.value as string)}</span>`; }
    },
    { field: 'name', headerName: 'Integration', minWidth: 200, flex: 2,
      cellRenderer: (p: ICellRendererParams<IntegrationRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${this.#e(r.name)}</span><span class="rec-meta">${this.#e(r.provider)} · ${this.#e(r.category.replace(/_/g,' '))}</span></div>`; }
    },
    { field: 'syncFrequency', headerName: 'Sync', maxWidth: 120 },
    { field: 'lastSyncAt', headerName: 'Last sync', minWidth: 130, valueFormatter: p => { if (!p.value) return 'Never'; const d = new Date(p.value as string); const hrs = Math.floor((Date.now() - d.getTime()) / 3_600_000); return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs/24)}d ago`; } },
    { field: 'recordsIngested', headerName: 'Records', maxWidth: 120, type: 'numericColumn', valueFormatter: p => (p.value as number).toLocaleString('en-AE') },
    { field: 'errorCount', headerName: 'Errors', maxWidth: 80, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<IntegrationRow>) => { const v = p.value as number; return v > 0 ? `<span class="err-count">${v}</span>` : `<span class="no-err">0</span>`; }
    },
    { headerName: 'Actions', field: 'integrationId', maxWidth: 120, sortable: false, filter: false, resizable: false, flex: 0,
      cellRenderer: (p: ICellRendererParams<IntegrationRow>) => `<button class="row-action-btn" (click)="syncRow('${this.#e(p.value as string)}')" aria-label="Sync now"><ion-icon name="refresh-outline"></ion-icon></button>` },
  ];

  onGridReady(e: GridReadyEvent<IntegrationRow>) { this.#gridApi = e.api; }
  onSearchChange(v: string | null | undefined)   { this.searchText.set(v ?? ''); }
  toggleCategoryFilter(c: IntegrationCategory)   { this.categoryFilter.update(x => x.includes(c) ? x.filter(i => i !== c) : [...x, c]); }
  toggleStatusFilter(s: IntegrationStatus)       { this.statusFilter.update(x => x.includes(s) ? x.filter(i => i !== s) : [...x, s]); }
  clearFilters() { this.searchText.set(''); this.categoryFilter.set([]); this.statusFilter.set([]); }

  async syncRow(id: string) {
    this.#svc.syncNow(id).subscribe({ next: async () => { const t = await this.#toast.create({ message: 'Sync queued.', duration: 2000, position: 'top', color: 'success' }); await t.present(); } });
  }
  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
