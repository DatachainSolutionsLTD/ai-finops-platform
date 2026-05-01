// FinOps Platform — Top-Level Route Configuration
// Connects all feature modules using lazy-loaded standalone components.

import type { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';

export const routes: Routes = [
  // ── Public: Auth ──
  { path: 'login',           loadComponent: () => import('@core/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'mfa',             loadComponent: () => import('@core/auth/mfa/mfa.component').then(m => m.MfaComponent) },
  { path: 'forgot-password', loadComponent: () => import('@core/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },

  // ── Protected: All feature routes ──
  {
    path: '',
    canActivate: [authGuard],
    children: [
      // Understand
      { path: '',                redirectTo: 'executive', pathMatch: 'full' },
      { path: 'executive',      loadComponent: () => import('@features/dashboard/executive-summary.component').then(m => m.ExecutiveSummaryComponent) },
      { path: 'dashboard',      loadComponent: () => import('@features/dashboard/my-dashboard.component').then(m => m.MyDashboardComponent) },
      { path: 'cost-explorer',  loadComponent: () => import('@features/cost-explorer/cost-explorer.component').then(m => m.CostExplorerComponent) },
      { path: 'ingestion',      loadComponent: () => import('@features/ingestion/ingestion-status.component').then(m => m.IngestionStatusComponent) },
      { path: 'reports',        loadComponent: () => import('@features/reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'anomalies',      loadComponent: () => import('@features/anomalies/anomalies.component').then(m => m.AnomaliesComponent) },

      // Quantify
      { path: 'allocations',    loadComponent: () => import('@features/allocations/allocations.component').then(m => m.AllocationsComponent) },
      { path: 'chargeback',     loadComponent: () => import('@features/chargeback/chargeback.component').then(m => m.ChargebackComponent) },
      { path: 'unit-economics', loadComponent: () => import('@features/unit-economics/unit-economics.component').then(m => m.UnitEconomicsComponent) },
      { path: 'benchmarking',   loadComponent: () => import('@features/benchmarking/benchmarking.component').then(m => m.BenchmarkingComponent) },

      // Optimize
      { path: 'recommendations',     loadComponent: () => import('@features/recommendations/recommendations.component').then(m => m.RecommendationsComponent) },
      { path: 'workload-optimizer',  loadComponent: () => import('@features/workload-optimizer/workload-optimizer.component').then(m => m.WorkloadOptimizerComponent) },
      { path: 'rate-optimizer',      loadComponent: () => import('@features/rate-optimizer/rate-optimizer.component').then(m => m.RateOptimizerComponent) },
      { path: 'gpu-optimizer',       loadComponent: () => import('@features/gpu-optimizer/gpu-optimizer.component').then(m => m.GpuOptimizerComponent) },
      { path: 'container-optimizer', loadComponent: () => import('@features/container-optimizer/container-optimizer.component').then(m => m.ContainerOptimizerComponent) },
      { path: 'network-optimizer',   loadComponent: () => import('@features/network-optimizer/network-optimizer.component').then(m => m.NetworkOptimizerComponent) },
      { path: 'storage-optimizer',   loadComponent: () => import('@features/storage-optimizer/storage-optimizer.component').then(m => m.StorageOptimizerComponent) },
      { path: 'architecture',        loadComponent: () => import('@features/architecture-advisor/architecture-advisor.component').then(m => m.ArchitectureAdvisorComponent) },
      { path: 'sustainability',      loadComponent: () => import('@features/sustainability/sustainability.component').then(m => m.SustainabilityComponent) },
      { path: 'license-saas',        loadComponent: () => import('@features/license-saas/license-saas.component').then(m => m.LicenseSaasComponent) },

      // Manage
      { path: 'forecasts',    loadComponent: () => import('@features/forecasts/forecasts.component').then(m => m.ForecastsComponent) },
      { path: 'budgets',      loadComponent: () => import('@features/budgets/budgets.component').then(m => m.BudgetsComponent) },
      { path: 'governance',   loadComponent: () => import('@features/governance/governance-policies.component_v2').then(m => m.GovernancePoliciesComponent) },
      { path: 'agent-config', loadComponent: () => import('@features/agent-config/agent-config.component').then(m => m.AgentConfigComponent) },
      { path: 'agent-activity', loadComponent: () => import('@features/agent-config/agent-activity.component').then(m => m.AgentActivityComponent) },
      { path: 'assessment',   loadComponent: () => import('@features/assessment/assessment.component').then(m => m.AssessmentComponent) },
      { path: 'onboarding',   loadComponent: () => import('@features/onboarding/onboarding-wizard.component').then(m => m.OnboardingWizardComponent) },
      { path: 'tagging',      loadComponent: () => import('@features/tagging/tagging-hygiene.component').then(m => m.TaggingHygieneComponent) },
      { path: 'education',    loadComponent: () => import('@features/education/education.component').then(m => m.EducationComponent) },

      // Coordinate
      { path: 'conflicts',     loadComponent: () => import('@features/conflicts/conflicts.component').then(m => m.ConflictsComponent) },
      { path: 'explanations',  loadComponent: () => import('@features/explanations/explanations.component').then(m => m.ExplanationsComponent) },

      // Platform
      { path: 'platform',          loadChildren: () => import('./platform-routes') },
      { path: 'billing',           loadComponent: () => import('@features/billing-metering/billing.component').then(m => m.BillingComponent) },
      { path: 'metering',          loadComponent: () => import('@features/billing-metering/metering-engine.component').then(m => m.MeteringEngineComponent) },
      { path: 'pricing',           loadComponent: () => import('@features/billing-metering/pricing-rate-cards.component').then(m => m.PricingRateCardsComponent) },
      { path: 'tenants',           loadComponent: () => import('@features/tenant-management/tenant-list.component').then(m => m.TenantListComponent) },
      { path: 'tenants/:id',       loadComponent: () => import('@features/tenant-management/tenant-detail.component').then(m => m.TenantDetailComponent) },
      { path: 'tenant-health',     loadComponent: () => import('@features/tenant-management/tenant-health.component').then(m => m.TenantHealthComponent) },
      { path: 'settings',          loadComponent: () => import('@features/platform/platform-settings.component').then(m => m.PlatformSettingsComponent) },
      { path: 'users',             loadComponent: () => import('@features/platform/platform-users.component').then(m => m.PlatformUsersComponent) },
      { path: 'users-roles',       loadComponent: () => import('@features/users-roles/users-roles.component_v2').then(m => m.UsersRolesComponent) },
      { path: 'notifications',     loadComponent: () => import('@features/notifications/notifications.component').then(m => m.NotificationsComponent) },
      { path: 'integrations',      loadComponent: () => import('@features/integrations/integrations.component').then(m => m.IntegrationsComponent) },
      { path: 'feature-flags',     loadComponent: () => import('@features/feature-flags/feature-flags.component').then(m => m.FeatureFlagsComponent) },
      { path: 'support',           loadComponent: () => import('@features/support/support-center.component').then(m => m.SupportCenterComponent) },
      { path: 'approvals',         loadComponent: () => import('@features/approvals/approvals-queue.component_v2').then(m => m.ApprovalsQueueComponent) },
      { path: 'audit',             loadComponent: () => import('@features/audit-console/audit-console.component').then(m => m.AuditConsoleComponent) },
      { path: 'compliance',        loadComponent: () => import('@features/compliance/compliance-reports.component').then(m => m.ComplianceReportsComponent) },
      { path: 'policy-violations', loadComponent: () => import('@features/policy-violations/policy-violations.component_v2').then(m => m.PolicyViolationsComponent) },
      { path: 'dsr',               loadComponent: () => import('@features/dsr-requests/dsr-requests.component_v2').then(m => m.DsrRequestsComponent) },
      { path: 'retention',         loadComponent: () => import('@features/retention-policies/retention-policies.component_v2').then(m => m.RetentionPoliciesComponent) },
      { path: 'legal-holds',       loadComponent: () => import('@features/legal-holds/legal-holds.component').then(m => m.LegalHoldsComponent) },
    ],
  },

  // Wildcard
  { path: '**', loadComponent: () => import('@features/platform/not-found.component').then(m => m.NotFoundComponent) },
];
