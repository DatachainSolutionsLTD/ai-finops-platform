-- =============================================================================
-- V019 — Wave 4b: A28 Conflict Resolution + A29 Explainability + A30 HITL
-- Sources: A28-FSD-CR-01, A29-FSD-EX-01, A30-FSD-HL-01
-- =============================================================================
-- Purpose: Agent coordination layer — these 3 agents handle cross-agent
-- interactions (conflicts between recommendations, human approval routing,
-- natural language explanations for all agent actions).
--
-- Reuses: gov_severity, opt_priority_tier, opt_confidence_level from prior waves
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- A28 Conflict Resolution
CREATE TYPE cr_conflict_type AS ENUM (
    'Contradictory_Actions', 'Resource_Contention', 'Objective_Tradeoff',
    'Circular_Dependency', 'Temporal_Overlap', 'Budget_Contention',
    'Instrument_Overlap', 'Policy_Collision'
);

CREATE TYPE cr_resolution_strategy AS ENUM (
    'Pareto_Optimal', 'Priority_Override', 'Weighted_Compromise',
    'Sequential_Execution', 'Escalate_To_Human', 'Defer_Both', 'Cancel_Lower'
);

CREATE TYPE cr_objective_category AS ENUM (
    'Cost_Reduction', 'Performance', 'Reliability', 'Sustainability',
    'Compliance', 'Security', 'User_Experience', 'Time_To_Market'
);

CREATE TYPE cr_resolution_status AS ENUM (
    'Detected', 'Analyzing', 'Proposed', 'Awaiting_Approval',
    'Resolved', 'Escalated', 'Abandoned'
);

-- A29 Explainability
CREATE TYPE ex_narrative_length AS ENUM (
    'One_Sentence', 'Short_Paragraph', 'Detailed_Explanation', 'Full_Report'
);

CREATE TYPE ex_explanation_scope AS ENUM (
    'Single_Action', 'Recommendation', 'Report_Section',
    'Anomaly_Alert', 'Workflow_Outcome', 'Forecast_Result', 'Variance_Analysis'
);

-- A30 HITL
CREATE TYPE hl_task_category AS ENUM (
    'Approval_Required', 'Review_Only', 'Decision_Between_Options',
    'Evidence_Request', 'Override_Verification', 'Dispute_Investigation',
    'Policy_Exception', 'Escalation'
);

CREATE TYPE hl_task_status AS ENUM (
    'Pending', 'Assigned', 'In_Review', 'Approved', 'Rejected',
    'Needs_More_Info', 'Escalated', 'Auto_Resolved', 'Expired', 'Cancelled'
);

CREATE TYPE hl_escalation_tier AS ENUM (
    'Tier_1_Owner', 'Tier_2_Manager', 'Tier_3_Director', 'Tier_4_Executive', 'Tier_5_Platform'
);

-- ============================================================================
-- A28 — CONFLICT RESOLUTION AGENT
-- ============================================================================

-- Objective weights per tenant (config-driven tradeoff preferences)
CREATE TABLE cr_objective_weight (
    weight_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    objective_category      cr_objective_category NOT NULL,
    weight_value            NUMERIC(5,4) NOT NULL,
    scope_dimension         VARCHAR(100),
    scope_dimension_key     VARCHAR(500),
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id),
    CONSTRAINT ck_weight_range CHECK (weight_value BETWEEN 0 AND 1),
    UNIQUE (tenant_id, objective_category, scope_dimension, scope_dimension_key, effective_from)
);
CREATE INDEX idx_cr_weight_tenant_active ON cr_objective_weight (tenant_id, objective_category) WHERE is_active;

-- Detected conflicts between agent recommendations
CREATE TABLE cr_conflict (
    conflict_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    conflict_type           cr_conflict_type NOT NULL,
    conflicting_agent_ids   UUID[] NOT NULL,
    conflicting_entity_refs JSONB NOT NULL,
    affected_resources      TEXT[],
    severity                gov_severity NOT NULL,
    priority                opt_priority_tier NOT NULL,
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    analysis_started_at     TIMESTAMPTZ,
    analysis_completed_at   TIMESTAMPTZ,
    status                  cr_resolution_status NOT NULL DEFAULT 'Detected',
    detection_summary       TEXT,
    financial_impact_amount NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id)
);
CREATE INDEX idx_cr_conflict_tenant_status ON cr_conflict (tenant_id, status);
CREATE INDEX idx_cr_conflict_priority ON cr_conflict (priority, detected_at DESC) WHERE status IN ('Detected', 'Analyzing');

-- Resolution proposals (may be multiple per conflict, pick best)
CREATE TABLE cr_resolution_proposal (
    proposal_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    conflict_id             UUID NOT NULL REFERENCES cr_conflict(conflict_id),
    strategy                cr_resolution_strategy NOT NULL,
    proposal_sequence       INTEGER NOT NULL,
    proposed_actions_json   JSONB NOT NULL,
    pareto_score            NUMERIC(7,4),
    objective_scores_json   JSONB,
    estimated_outcome_json  JSONB,
    is_pareto_optimal       BOOLEAN NOT NULL DEFAULT FALSE,
    confidence              opt_confidence_level NOT NULL,
    rationale               TEXT,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (conflict_id, proposal_sequence)
);
CREATE INDEX idx_cr_prop_conflict ON cr_resolution_proposal (conflict_id);
CREATE INDEX idx_cr_prop_pareto ON cr_resolution_proposal (conflict_id) WHERE is_pareto_optimal;

-- Resolution decision (which proposal was chosen)
CREATE TABLE cr_resolution_decision (
    decision_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    conflict_id             UUID NOT NULL REFERENCES cr_conflict(conflict_id),
    selected_proposal_id    UUID REFERENCES cr_resolution_proposal(proposal_id),
    decision_source         VARCHAR(50) NOT NULL,
    decided_by_agent_id     UUID REFERENCES agent_identity(agent_id),
    decided_by_user_id      UUID REFERENCES auth_user(user_id),
    hl_task_id              UUID,
    decision_notes          TEXT,
    executed_at             TIMESTAMPTZ,
    execution_status        VARCHAR(30) NOT NULL DEFAULT 'Pending',
    decided_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (conflict_id)
);
CREATE INDEX idx_cr_dec_tenant_time ON cr_resolution_decision (tenant_id, decided_at DESC);

-- ============================================================================
-- A29 — EXPLAINABILITY AGENT
-- ============================================================================

-- Explanation templates (persona × scope × length)
CREATE TABLE ex_narrative_template (
    template_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code           VARCHAR(200) NOT NULL UNIQUE,
    template_name           VARCHAR(500) NOT NULL,
    target_persona          VARCHAR(100) NOT NULL,
    explanation_scope       ex_explanation_scope NOT NULL,
    narrative_length        ex_narrative_length NOT NULL,
    locale_code             VARCHAR(20) NOT NULL DEFAULT 'en-US',
    prompt_template         TEXT NOT NULL,
    structure_json          JSONB,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    version                 VARCHAR(50) NOT NULL,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id)
);
CREATE INDEX idx_ex_tmpl_persona_scope ON ex_narrative_template (target_persona, explanation_scope) WHERE is_active;

-- Reasoning chain capture (inputs to A29 from all other agents)
CREATE TABLE ex_reasoning_chain (
    reasoning_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    source_agent_id         UUID NOT NULL REFERENCES agent_identity(agent_id),
    source_entity_type      VARCHAR(100) NOT NULL,
    source_entity_id        UUID NOT NULL,
    correlation_id          UUID,
    autonomy_level          agent_autonomy_level NOT NULL,
    input_facts_json        JSONB NOT NULL,
    intermediate_steps_json JSONB,
    conclusion_json         JSONB NOT NULL,
    supporting_evidence_json JSONB,
    confidence_score        NUMERIC(5,4),
    captured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ex_reason_source ON ex_reasoning_chain (source_entity_type, source_entity_id);
CREATE INDEX idx_ex_reason_tenant_time ON ex_reasoning_chain (tenant_id, captured_at DESC);
CREATE INDEX idx_ex_reason_correlation ON ex_reasoning_chain (correlation_id) WHERE correlation_id IS NOT NULL;

-- Generated narratives (one reasoning chain may have multiple narratives)
CREATE TABLE ex_narrative (
    narrative_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    reasoning_id            UUID NOT NULL REFERENCES ex_reasoning_chain(reasoning_id),
    template_id             UUID REFERENCES ex_narrative_template(template_id),
    target_persona          VARCHAR(100) NOT NULL,
    explanation_scope       ex_explanation_scope NOT NULL,
    narrative_length        ex_narrative_length NOT NULL,
    narrative_text          TEXT NOT NULL,
    structured_sections_json JSONB,
    llm_model_used          VARCHAR(100),
    llm_token_count         INTEGER,
    locale_code             VARCHAR(20) NOT NULL DEFAULT 'en-US',
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (reasoning_id, target_persona, narrative_length, locale_code)
);
CREATE INDEX idx_ex_narr_reasoning ON ex_narrative (reasoning_id);
CREATE INDEX idx_ex_narr_tenant_time ON ex_narrative (tenant_id, generated_at DESC);

-- Narrative feedback (thumbs up/down from humans reading explanations)
CREATE TABLE ex_narrative_feedback (
    feedback_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    narrative_id            UUID NOT NULL REFERENCES ex_narrative(narrative_id),
    user_id                 UUID NOT NULL REFERENCES auth_user(user_id),
    rating                  SMALLINT NOT NULL,
    helpfulness             VARCHAR(30),
    feedback_text           TEXT,
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_ex_rating CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX idx_ex_fb_narrative ON ex_narrative_feedback (narrative_id);
CREATE INDEX idx_ex_fb_tenant_rating ON ex_narrative_feedback (tenant_id, rating, submitted_at DESC);

-- ============================================================================
-- A30 — HUMAN IN THE LOOP AGENT
-- ============================================================================

-- Routing rules (which escalation type goes to which tier/role)
CREATE TABLE hl_routing_rule (
    routing_rule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    rule_name               VARCHAR(200) NOT NULL,
    source_agent_filter     TEXT[],
    task_category_filter    hl_task_category[],
    severity_filter         gov_severity[],
    financial_threshold_min NUMERIC(18,4),
    financial_threshold_max NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    initial_tier            hl_escalation_tier NOT NULL,
    assigned_role_ids       UUID[],
    sla_response_minutes    INTEGER NOT NULL,
    escalation_tier_sequence hl_escalation_tier[],
    auto_approve_after_min  INTEGER,
    auto_reject_after_min   INTEGER,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    priority                INTEGER NOT NULL DEFAULT 100,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id)
);
CREATE INDEX idx_hl_rule_tenant_active ON hl_routing_rule (tenant_id, priority) WHERE is_active;

-- HITL tasks (the work queue for humans)
CREATE TABLE hl_task (
    hl_task_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    source_agent_id         UUID NOT NULL REFERENCES agent_identity(agent_id),
    source_entity_type      VARCHAR(100) NOT NULL,
    source_entity_id        UUID NOT NULL,
    correlation_id          UUID,
    task_category           hl_task_category NOT NULL,
    task_title              VARCHAR(500) NOT NULL,
    task_description        TEXT,
    context_json            JSONB NOT NULL,
    options_json            JSONB,
    severity                gov_severity NOT NULL,
    priority                opt_priority_tier NOT NULL,
    financial_impact_amount NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    current_tier            hl_escalation_tier NOT NULL,
    routing_rule_id         UUID REFERENCES hl_routing_rule(routing_rule_id),
    assigned_to_user_id     UUID REFERENCES auth_user(user_id),
    assigned_to_role_id     UUID REFERENCES auth_role(role_id),
    status                  hl_task_status NOT NULL DEFAULT 'Pending',
    narrative_id            UUID REFERENCES ex_narrative(narrative_id),
    sla_deadline            TIMESTAMPTZ,
    auto_resolve_at         TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_viewed_at         TIMESTAMPTZ,
    decided_at              TIMESTAMPTZ,
    decided_by              UUID REFERENCES auth_user(user_id),
    decision                VARCHAR(50),
    decision_notes          TEXT,
    decision_payload_json   JSONB
);
CREATE INDEX idx_hl_task_tenant_status ON hl_task (tenant_id, status);
CREATE INDEX idx_hl_task_assigned ON hl_task (assigned_to_user_id) WHERE status IN ('Pending', 'Assigned', 'In_Review');
CREATE INDEX idx_hl_task_role ON hl_task (assigned_to_role_id) WHERE status = 'Pending';
CREATE INDEX idx_hl_task_sla ON hl_task (sla_deadline) WHERE status IN ('Pending', 'Assigned', 'In_Review');
CREATE INDEX idx_hl_task_priority ON hl_task (priority, created_at) WHERE status = 'Pending';
CREATE INDEX idx_hl_task_correlation ON hl_task (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_hl_task_source_entity ON hl_task (source_entity_type, source_entity_id);

-- Escalation log (every tier change)
CREATE TABLE hl_escalation_event (
    escalation_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    hl_task_id              UUID NOT NULL REFERENCES hl_task(hl_task_id),
    from_tier               hl_escalation_tier,
    to_tier                 hl_escalation_tier NOT NULL,
    escalation_reason       VARCHAR(200) NOT NULL,
    previous_assignee       UUID REFERENCES auth_user(user_id),
    new_assignee            UUID REFERENCES auth_user(user_id),
    triggered_by_agent      BOOLEAN NOT NULL DEFAULT TRUE,
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hl_esc_task ON hl_escalation_event (hl_task_id, occurred_at DESC);
CREATE INDEX idx_hl_esc_tenant_time ON hl_escalation_event (tenant_id, occurred_at DESC);

-- Decision audit (immutable record of every approval/rejection/override)
CREATE TABLE hl_decision_audit (
    audit_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    hl_task_id              UUID NOT NULL REFERENCES hl_task(hl_task_id),
    decided_by              UUID NOT NULL REFERENCES auth_user(user_id),
    decided_by_role_id      UUID REFERENCES auth_role(role_id),
    decision                VARCHAR(50) NOT NULL,
    decision_payload_json   JSONB,
    justification           TEXT,
    evidence_refs           JSONB,
    mfa_verified            BOOLEAN NOT NULL DEFAULT FALSE,
    client_ip               INET,
    user_agent              VARCHAR(500),
    signature_hash          CHAR(64),
    decided_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hl_audit_task ON hl_decision_audit (hl_task_id);
CREATE INDEX idx_hl_audit_tenant_time ON hl_decision_audit (tenant_id, decided_at DESC);
CREATE INDEX idx_hl_audit_user ON hl_decision_audit (decided_by, decided_at DESC);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE cr_objective_weight      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cr_conflict              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cr_resolution_proposal   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cr_resolution_decision   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ex_reasoning_chain       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ex_narrative             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ex_narrative_feedback    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl_routing_rule          ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl_task                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl_escalation_event      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl_decision_audit        ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_cr_w    ON cr_objective_weight     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cr_c    ON cr_conflict             USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cr_p    ON cr_resolution_proposal  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cr_d    ON cr_resolution_decision  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ex_rc   ON ex_reasoning_chain      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ex_n    ON ex_narrative            USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ex_fb   ON ex_narrative_feedback   USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_hl_rr   ON hl_routing_rule         USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_hl_t    ON hl_task                 USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_hl_e    ON hl_escalation_event     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_hl_a    ON hl_decision_audit       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF WAVE 4b — A28 Conflict Resolution + A29 Explainability + A30 HITL
-- Tables: 12 (A28: 4, A29: 4, A30: 4)
-- Enums: 10 new
-- Indexes: 28
-- RLS Policies: 11
-- Reuses: gov_severity, opt_priority_tier, opt_confidence_level, agent_autonomy_level
-- Critical integration points: cr_resolution_decision.hl_task_id, hl_task.narrative_id
-- =============================================================================
