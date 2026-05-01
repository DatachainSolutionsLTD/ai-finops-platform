// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/platform/agents/agent-config.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';

import {
  type AgentListQuery,
  type AgentListResponse,
  type AgentListSummary,
  type AgentDetail,
  type AgentConfigPatch,
} from '@shared/types/agent-config.types';
import { environment } from '@env/environment';

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_AGENTS: AgentListResponse = {
  data: [
    { agentId:'A01', agentCode:'DI-01',  displayName:'Data Ingestion Agent',          category:'Ingestion',      status:'Running',  autonomyLevel:'L4', version:'2.4.1', lastRunAt: new Date(Date.now()-600_000).toISOString(),   lastRunStatus:'Success', avgRunDurationSec:142, pendingJobCount:3,  errorCount24h:0,  enabled:true  },
    { agentId:'A02', agentCode:'DI-02',  displayName:'Cost Normalization Agent',       category:'Normalization',  status:'Running',  autonomyLevel:'L4', version:'2.3.0', lastRunAt: new Date(Date.now()-720_000).toISOString(),   lastRunStatus:'Success', avgRunDurationSec:210, pendingJobCount:2,  errorCount24h:0,  enabled:true  },
    { agentId:'A03', agentCode:'AL-01',  displayName:'Allocation Agent',              category:'Analytics',      status:'Idle',     autonomyLevel:'L3', version:'2.1.0', lastRunAt: new Date(Date.now()-3600_000).toISOString(),  lastRunStatus:'Success', avgRunDurationSec:88,  pendingJobCount:0,  errorCount24h:0,  enabled:true  },
    { agentId:'A04', agentCode:'RA-04',  displayName:'Reporting & Analytics Agent',   category:'Analytics',      status:'Running',  autonomyLevel:'L4', version:'2.2.3', lastRunAt: new Date(Date.now()-300_000).toISOString(),   lastRunStatus:'Success', avgRunDurationSec:65,  pendingJobCount:1,  errorCount24h:0,  enabled:true  },
    { agentId:'A05', agentCode:'AD-05',  displayName:'Anomaly Detection Agent',       category:'Analytics',      status:'Degraded', autonomyLevel:'L3', version:'1.9.2', lastRunAt: new Date(Date.now()-1800_000).toISOString(),  lastRunStatus:'Partial', avgRunDurationSec:320, pendingJobCount:5,  errorCount24h:12, enabled:true  },
    { agentId:'A06', agentCode:'FC-01',  displayName:'Forecasting Agent',             category:'Analytics',      status:'Idle',     autonomyLevel:'L3', version:'2.0.0', lastRunAt: new Date(Date.now()-7200_000).toISOString(),  lastRunStatus:'Success', avgRunDurationSec:540, pendingJobCount:0,  errorCount24h:0,  enabled:true  },
    { agentId:'A07', agentCode:'BG-01',  displayName:'Budget Guardian Agent',         category:'Governance',     status:'Running',  autonomyLevel:'L3', version:'1.8.1', lastRunAt: new Date(Date.now()-900_000).toISOString(),   lastRunStatus:'Success', avgRunDurationSec:44,  pendingJobCount:0,  errorCount24h:0,  enabled:true  },
    { agentId:'A08', agentCode:'BM-08',  displayName:'Benchmarking Agent',            category:'Analytics',      status:'Idle',     autonomyLevel:'L2', version:'1.5.0', lastRunAt: new Date(Date.now()-86400_000).toISOString(), lastRunStatus:'Success', avgRunDurationSec:680, pendingJobCount:0,  errorCount24h:0,  enabled:true  },
    { agentId:'A20', agentCode:'GOV-01', displayName:'Governance Agent',              category:'Governance',     status:'Running',  autonomyLevel:'L4', version:'2.1.0', lastRunAt: new Date(Date.now()-1200_000).toISOString(),  lastRunStatus:'Success', avgRunDurationSec:95,  pendingJobCount:0,  errorCount24h:0,  enabled:true  },
    { agentId:'A27', agentCode:'OR-01',  displayName:'Orchestrator Agent',            category:'Platform',       status:'Running',  autonomyLevel:'L4', version:'3.0.0', lastRunAt: new Date(Date.now()-60_000).toISOString(),    lastRunStatus:'Success', avgRunDurationSec:12,  pendingJobCount:14, errorCount24h:0,  enabled:true  },
    { agentId:'A24', agentCode:'TH-24',  displayName:'Tagging Hygiene Agent',         category:'Governance',     status:'Idle',     autonomyLevel:'L3', version:'1.7.0', lastRunAt: new Date(Date.now()-10800_000).toISOString(), lastRunStatus:'Success', avgRunDurationSec:230, pendingJobCount:0,  errorCount24h:0,  enabled:true  },
    { agentId:'A16', agentCode:'GO-16',  displayName:'GPU Optimizer Agent',           category:'Optimization',   status:'Error',    autonomyLevel:'L2', version:'1.3.1', lastRunAt: new Date(Date.now()-5400_000).toISOString(),  lastRunStatus:'Failed',  avgRunDurationSec:480, pendingJobCount:0,  errorCount24h:3,  enabled:true  },
    { agentId:'A14', agentCode:'SU-01',  displayName:'Sustainability Agent',          category:'Analytics',      status:'Disabled', autonomyLevel:'L1', version:'1.0.0', lastRunAt: null,                                         lastRunStatus: null,     avgRunDurationSec:0,   pendingJobCount:0,  errorCount24h:0,  enabled:false },
    { agentId:'A32', agentCode:'CL-32',  displayName:'Continuous Learning Agent',     category:'Platform',       status:'Running',  autonomyLevel:'L4', version:'2.0.5', lastRunAt: new Date(Date.now()-3000_000).toISOString(),  lastRunStatus:'Success', avgRunDurationSec:870, pendingJobCount:1,  errorCount24h:0,  enabled:true  },
  ],
  pagination: { total: 14, page: 0, limit: 20 },
};

const MOCK_SUMMARY: AgentListSummary = {
  totalAgents:    14,
  runningAgents:  7,
  degradedAgents: 2,
  disabledAgents: 1,
  pendingJobs:    26,
};

const MOCK_DETAIL: AgentDetail = {
  ...MOCK_AGENTS.data[0],
  description: 'Ingests cost and usage data from cloud providers (AWS, Azure, GCP, OCI) and on-premises sources. Publishes ingestion completion events consumed by downstream agents.',
  configJson: JSON.stringify({ batchSize: 50000, maxRetries: 3, freshnessHours: 24, enableDeltaIngestion: true }, null, 2),
  scheduleExpression: '0 */6 * * *',
  retryLimit: 3,
  retryBackoffSec: 120,
  maxConcurrentJobs: 4,
  dependsOn: [],
  upstreamAgents: [],
  downstreamAgents: ['A02', 'A24'],
  tags: { environment: 'production', owner: 'platform-team' },
  etag: 'etag-abc123',
};

@Injectable({ providedIn: 'root' })
export class AgentConfigService {
  readonly #http = inject(HttpClient);

  // SWAP TO REAL: return this.#http.get<AgentListResponse>(`${environment.apiUrl}/platform/agents`, { params })
  list(query: AgentListQuery): Observable<AgentListResponse> {
    return of(MOCK_AGENTS).pipe(delay(600));
  }

  // SWAP TO REAL: return this.#http.get<AgentListSummary>(`${environment.apiUrl}/platform/agents/summary`)
  summary(): Observable<AgentListSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }

  // SWAP TO REAL: return this.#http.get<AgentDetail>(`${environment.apiUrl}/platform/agents/${agentId}`)
  getDetail(agentId: string): Observable<AgentDetail> {
    return of({ ...MOCK_DETAIL, agentId }).pipe(delay(400));
  }

  // SWAP TO REAL: return this.#http.patch<AgentDetail>(`${environment.apiUrl}/platform/agents/${agentId}`, patch, { headers: { 'If-Match': etag } })
  patch(agentId: string, patch: AgentConfigPatch, etag: string): Observable<AgentDetail> {
    return of({ ...MOCK_DETAIL, ...patch }).pipe(delay(700));
  }

  // SWAP TO REAL: return this.#http.post<void>(`${environment.apiUrl}/platform/agents/${agentId}/run`, {})
  triggerRun(agentId: string): Observable<void> {
    return of(undefined as void).pipe(delay(500));
  }

  // SWAP TO REAL: return this.#http.post<void>(`${environment.apiUrl}/platform/agents/${agentId}/disable`, {})
  disable(agentId: string): Observable<void> {
    return of(undefined as void).pipe(delay(500));
  }
}
