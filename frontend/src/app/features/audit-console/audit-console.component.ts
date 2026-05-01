// FinOps Platform Design System v1.1 — Audit Console — List screen (immutable, read-only).
// Pattern: List — summary → 3-filter → AG Grid → Export CSV/PDF
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
import { AuditConsoleService } from './compliance.services';
import { type AuditEventRow, type AuditEventCategory, type AuditEventOutcome, AUDIT_CATEGORY_OPTIONS, AUDIT_OUTCOME_OPTIONS } from '@shared/types/compliance.types';

@Component({
  selector: 'app-audit-console',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './audit-console.component.html',
  styleUrl:    './audit-console.component.scss',
})
export class AuditConsoleComponent {
  readonly #svc    = inject(AuditConsoleService);
  readonly #toast  = inject(ToastController);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<AuditEventRow>;
  constructor() { this.#title.setTitle('Audit Console · FinOps'); }

  readonly searchText      = signal('');
  readonly categoryFilter  = signal<AuditEventCategory[]>([]);
  readonly outcomeFilter   = signal<AuditEventOutcome[]>([]);
  readonly loadError       = signal<string | null>(null);
  readonly categoryOptions = AUDIT_CATEGORY_OPTIONS;
  readonly outcomeOptions  = AUDIT_OUTCOME_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, category: this.categoryFilter().length ? this.categoryFilter() : undefined, outcome: this.outcomeFilter().length ? this.outcomeFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load audit events'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.categoryFilter().length > 0 || this.outcomeFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<AuditEventRow>[] = [
    { field: 'occurredAt', headerName: 'Time', maxWidth: 160, pinned: 'left', valueFormatter: p => { const d = new Date(p.value as string); return d.toLocaleDateString('en-AE',{day:'2-digit',month:'short'}) + ' ' + d.toLocaleTimeString('en-AE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); } },
    { field: 'eventOutcome', headerName: 'Outcome', maxWidth: 100, pinned: 'left',
      cellRenderer: (p: ICellRendererParams<AuditEventRow>) => { const vm: Record<string,string> = { Success:'out-ok', Failure:'out-fail', Partial:'out-partial', Blocked:'out-blocked', Error:'out-err' }; return `<span class="outcome-badge ${vm[p.value as string]}" aria-label="${this.#e(p.value as string)} outcome">● ${this.#e(p.value as string)}</span>`; }
    },
    { field: 'eventCategory', headerName: 'Category', maxWidth: 200, cellRenderer: (p: ICellRendererParams<AuditEventRow>) => `<span class="cat-chip">${this.#e((p.value as string).replace(/_/g,' '))}</span>` },
    { field: 'actionPerformed', headerName: 'Action', minWidth: 280, flex: 2,
      cellRenderer: (p: ICellRendererParams<AuditEventRow>) => { const r = p.data!; return `<div class="rec-cell"><span class="rec-name">${this.#e(r.eventType.replace(/_/g,' '))}</span><span class="rec-meta code">${this.#e(r.actionPerformed)}</span></div>`; }
    },
    { field: 'actorDisplayName', headerName: 'Actor', minWidth: 160,
      cellRenderer: (p: ICellRendererParams<AuditEventRow>) => { const r = p.data!; const vm: Record<string,string> = { Human_User:'actor-human', Agent:'actor-agent', Service_Account:'actor-svc', API_Key:'actor-api', System:'actor-system', External_System:'actor-ext' }; return `<span class="${vm[r.actorType] ?? 'actor-human'}">${this.#e(r.actorDisplayName)}</span>`; }
    },
    { field: 'targetDisplayName', headerName: 'Target', minWidth: 160, valueFormatter: p => (p.value as string | null) ?? '—' },
    { field: 'requiresReview', headerName: 'Review', maxWidth: 80, cellRenderer: (p: ICellRendererParams<AuditEventRow>) => (p.value as boolean) ? `<span class="review-flag" aria-label="Requires review">⚑ Yes</span>` : '' },
    { field: 'clientIp', headerName: 'IP', maxWidth: 130, valueFormatter: p => (p.value as string | null) ?? '—' },
  ];

  onGridReady(e: GridReadyEvent<AuditEventRow>)  { this.#gridApi = e.api; }
  onSearchChange(v: string | null | undefined)   { this.searchText.set(v ?? ''); }
  toggleCategoryFilter(c: AuditEventCategory)   { this.categoryFilter.update(x => x.includes(c) ? x.filter(i => i !== c) : [...x, c]); }
  toggleOutcomeFilter(o: AuditEventOutcome)      { this.outcomeFilter.update(x => x.includes(o) ? x.filter(i => i !== o) : [...x, o]); }
  clearFilters()  { this.searchText.set(''); this.categoryFilter.set([]); this.outcomeFilter.set([]); }

  async exportCsv() {
    this.#gridApi?.exportDataAsCsv({ fileName: 'audit-trail.csv' });
    const t = await this.#toast.create({ message: 'Audit trail exported as CSV.', duration: 2000, position: 'top', color: 'success' }); await t.present();
  }
  async exportPdf() {
    this.#svc.exportAudit('PDF').subscribe({ next: async () => { const t = await this.#toast.create({ message: 'PDF export queued — you will be notified when ready.', duration: 3000, position: 'top', color: 'success' }); await t.present(); } });
  }

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
