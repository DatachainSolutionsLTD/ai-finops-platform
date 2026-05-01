// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// License & SaaS — List screen. Agent A15.
// Location: apps/frontend/src/app/features/optimize/licenses/
//           license-saas.component.ts
// Pattern: List (§3.2): 5-stat summary → 3-filter toolbar → AG Grid
// Key columns: vendor, product, utilisation %, compliance badge, contract end, AHB flag
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';

import {
  IonContent, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  IonSearchbar, IonButton, IonIcon, IonChip, IonLabel,
  IonPopover, IonList, IonItem, IonCheckbox,
} from '@ionic/angular/standalone';

import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';

import { switchMap, startWith, catchError, of } from 'rxjs';

import { PageHeaderComponent }   from '@shared/components/page-header.component';
import { LoadingStateComponent } from '@shared/components/loading-state.component';
import { EmptyStateComponent }   from '@shared/components/empty-state.component';
import { LicenseSaasService }    from './optimize-2.services';
import { formatCurrency }        from '@lib/chart-defaults';
import {
  type LicenseEntitlementRow,
  type LicenseCompliance,
  type LicenseType,
  type LicenseGroup,
  LICENSE_COMPLIANCE_OPTIONS,
  LICENSE_TYPE_OPTIONS,
  LICENSE_GROUP_OPTIONS,
} from '@shared/types/license-saas.types';

@Component({
  selector: 'app-license-saas',
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
  templateUrl: './license-saas.component.html',
  styleUrl:    './license-saas.component.scss',
})
export class LicenseSaasComponent {
  readonly #svc   = inject(LicenseSaasService);
  readonly #title = inject(Title);
  #gridApi?: GridApi<LicenseEntitlementRow>;

  constructor() { this.#title.setTitle('License & SaaS · FinOps'); }

  readonly searchText       = signal<string>('');
  readonly complianceFilter = signal<LicenseCompliance[]>([]);
  readonly typeFilter       = signal<LicenseType[]>([]);
  readonly groupFilter      = signal<LicenseGroup[]>([]);
  readonly loadError        = signal<string | null>(null);

  readonly complianceOptions = LICENSE_COMPLIANCE_OPTIONS;
  readonly typeOptions       = LICENSE_TYPE_OPTIONS;
  readonly groupOptions      = LICENSE_GROUP_OPTIONS;

  readonly #query = computed(() => ({
    search:     this.searchText() || undefined,
    compliance: this.complianceFilter().length ? this.complianceFilter() : undefined,
    type:       this.typeFilter().length       ? this.typeFilter()       : undefined,
    group:      this.groupFilter().length      ? this.groupFilter()      : undefined,
  }));

  readonly listResponse = toSignal(
    toObservable(this.#query).pipe(
      switchMap(q =>
        this.#svc.list(q).pipe(
          startWith(null),
          catchError(err => { this.loadError.set(err.title ?? 'Unable to load license data'); return of(null); }),
        ),
      ),
    ),
    { initialValue: null },
  );
  readonly summary = toSignal(this.#svc.summary().pipe(catchError(() => of(null))), { initialValue: null });

  readonly isLoading  = computed(() => this.listResponse() === null && this.loadError() === null);
  readonly hasData    = computed(() => this.listResponse() !== null);
  readonly rows       = computed(() => this.listResponse()?.data ?? []);
  readonly total      = computed(() => this.listResponse()?.pagination.total ?? 0);
  readonly hasRows    = computed(() => this.rows().length > 0);
  readonly hasFilters = computed(() =>
    !!this.searchText() || this.complianceFilter().length > 0 || this.typeFilter().length > 0 || this.groupFilter().length > 0);

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

  readonly colDefs: ColDef<LicenseEntitlementRow>[] = [
    {
      field: 'vendor', headerName: 'Product', minWidth: 220, flex: 2,
      cellRenderer: (p: ICellRendererParams<LicenseEntitlementRow>) => {
        const r = p.data!;
        return `<div class="lic-cell">
          <span class="lic-vendor">${this.#e(r.vendor)}</span>
          <span class="lic-product">${this.#e(r.product)}</span>
        </div>`;
      },
    },
    {
      field: 'licenseType', headerName: 'Type', maxWidth: 160,
      cellRenderer: (p: ICellRendererParams<LicenseEntitlementRow>) =>
        `<span class="type-chip type-${(p.value as string).toLowerCase().replace(/_/g,'-')}">${this.#e((p.value as string).replace(/_/g,' '))}</span>`,
    },
    {
      field: 'complianceStatus', headerName: 'Compliance', maxWidth: 155,
      cellRenderer: (p: ICellRendererParams<LicenseEntitlementRow>) => {
        const vm: Record<string, string> = { Compliant:'success', Over_Deployed:'danger', Under_Deployed:'warning', True_Up_Risk:'danger', Unknown:'neutral' };
        return `<span class="status-badge ${vm[p.value as string] ?? 'neutral'}">${this.#e((p.value as string).replace(/_/g,' '))}</span>`;
      },
    },
    {
      field: 'utilizationPct', headerName: 'Utilisation', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<LicenseEntitlementRow>) => {
        const v = p.value as number;
        const cls = v > 100 ? 'util-over' : v >= 80 ? 'util-ok' : v >= 50 ? 'util-warn' : 'util-low';
        return `<div class="util-cell">
          <div class="util-track"><div class="util-fill ${cls}" style="width:${Math.min(v, 100)}%"></div></div>
          <span class="util-label ${cls}">${v.toFixed(1)}%</span>
        </div>`;
      },
    },
    {
      field: 'annualCostSar', headerName: 'Annual cost', maxWidth: 160, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<LicenseEntitlementRow>) =>
        `<span class="amount-cell">${formatCurrency(p.value as number, { code: p.data!.currency })}</span>`,
    },
    {
      field: 'wasteAmount', headerName: 'Waste', maxWidth: 140, type: 'numericColumn',
      cellRenderer: (p: ICellRendererParams<LicenseEntitlementRow>) => {
        const v = p.value as number;
        if (v === 0) return `<span class="waste-zero">—</span>`;
        return `<span class="waste-cell">${formatCurrency(v, { code: p.data!.currency })}</span>`;
      },
    },
    {
      field: 'contractEndDate', headerName: 'Contract end', minWidth: 130,
      cellRenderer: (p: ICellRendererParams<LicenseEntitlementRow>) => {
        if (!p.value) return `<span class="no-date">Perpetual</span>`;
        const days = p.data!.renewalAlertDays;
        const cls  = days !== null && days <= 90 ? 'renewal-urgent' : days !== null && days <= 180 ? 'renewal-warn' : '';
        const label = new Date(p.value as string).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' });
        return `<span class="contract-date ${cls}">${this.#e(label)}</span>`;
      },
    },
    {
      field: 'group', headerName: 'Group', maxWidth: 130,
      cellRenderer: (p: ICellRendererParams<LicenseEntitlementRow>) => {
        const vm: Record<string, string> = { Quick_Win:'grp-qw', Strategic:'grp-st', Housekeeping:'grp-hk' };
        return `<span class="group-pill ${vm[p.value as string] ?? ''}">${this.#e((p.value as string).replace('_',' '))}</span>`;
      },
    },
    {
      field: 'ahbApplied', headerName: 'AHB', maxWidth: 70,
      cellRenderer: (p: ICellRendererParams<LicenseEntitlementRow>) => {
        const r = p.data!;
        if (r.byolEligible && !r.ahbApplied) return `<span class="ahb-missed" aria-label="AHB not applied — opportunity">⚠ AHB</span>`;
        if (r.ahbApplied) return `<span class="ahb-applied" aria-label="Azure Hybrid Benefit applied">✓ AHB</span>`;
        return `<span class="ahb-na" aria-label="Not applicable">—</span>`;
      },
    },
  ];

  onGridReady(e: GridReadyEvent<LicenseEntitlementRow>) { this.#gridApi = e.api; }

  onSearchChange(v: string | null | undefined)        { this.searchText.set(v ?? ''); }
  toggleComplianceFilter(c: LicenseCompliance)        { this.complianceFilter.update(f => f.includes(c) ? f.filter(x => x !== c) : [...f, c]); }
  toggleTypeFilter(t: LicenseType)                    { this.typeFilter.update(f => f.includes(t) ? f.filter(x => x !== t) : [...f, t]); }
  toggleGroupFilter(g: LicenseGroup)                  { this.groupFilter.update(f => f.includes(g) ? f.filter(x => x !== g) : [...f, g]); }
  clearFilters() { this.searchText.set(''); this.complianceFilter.set([]); this.typeFilter.set([]); this.groupFilter.set([]); }
  exportCsv()   { this.#gridApi?.exportDataAsCsv({ fileName: 'licenses.csv' }); }

  readonly retry = () => { this.loadError.set(null); };
  #e(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
