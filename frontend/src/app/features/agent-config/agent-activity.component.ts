// FinOps Platform Design System v1.1 — Agent Activity — List screen (Agent A27).
// Pattern: List — summary → filter toolbar → AG Grid (health status, queue, CPU, uptime)
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox } from '@ionic/angular/standalone';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { switchMap, startWith, catchError, of } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent } from '@shared/components/empty-state.component';
import { AgentActivityService } from './coordinate.services';
import { type AgentActivityRow, type AgentStatus, type AgentTier, AGENT_STATUS_OPTIONS, AGENT_TIER_OPTIONS } from '@shared/types/coordinate.types';

@Component({
  selector: 'app-agent-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonSearchbar, IonButton, IonIcon, IonChip, IonLabel, IonPopover, IonList, IonItem, IonCheckbox, AgGridAngular, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent],
  templateUrl: './agent-activity.component.html',
  styleUrl:    './agent-activity.component.scss',
})
export class AgentActivityComponent {
  readonly #svc    = inject(AgentActivityService);
  readonly #title  = inject(Title);
  #gridApi?: GridApi<AgentActivityRow>;
  constructor() { this.#title.setTitle('Agent Activity · FinOps'); }

  readonly searchText   = signal('');
  readonly statusFilter = signal<AgentStatus[]>([]);
  readonly tierFilter   = signal<AgentTier[]>([]);
  readonly loadError    = signal<string | null>(null);
  readonly statusOptions = AGENT_STATUS_OPTIONS;
  readonly tierOptions   = AGENT_TIER_OPTIONS;

  readonly #query = computed(() => ({ search: this.searchText() || undefined, status: this.statusFilter().length ? this.statusFilter() : undefined, tier: this.tierFilter().length ? this.tierFilter() : undefined }));
  readonly listResponse = toSignal(toObservable(this.#query).pipe(switchMap(q => this.#svc.list(q).pipe(startWith(null), catchError(err => { this.loadError.set(err.title ?? 'Unable to load agent activity'); return of(null); })))), { initialValue: null });
  readonly summary      = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData   = computed(() => this.listResponse() !== null);
  readonly rows      = computed(() => this.listResponse()?.data ?? []);
  readonly total     = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows   = computed(() => this.rows().length > 0);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.statusFilter().length > 0 || this.tierFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly colDefs: ColDef<AgentActivityRow>[] = [
    {
      field: 'status', headerName: 'Status', maxWidth: 120,
      cellRenderer: (p: ICellRendererParams<AgentActivityRow>) => {
        const vm: Record<AgentStatus, string> = { Healthy:'stat-healthy', Degraded:'stat-degraded', Busy:'stat-busy', Failed:'stat-failed', Suspended:'stat-suspended', Updating:'stat-updating' };
        const icons: Record<AgentStatus, string> = { Healthy:'●', Degraded:'▲', Busy:'◎', Failed:'✕', Suspended:'⏸', Updating:'↻' };
        const s = p.value as AgentStatus;
        return `<span class="agent-status ${vm[s]}" aria-label="${this.#e(s)} status">${icons[s]} ${this.#e(s)}</span>`;
      },
    },
    {
      field: 'agentCode', headerName: 'Agent', minWidth: 200, flex: 2,
      cellRenderer: (p: ICellRendererParams<AgentActivityRow>) => {
        const r = p.data!;
        return `<div class="rec-cell">
          <span class="rec-name">${this.#e(r.agentCode)} – ${this.#e(r.agentName)}</span>
          <span class="rec-meta">${this.#e(r.tier)} · v${this.#e(r.version)}</span>
        </div>`;
      },
    },
    { field: 'queueDepth', headerName: 'Queue', maxWidth: 80, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AgentActivityRow>) => { const v = p.value as number; const cls = v > 20 ? 'queue-high' : v > 5 ? 'queue-mid' : 'queue-ok'; return `<span class="${cls}">${v}</span>`; }
    },
    { field: 'activeActions', headerName: 'Active', maxWidth: 80, type: 'numericColumn' },
    {
      field: 'cpuPct', headerName: 'CPU', maxWidth: 90, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AgentActivityRow>) => { const v = p.value as number; const cls = v >= 85 ? 'util-high' : v >= 60 ? 'util-mid' : 'util-ok'; return `<span class="${cls}">${v}%</span>`; }
    },
    {
      field: 'memoryPct', headerName: 'Memory', maxWidth: 90, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AgentActivityRow>) => { const v = p.value as number; const cls = v >= 85 ? 'util-high' : v >= 60 ? 'util-mid' : 'util-ok'; return `<span class="${cls}">${v}%</span>`; }
    },
    {
      field: 'errorRatePct', headerName: 'Err rate', maxWidth: 90, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<AgentActivityRow>) => { const v = p.value as number; const cls = v >= 5 ? 'err-high' : v >= 1 ? 'err-mid' : 'err-ok'; return `<span class="${cls}">${v.toFixed(1)}%</span>`; }
    },
    { field: 'uptimePct', headerName: 'Uptime', maxWidth: 90, type: 'numericColumn', valueFormatter: p => `${(p.value as number).toFixed(2)}%` },
    {
      field: 'actionsLast24h', headerName: 'Actions (24h)', maxWidth: 120, type: 'numericColumn',
      valueFormatter: p => (p.value as number).toLocaleString('en-AE'),
    },
    {
      field: 'lastHeartbeatAt', headerName: 'Last heartbeat', minWidth: 130,
      valueFormatter: p => { const diff = Math.floor((Date.now() - new Date(p.value as string).getTime()) / 1000); return diff < 60 ? `${diff}s ago` : `${Math.floor(diff / 60)}m ago`; },
    },
  ];

  onGridReady(e: GridReadyEvent<AgentActivityRow>) { this.#gridApi = e.api; }
  onSearchChange(v: string | null | undefined)     { this.searchText.set(v ?? ''); }
  toggleStatusFilter(s: AgentStatus)               { this.statusFilter.update(c => c.includes(s) ? c.filter(x => x !== s) : [...c, s]); }
  toggleTierFilter(t: AgentTier)                   { this.tierFilter.update(c => c.includes(t) ? c.filter(x => x !== t) : [...c, t]); }
  clearFilters() { this.searchText.set(''); this.statusFilter.set([]); this.tierFilter.set([]); }

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
