// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Platform component library — barrel export.
// Location: apps/frontend/src/app/shared/components/index.ts
//
// Every UI screen imports from this barrel, not from individual component files.
// This is the single source of truth for what components exist at the platform level.
// ─────────────────────────────────────────────────────────────────────────────

// PageHeader
export { PageHeaderComponent } from './page-header/page-header.component';
export type { Breadcrumb } from './page-header/page-header.component';

// KpiCard
export { KpiCardComponent } from './kpi-card/kpi-card.component';
export type { KpiStatus, KpiDeltaDirection } from './kpi-card/kpi-card.component';

// StatusBadge
export { StatusBadgeComponent } from './status-badge/status-badge.component';
export type { StatusVariant } from './status-badge/status-badge.component';

// NarrativeBlock
export { NarrativeBlockComponent } from './narrative-block/narrative-block.component';

// TimeRangeSelector
export { TimeRangeSelectorComponent } from './time-range-selector/time-range-selector.component';
export type { TimeRangeOption } from './time-range-selector/time-range-selector.component';

// WizardStepper
export { WizardStepperComponent } from './wizard-stepper/wizard-stepper.component';
export type { WizardStep, WizardStepStatus } from './wizard-stepper/wizard-stepper.component';

// LoadingState
export { LoadingStateComponent } from './loading-state/loading-state.component';
export type { LoadingVariant } from './loading-state/loading-state.component';

// EmptyState
export { EmptyStateComponent } from './empty-state/empty-state.component';
export type { EmptyStateAction } from './empty-state/empty-state.component';
