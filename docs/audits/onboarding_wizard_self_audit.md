# Tenant Onboarding Wizard — Wizard Pattern Exemplar Self-Audit

**Screen:** Tenant Onboarding (Wizard pattern)
**Route:** `/onboarding/new`
**Role:** Platform_Admin only
**Pattern:** Wizard (per `02_Component_Pattern_Library.md §3.4`)
**Generated:** 2026-04-13
**Model used:** Opus 4.6 (per model allocation §3.1)
**Design System Version:** v1.1
**Screen #** 4 of 58 · **Final reference exemplar**

---

## Files delivered

| File | Purpose | Location |
|---|---|---|
| `onboarding.types.ts` | Step enum, per-step DTOs, full draft shape | `libs/shared/src/lib/types/` |
| `onboarding.service.ts` | Draft persist + submit + availability check | `apps/frontend/src/app/features/onboarding/` |
| `onboarding-wizard.component.ts` | Standalone component + guard | `apps/frontend/src/app/features/onboarding/` |
| `onboarding-wizard.component.html` | Template with 7 step bodies | `apps/frontend/src/app/features/onboarding/` |
| `onboarding-wizard.component.scss` | Styles (tokens only) | `apps/frontend/src/app/features/onboarding/` |
| `onboarding_wizard_preview.html` | Static visual preview | `/mnt/user-data/outputs/` |

---

## Pattern composition (Wizard §3.4)

- [x] PageHeader with header actions slot (Save & Exit + Cancel)
- [x] WizardStepper component below PageHeader showing all 7 steps with status (complete/active/upcoming)
- [x] Active step body rendered in a single card
- [x] Navigation footer at bottom with progress indicator + Back/Continue buttons
- [x] Final step (Review) shows summary of all prior steps with inline Edit links
- [x] Final step submit button is distinct (primary + rocket icon + "Provision tenant") vs the Continue button on other steps

## New conventions established by this exemplar

Rolling into pattern library v1.1 as Wizard pattern refinements:

1. **Stepper with 3 states per step** — complete (green checkmark), active (brand-primary number), upcoming (grey number). Horizontal layout on desktop, horizontally scrollable on mobile.

2. **Per-step validation gates Next button** — cannot proceed until current step's FormGroup is valid. `currentStepValid` computed signal drives button enablement.

3. **Clickable back-navigation to completed steps** — users can jump to any completed step to edit, but cannot skip ahead to upcoming steps. Implemented via `jumpToStep()` with a status check.

4. **Draft auto-save on step advance** — `saveDraft()` called before every step transition. Tiny saving indicator shows in the footer during in-flight save. Draft persists server-side so user can resume if they close the browser.

5. **Save & Exit** — explicit button in PageHeader actions to save current state and leave. Distinct from Cancel (which discards).

6. **Cancel with confirmation** — IonAlert with "Keep editing" vs "Discard draft" choice. Destructive action clearly labeled.

7. **Async availability check with debounce** — tenant code validation hits backend after 450ms debounce + distinctUntilChanged. Shows inline success ("AVAILABLE") or error with suggestion chips the user can click to auto-fill.

8. **Suggestion chips for invalid values** — when a value is rejected (taken tenant code), backend returns suggested alternatives rendered as clickable mono-font pills.

9. **Integration selection grid** — cards with icon + name + category, click to toggle, selected state uses brand-primary border and subtle background, corner checkmark icon. Pattern for any multi-select-from-catalog step.

10. **Review step as a separate step 7** — not a modal, not a sidebar. Full-width step with sectioned summary + per-section Edit links that jump back to that step.

11. **Provision button with rocket icon** — the final action button is visually distinct from the Continue button used on all other steps. Rocket icon signals "launch."

12. **Submit note above action footer** — warning-tinted info box reminds user that submit is not easily reversible.

13. **Progress indicator in footer** — "Step 3 of 7" text reminds users of position. Also shows saving indicator when draft save is in-flight.

14. **ngOnInit + ngOnDestroy lifecycle** — the only place in the 4 exemplars we use these Angular lifecycle hooks, because the debounced async validation needs a `takeUntil(destroy$)` teardown. Signal-driven patterns don't need it, but RxJS subscriptions with component lifetime do.

## What this completes

**All 4 pattern exemplars now generated:**

| # | Pattern | Exemplar | Screen count using this pattern |
|---|---|---|---|
| 1 | Dashboard | Platform Health | 15 |
| 2 | List | Tenant Management | 28 |
| 3 | Detail/Edit | Organization Settings | 6 |
| 4 | Wizard | Tenant Onboarding | 1-3 additional wizards may exist (auth flow, bulk import) |

Every remaining UI screen pattern-matches against one of these four exemplars. Per the model allocation guide, Sonnet 4.6 can now take over for the remaining 54 screens with high confidence.

## Next step

**Decision point.** With all 4 exemplars complete, the options are:

**A.** Pattern library v1.2 consolidation — update `02_Component_Pattern_Library.md` to capture the 30+ new conventions established across the 4 exemplars. This is the right moment for it.

**B.** Platform component implementations — generate the 8 shared components (PageHeader, KpiCard, WizardStepper, StatusBadge, NarrativeBlock, TimeRangeSelector, LoadingState, EmptyState) that all 58 screens consume. Currently assumed to exist.

**C.** Infrastructure files — AuthService, guards, TenantContextService, ErrorService, envelope types, environment config. Also assumed.

**D.** Begin persona batches with Sonnet 4.6 — start churning through the remaining 54 screens.

My recommendation is **A → B → C → D in that order**. Consolidating the patterns captures the learning, then the components realize them, then infrastructure enables them, then Sonnet can scale confidently against the complete foundation.
