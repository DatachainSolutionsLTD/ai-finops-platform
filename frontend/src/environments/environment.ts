// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// ─────────────────────────────────────────────────────────────────────────────
// Environment configuration.
// Location: apps/frontend/src/environments/environment.ts
//
// Per 05_API_Conventions.md §2, every frontend service reads from this config.
// Never hardcode URLs or other environment-dependent values in components.
// ─────────────────────────────────────────────────────────────────────────────

export interface Environment {
  /** 'production' | 'staging' | 'dev' | 'local' */
  name: 'production' | 'staging' | 'dev' | 'local';

  /** Base URL for all API calls, including version segment */
  apiBaseUrl: string;

  /** Whether this is a production build (enables optimizations, disables devtools) */
  production: boolean;

  /** Short ISO build id for correlation with backend deployments */
  buildId: string;

  /** Design system version this build was compiled against */
  designSystemVersion: string;

  /** Whether to surface debug banners, version chips, etc. */
  showDevTools: boolean;
}

export const environment: Environment = {
  name: 'dev',
  apiBaseUrl: 'https://api.dev.example.com/v1',
  production: false,
  buildId: 'dev-local',
  designSystemVersion: '1.1',
  showDevTools: true,
};
