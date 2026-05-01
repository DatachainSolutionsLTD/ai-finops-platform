# Tenant Management List — List Pattern Exemplar Self-Audit

**Screen:** Tenant Management (List pattern)
**Route:** `/platform/tenants`
**Role:** Platform_Admin only
**Pattern:** List / Grid (per `02_Component_Pattern_Library.md §3.2`)
**Generated:** 2026-04-13
**Model used:** Opus 4.6 (per model allocation §3.1)
**Design System Version:** v1.1
**Screen #** 2 of 58

---

## Files delivered

| File | Purpose | Location |
|---|---|---|
| `tenant-management.types.ts` | Shared DTOs | `libs/shared/src/lib/types/` |
| `tenant-management.service.ts` | Data service with filter/sort/paginate | `apps/frontend/src/app/features/platform/tenants/` |
| `tenant-list.component.ts` | Standalone component | `apps/frontend/src/app/features/platform/tenants/` |
| `tenant-list.component.html` | Template | `apps/frontend/src/app/features/platform/tenants/` |
| `tenant-list.component.scss` | Styles (tokens only) | `apps/frontend/src/app/features/platform/tenants/` |
| `tenant_list_preview.html` | Static visual preview | `/mnt/user-data/outputs/` |

---

## Contract compliance checklist

### Session opening and framework

- [x] Loaded `01_Design_Tokens_Specification.md` v1.1 at session start
- [x] Loaded `02_Component_Pattern_Library.md` at session start
- [x] Loaded `03_UI_Generation_Contract.md` v1.1 at session start
- [x] Loaded `05_API_Conventions.md`, `06_Authentication_Flow.md`, `07_Navigation_Structure.md`
- [x] Identified pattern: List / Grid

### Pattern composition (List §3.2)

- [x] PageHeader is the first element of the screen with primary CTA (Add tenant)
- [x] Filter/Search toolbar directly below PageHeader
- [x] AG Grid occupies remaining viewport height
- [x] Pagination at the bottom with 20-row default and size selector [10, 20, 50, 100]
- [x] Status columns use StatusBadgeComponent, not inline colored text
- [x] Empty state (EmptyState component) replaces grid when zero rows
- [x] Added enhancement: summary stat row above filter toolbar (recommended for any List with aggregate numbers worth surfacing)

### Three-state handling

- [x] LoadingState rendered while data is loading (skeleton variant per EmptyState/LoadingState §2.8)
- [x] Error state rendered via EmptyState with Retry action
- [x] Empty state with no rows — first-time empty ("No tenants yet") vs filter-empty ("No tenants match your filters") — both handled distinctly with appropriate CTAs

### Tokens and styling

- [x] Every color in SCSS is a CSS variable — verified no hex literals
- [x] Every spacing value is a `--finops-space-*` token
- [x] Every font size is a `--finops-text-*` token
- [x] Every border radius is a `--finops-radius-*` token
- [x] Every shadow is a `--finops-shadow-*` token
- [x] IBM Plex Sans Condensed used via `--finops-font-family`
- [x] No pure black `#000000` — `--finops-text-primary` (`#262626`) used
- [x] No bright saturated web-tech colors anywhere

### AG Grid configuration (per 01 §11)

- [x] `defaultColDef` has sortable, filter, resizable, flex, minWidth
- [x] Pagination enabled, page size 20, selector [10, 20, 50, 100]
- [x] `animateRows` enabled
- [x] `class="ag-theme-quartz"` applied
- [x] Status column uses `StatusBadgeComponent` as cellRenderer
- [x] Currency column uses `formatCurrency(value, { code })` — per-row currency from data
- [x] Numeric columns right-aligned via `type: 'numericColumn'`
- [x] Multi-row selection with checkbox column pinned-left
- [x] Row click navigates to detail; checkbox column excluded via suppressRowClickSelection
- [x] Action column pinned-right with chevron indicator
- [x] CSV export action available

### List-specific enhancements beyond §3.2

The exemplar adds these patterns beyond the minimum specified in the pattern library. These should be **added to the pattern library as refinements** if accepted:

1. **Summary stat row above filter toolbar** — 5 key metrics in a single card. Useful for any List with aggregate numbers worth surfacing (budgets, alerts, governance violations, chargeback statements, etc.). Proposed addition to pattern library §3.2.

2. **Filter chip buttons with count badges** — multi-select filters via popover, with active count shown in a pill on the button. Pattern: `[Status 1]` means one status filter is active. Proposed as the standard filter UI for all List screens.

3. **Active filter chips row** — visible confirmation of what filters are currently applied, each clickable to remove. Better UX than hiding the filter state inside popovers.

4. **Bulk action bar** — appears only when rows are selected. Fixed position near the top of the grid card. Shows selection count, offers bulk actions scoped by user permissions. Standard pattern for any List with bulk operations.

5. **Quota progress bar cell renderer** — visual progress indicator for percentage columns with severity tier (normal/warning/danger) based on threshold. Useful for budget consumption, quota consumption, SLA compliance etc.

6. **Tier pill cell renderer** — small uppercase pill for categorical data that isn't a status (Tier, Plan, Region classification). Distinct visual language from StatusBadge.

7. **Billing status badge** — reuses StatusBadgeComponent with a semantic mapping table (Current → success, Trial → info, Grace_Period → warning, Overdue → danger). Shows how to adapt StatusBadge for domain-specific status taxonomies.

8. **Two empty states** — "No tenants yet" (true empty) and "No tenants match your filters" (filter-induced empty) with different CTAs. Proposed as standard for all filterable List screens.

### Code style (per 03 §6)

- [x] `inject()` for all DI
- [x] `toSignal()` + `toObservable()` for reactive data
- [x] `switchMap` on query signal (re-fires on any filter change)
- [x] Standalone component with explicit `imports` array
- [x] `ChangeDetectionStrategy.OnPush`
- [x] `readonly` on all services and signal declarations
- [x] `#private` for internal helpers
- [x] No `any` in method signatures (two `$any()` casts in template for Ionic event typing — acceptable)

### Accessibility

- [x] Icon-only buttons have `aria-label`
- [x] Search bar has `aria-label`
- [x] Bulk action bar has `role="toolbar"` and `aria-label`
- [x] Filter chips have `role="group"` and `aria-label`
- [x] Active filter chips section has `aria-label`
- [x] Summary row has `aria-label`
- [x] Filter popovers use `<ion-checkbox>` with `aria-label`
- [x] Critical pill has `aria-label` describing count
- [x] Row action button has `aria-label`
- [x] Color contrast: all text meets WCAG AA

### Responsive behavior

- [x] Summary row: 5 cols → 3 cols (<992px) → 2 cols (<576px)
- [x] Filter toolbar wraps gracefully
- [x] Bulk action bar stacks vertically on mobile
- [x] Tenant name column pinned-left so it stays visible when horizontally scrolling
- [x] Action column pinned-right so the "open" chevron stays reachable

### API and data

- [x] Service follows `05_API_Conventions.md §11` pattern
- [x] Shared DTOs in `libs/shared/src/lib/types/tenant-management.types.ts`
- [x] Envelope types used (`ListResponse<T>`, `SingleResponse<T>`)
- [x] Money values use `{ amount: string, currency: string }` shape
- [x] Filter state correctly maps to backend query params per §4.2
- [x] Bulk action includes Idempotency-Key header note (§8.2)
- [x] Service includes real-API swap comments in method docblocks

### Currency and tenant context

- [x] Each row carries its own currency code — 7 different currencies represented in mock data (AED, USD, GBP, EUR, JPY, SGD)
- [x] `formatCurrency(value, { code: row.spendThisMonth.currency })` resolves per row
- [x] Never a hardcoded currency symbol in template or component

### Auth and routing

- [x] Route will be protected by `authGuard + roleGuard('Platform_Admin')` (configured in platform routes, already delivered with screen 1)
- [x] Create tenant button gated on `canCreateTenant` permission check
- [x] Bulk Suspend gated on `canBulkSuspend`
- [x] Bulk Archive gated on `canBulkArchive`
- [x] Row click navigates to `/platform/tenants/:id` (target route for Detail pattern — screen 3)

### Version binding

- [x] Every generated file contains the v1.1 header comment dated 2026-04-13

---

## New conventions established by this exemplar (for pattern library v1.1 update)

These should be rolled into `02_Component_Pattern_Library.md` as refinements to §3.2 List pattern:

1. **Summary stat row** — optional element between PageHeader and filter toolbar for aggregate metrics. 3-6 stats arranged in a horizontal card. Each stat is `{label, value, optional color variant}`. When to use: whenever the list has platform-level metrics worth surfacing (totals, active counts, warning counts).

2. **Filter chip buttons with badges** — standardized filter affordance. Each filter type is a button with icon + label + active count. Clicking opens a popover with checkboxes for multi-select. Three filters typical, four maximum.

3. **Active filter chips** — a visible row of pill chips showing currently-applied filters. Each chip has an X to remove. Visible whenever any filter is active. Hidden when no filters applied. Position: between filter toolbar and grid.

4. **Bulk action bar** — fixed-height bar that appears only when rows are selected. Position: between filters (or active chips) and grid card. Shows count, permission-gated action buttons, uses brand-primary-subtle background so it's distinct from the grid below.

5. **Cell renderers for common patterns** — document these reusable cell renderer functions:
   - `tenantCell` — two-line compound cell (primary name + monospace code/meta)
   - `tierPill` — uppercase categorical pill
   - `quotaCell` — progress bar + percentage with severity tiering
   - `criticalPill` vs `criticalZero` — conditional pill for count columns

6. **Destructive action confirmation via IonAlert** — for bulk Suspend, Archive, Delete. Use IonAlert (native dialog) with optional textarea input for reason. Not a nested modal because IonAlert is a system-level dialog.

7. **Two-variant empty state** — "no data yet" vs "no matches for current filters" — different copy and different CTAs.

---

## Design decisions worth noting for future List screens

1. **Reactive query signal pattern** — `query = computed<TenantListQuery>(...)` from all filter signals, then `toObservable(query).pipe(switchMap(...))`. This means any filter change automatically re-fetches. Every List screen should follow this pattern.

2. **Per-row currency rendering** — because tenants can have different primary currencies, every currency cell must use `formatCurrency(amount, { code: row.currency })`. This is the platform-wide multi-currency pattern.

3. **Row click → detail navigation, checkbox click → selection** — achieved via `suppressRowClickSelection: true` + a target check in `onRowClicked` that ignores clicks in the checkbox column. Standard pattern for selectable List screens.

4. **CSV export respects column visibility** — `gridApi.exportDataAsCsv({ columnKeys: [...] })` excludes action columns and internal fields. Standard pattern.

5. **Permission-gated bulk actions** — the bulk action bar only shows buttons the current user has permissions for. Matches `03 §3 rule 19` ARIA + `06 Auth §7 hasPermission()` pattern.

---

## Preview

Open `tenant_list_preview.html` in a browser to see the rendered List pattern with:
- Working search (filters the grid live)
- Sortable columns
- Multi-row selection (3 rows pre-selected to demonstrate bulk action bar)
- Sticky tenant name + action columns
- Real mock data with 15 tenants in 6 different currencies
- Full responsive layout at desktop width

---

## Readiness for scaling to the remaining List screens

The exemplar establishes the complete template for the 27 other List-pattern screens in the navigation structure. Subsequent sessions (using Sonnet 4.6 per model allocation) should:

1. Pattern-match structurally against this component
2. Swap out the domain (tenant → budget, recommendation, alert, etc.)
3. Swap out the filter taxonomy (status/tier/region → whatever fits the domain)
4. Swap out the summary stats if applicable
5. Swap out the bulk actions if applicable
6. Keep all other conventions identical (grid config, cell renderers, token usage, three-state handling, accessibility)

Expected fidelity loss: minimal. The domain variations are the only meaningful delta between List screens.

---

## Next step

Generate screen 3 (Detail/Edit pattern) using `/admin/organization` — tenant settings with form sections, validation, save/cancel flow, dirty-state warning. Continues with Opus 4.6 per model allocation.
