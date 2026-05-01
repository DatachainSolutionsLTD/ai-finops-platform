// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/platform/features/feature-flags.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import {
  type FeatureFlagListQuery,
  type FeatureFlagListResponse,
  type FeatureFlagListSummary,
} from '@shared/types/feature-flags.types';
import { environment } from '@env/environment';

const MOCK: FeatureFlagListResponse = {
  data: [
    { flagId:'ff-001', key:'agent.gpu_optimizer.enabled',           name:'GPU Optimizer Agent',           description:'Enable the GPU Optimizer Agent (A16) for all tenants.',                    category:'Agent',        enabled:true,  audience:'All',           rolloutPct:100, updatedBy:'Ahmed Hassan', updatedAt:'2025-03-15T10:00:00Z' },
    { flagId:'ff-002', key:'agent.sustainability.enabled',          name:'Sustainability Agent',           description:'Enable the Sustainability Agent (A14) — currently in beta.',               category:'Agent',        enabled:false, audience:'Beta',          rolloutPct:0,   updatedBy:'Sara Ali',    updatedAt:'2025-04-01T09:00:00Z' },
    { flagId:'ff-003', key:'agent.continuous_learning.enabled',     name:'Continuous Learning Agent',      description:'Enable the Continuous Learning Agent (A32).',                             category:'Agent',        enabled:true,  audience:'All',           rolloutPct:100, updatedBy:'Ahmed Hassan', updatedAt:'2025-02-10T11:00:00Z' },
    { flagId:'ff-004', key:'ui.executive_dashboard.enabled',        name:'Executive Dashboard',            description:'Enable the new executive summary dashboard.',                             category:'UI',           enabled:true,  audience:'Executive',     rolloutPct:100, updatedBy:'Omar Khalid',  updatedAt:'2025-01-20T14:00:00Z' },
    { flagId:'ff-005', key:'ui.dark_mode.enabled',                  name:'Dark Mode',                     description:'Allow users to switch to dark mode in the UI.',                           category:'UI',           enabled:false, audience:'Internal',      rolloutPct:0,   updatedBy:'Sara Ali',    updatedAt:'2025-04-05T16:00:00Z' },
    { flagId:'ff-006', key:'api.bulk_allocation.enabled',           name:'Bulk Allocation API',            description:'Enable bulk allocation API endpoints for high-volume processing.',         category:'API',          enabled:true,  audience:'All',           rolloutPct:100, updatedBy:'Ahmed Hassan', updatedAt:'2025-03-01T08:00:00Z' },
    { flagId:'ff-007', key:'billing.chargeback_v2.enabled',         name:'Chargeback Engine v2',           description:'Use the rewritten chargeback engine (A22 v2).',                          category:'Billing',      enabled:false, audience:'Beta',          rolloutPct:20,  updatedBy:'Fatima Jaber', updatedAt:'2025-04-10T15:00:00Z' },
    { flagId:'ff-008', key:'security.ip_allowlist.enabled',         name:'IP Allowlist Enforcement',       description:'Enforce IP allowlist from platform settings for all API calls.',          category:'Security',     enabled:true,  audience:'Platform_Admin', rolloutPct:100, updatedBy:'Ahmed Hassan', updatedAt:'2025-03-20T09:00:00Z' },
    { flagId:'ff-009', key:'experimental.ai_recommendations.enabled',name:'AI Cost Recommendations',       description:'Enable AI-powered cost recommendation suggestions (experimental).',       category:'Experimental', enabled:false, audience:'Internal',      rolloutPct:0,   updatedBy:'Sara Ali',    updatedAt:'2025-04-12T17:00:00Z' },
    { flagId:'ff-010', key:'agent.hitl.enabled',                    name:'Human-in-the-Loop Agent',        description:'Enable the HITL agent (A30) for approval workflows.',                    category:'Agent',        enabled:true,  audience:'All',           rolloutPct:100, updatedBy:'Ahmed Hassan', updatedAt:'2025-01-15T10:00:00Z' },
    { flagId:'ff-011', key:'ui.cost_explorer_v2.enabled',           name:'Cost Explorer v2',               description:'Enable the redesigned cost explorer with improved filtering.',            category:'UI',           enabled:true,  audience:'FinOps_Analyst', rolloutPct:100, updatedBy:'Omar Khalid',  updatedAt:'2025-02-28T11:00:00Z' },
    { flagId:'ff-012', key:'experimental.predictive_scaling.enabled',name:'Predictive Scaling Insights',   description:'Show ML-driven predictive scaling recommendations in the UI.',            category:'Experimental', enabled:false, audience:'Internal',      rolloutPct:0,   updatedBy:'Sara Ali',    updatedAt:'2025-04-11T13:00:00Z' },
  ],
  pagination: { total: 12, page: 0, limit: 20 },
};

const MOCK_SUMMARY: FeatureFlagListSummary = { total: 12, enabled: 7, disabled: 4, partial: 1 };

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  readonly #http = inject(HttpClient);

  // SWAP TO REAL: return this.#http.get<FeatureFlagListResponse>(`${environment.apiUrl}/platform/features`, { params })
  list(query: FeatureFlagListQuery): Observable<FeatureFlagListResponse> {
    return of(MOCK).pipe(delay(500));
  }

  // SWAP TO REAL: return this.#http.get<FeatureFlagListSummary>(`${environment.apiUrl}/platform/features/summary`)
  summary(): Observable<FeatureFlagListSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }

  // SWAP TO REAL: return this.#http.patch<void>(`${environment.apiUrl}/platform/features/${flagId}`, { enabled })
  setEnabled(flagId: string, enabled: boolean): Observable<void> {
    return of(undefined as void).pipe(delay(300));
  }
}
