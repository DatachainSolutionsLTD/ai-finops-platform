-- =============================================================================
-- V024 — A21 Assessment Agent (FSD-ASM-01)
-- Sources: A21-FSD-ASM-01
-- =============================================================================
-- Purpose: FinOps Maturity Assessment, Scoring & Improvement Roadmaps.
-- Continuously evaluates tenant maturity across the 22 FinOps Foundation
-- capabilities using the Crawl/Walk/Run model, generates scorecards,
-- improvement roadmaps, and certification readiness assessments.
--
-- Reuses: gov_severity, opt_priority_tier, opt_confidence_level
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE asm_maturity_level AS ENUM (
    'Not_Assessed', 'Crawl', 'Walk', 'Run', 'Optimize'
);

CREATE TYPE asm_capability_domain AS ENUM (
    'Understand_Usage_Cost', 'Quantify_Business_Value',
    'Optimize_Usage_Cost', 'Manage_FinOps_Practice'
);

CREATE TYPE asm_criterion_type AS ENUM (
    'Quantitative_KPI', 'Qualitative_Indicator',
    'Binary_Capability', 'Maturity_Gate', 'Documentation_Evidence'
);

CREATE TYPE asm_assessment_status AS ENUM (
    'Scheduled', 'In_Progress', 'Awaiting_Evidence',
    'Under_Review', 'Completed', 'Superseded', 'Cancelled'
);

CREATE TYPE asm_assessment_trigger AS ENUM (
    'Onboarding', 'Scheduled_Periodic', 'Manual_Request',
    'Pre_Certification', 'Post_Milestone', 'Continuous_Recalculation'
);

CREATE TYPE asm_roadmap_item_status AS ENUM (
    'Proposed', 'Accepted', 'In_Progress', 'Completed',
    'Deferred', 'Cancelled', 'Blocked'
);

CREATE TYPE asm_certification_scheme AS ENUM (
    'FinOps_Foundation_Practitioner', 'FinOps_Foundation_Professional',
    'FinOps_Foundation_Engineer', 'FinOps_Foundation_Analyst',
    'Internal_Certification', 'Custom'
);

-- ============================================================================
-- MATURITY CRITERIA LIBRARY (platform-wide reference data)
-- ============================================================================

-- The 22 FinOps Foundation capabilities (seed data, not hardcoded in schema)
CREATE TABLE asm_capability_definition (
    capability_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capability_code         VARCHAR(200) NOT NULL UNIQUE,
    display_name            VARCHAR(500) NOT NULL,
    domain                  asm_capability_domain NOT NULL,
    description             TEXT,
    framework_source        VARCHAR(100) NOT NULL,
    framework_version       VARCHAR(50),
    default_weight          NUMERIC(5,4) NOT NULL DEFAULT 1,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    display_order           INTEGER,
    documentation_url       TEXT,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_asm_cap_domain ON asm_capability_definition (domain, display_order) WHERE is_active;

-- Maturity criteria per capability per level (what does "Walk" look like for Cost Allocation?)
CREATE TABLE asm_maturity_criterion (
    criterion_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capability_id           UUID NOT NULL REFERENCES asm_capability_definition(capability_id) ON DELETE CASCADE,
    target_level            asm_maturity_level NOT NULL,
    criterion_type          asm_criterion_type NOT NULL,
    criterion_name          VARCHAR(500) NOT NULL,
    description             TEXT,
    measurement_definition_json JSONB NOT NULL,
    threshold_value_json    JSONB,
    weight_within_level     NUMERIC(5,4) NOT NULL DEFAULT 1,
    evidence_requirements   TEXT,
    is_required             BOOLEAN NOT NULL DEFAULT TRUE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_asm_crit_cap_level ON asm_maturity_criterion (capability_id, target_level) WHERE is_active;

-- Per-tenant weight overrides (tenants may weight capabilities differently)
CREATE TABLE asm_capability_weight_override (
    override_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    capability_id           UUID NOT NULL REFERENCES asm_capability_definition(capability_id),
    weight_value            NUMERIC(5,4) NOT NULL,
    justification           TEXT,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by             UUID REFERENCES auth_user(user_id),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    UNIQUE (tenant_id, capability_id, effective_from),
    CONSTRAINT ck_asm_weight_range CHECK (weight_value BETWEEN 0 AND 10)
);
CREATE INDEX idx_asm_weight_tenant ON asm_capability_weight_override (tenant_id) WHERE is_active;

-- ============================================================================
-- ASSESSMENTS (the actual evaluation runs)
-- ============================================================================

-- Assessment session (a full evaluation across all capabilities for a scope)
CREATE TABLE asm_assessment (
    assessment_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    assessment_name         VARCHAR(500) NOT NULL,
    scope_dimension         VARCHAR(100),
    scope_dimension_key     VARCHAR(500),
    scope_display_name      VARCHAR(500),
    trigger_type            asm_assessment_trigger NOT NULL,
    triggered_by_user_id    UUID REFERENCES auth_user(user_id),
    triggered_by_agent_id   UUID REFERENCES agent_identity(agent_id),
    trigger_reference_id    UUID,
    framework_version       VARCHAR(50),
    status                  asm_assessment_status NOT NULL DEFAULT 'Scheduled',
    overall_maturity_score  NUMERIC(5,4),
    overall_maturity_level  asm_maturity_level,
    capabilities_assessed   INTEGER NOT NULL DEFAULT 0,
    capabilities_total      INTEGER NOT NULL,
    narrative_summary       TEXT,
    artifact_uri            TEXT,
    scheduled_at            TIMESTAMPTZ NOT NULL,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    superseded_by           UUID REFERENCES asm_assessment(assessment_id),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_asm_assess_tenant_time ON asm_assessment (tenant_id, completed_at DESC NULLS LAST);
CREATE INDEX idx_asm_assess_status ON asm_assessment (status) WHERE status IN ('Scheduled', 'In_Progress', 'Awaiting_Evidence');
CREATE INDEX idx_asm_assess_scope ON asm_assessment (tenant_id, scope_dimension, scope_dimension_key);

-- Per-capability results within an assessment
CREATE TABLE asm_capability_result (
    result_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id           UUID NOT NULL REFERENCES asm_assessment(assessment_id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    capability_id           UUID NOT NULL REFERENCES asm_capability_definition(capability_id),
    achieved_level          asm_maturity_level NOT NULL,
    capability_score        NUMERIC(5,4) NOT NULL,
    applied_weight          NUMERIC(5,4) NOT NULL,
    criteria_evaluated      INTEGER NOT NULL,
    criteria_met            INTEGER NOT NULL,
    next_level              asm_maturity_level,
    pct_to_next_level       NUMERIC(5,2),
    confidence              opt_confidence_level NOT NULL,
    narrative               TEXT,
    evidence_refs_json      JSONB,
    evaluated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (assessment_id, capability_id)
);
CREATE INDEX idx_asm_result_tenant_cap ON asm_capability_result (tenant_id, capability_id, evaluated_at DESC);
CREATE INDEX idx_asm_result_level ON asm_capability_result (achieved_level, tenant_id);

-- Per-criterion evaluation detail
CREATE TABLE asm_criterion_evaluation (
    evaluation_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id               UUID NOT NULL REFERENCES asm_capability_result(result_id) ON DELETE CASCADE,
    criterion_id            UUID NOT NULL REFERENCES asm_maturity_criterion(criterion_id),
    is_met                  BOOLEAN NOT NULL,
    measured_value_json     JSONB,
    evidence_source         VARCHAR(200),
    evidence_data_json      JSONB,
    confidence_score        NUMERIC(5,4),
    evaluator_notes         TEXT,
    evaluated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_asm_eval_result ON asm_criterion_evaluation (result_id);
CREATE INDEX idx_asm_eval_unmet ON asm_criterion_evaluation (result_id) WHERE NOT is_met;

-- ============================================================================
-- MATURITY TRENDS & ROADMAPS
-- ============================================================================

-- Historical maturity snapshots (for trend analysis per ASM-006)
CREATE TABLE asm_maturity_snapshot (
    snapshot_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    snapshot_date           DATE NOT NULL,
    scope_dimension         VARCHAR(100),
    scope_dimension_key     VARCHAR(500),
    source_assessment_id    UUID REFERENCES asm_assessment(assessment_id),
    overall_maturity_score  NUMERIC(5,4) NOT NULL,
    overall_maturity_level  asm_maturity_level NOT NULL,
    per_capability_scores_json JSONB NOT NULL,
    per_domain_scores_json  JSONB,
    month_over_month_delta  NUMERIC(10,4),
    quarter_over_quarter_delta NUMERIC(10,4),
    captured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, snapshot_date, scope_dimension, scope_dimension_key)
);
CREATE INDEX idx_asm_snap_tenant_date ON asm_maturity_snapshot (tenant_id, snapshot_date DESC);

-- Improvement roadmap items (recommendations to advance maturity)
CREATE TABLE asm_roadmap_item (
    roadmap_item_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    source_assessment_id    UUID REFERENCES asm_assessment(assessment_id),
    capability_id           UUID NOT NULL REFERENCES asm_capability_definition(capability_id),
    current_level           asm_maturity_level NOT NULL,
    target_level            asm_maturity_level NOT NULL,
    item_title              VARCHAR(500) NOT NULL,
    item_description        TEXT NOT NULL,
    recommended_action      TEXT NOT NULL,
    estimated_effort_hours  INTEGER,
    estimated_duration_days INTEGER,
    estimated_cost_amount   NUMERIC(18,4),
    estimated_savings_amount NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    roi_justification       TEXT,
    priority                opt_priority_tier NOT NULL,
    dependencies_json       JSONB,
    required_roles_json     JSONB,
    status                  asm_roadmap_item_status NOT NULL DEFAULT 'Proposed',
    assigned_to_user_id     UUID REFERENCES auth_user(user_id),
    target_completion_date  DATE,
    accepted_at             TIMESTAMPTZ,
    accepted_by             UUID REFERENCES auth_user(user_id),
    completed_at            TIMESTAMPTZ,
    actual_cost_amount      NUMERIC(18,4),
    actual_effort_hours     INTEGER,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_asm_rm_tenant_status ON asm_roadmap_item (tenant_id, status);
CREATE INDEX idx_asm_rm_priority ON asm_roadmap_item (tenant_id, priority, target_completion_date) WHERE status IN ('Proposed', 'Accepted', 'In_Progress');
CREATE INDEX idx_asm_rm_cap ON asm_roadmap_item (capability_id, tenant_id);
CREATE INDEX idx_asm_rm_assigned ON asm_roadmap_item (assigned_to_user_id) WHERE status IN ('Accepted', 'In_Progress');

-- Maturity-to-financial-outcome correlation (ASM-007)
CREATE TABLE asm_outcome_correlation (
    correlation_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    capability_id           UUID REFERENCES asm_capability_definition(capability_id),
    measurement_period_start DATE NOT NULL,
    measurement_period_end   DATE NOT NULL,
    starting_maturity_score NUMERIC(5,4) NOT NULL,
    ending_maturity_score   NUMERIC(5,4) NOT NULL,
    maturity_delta          NUMERIC(10,4) GENERATED ALWAYS AS (ending_maturity_score - starting_maturity_score) STORED,
    realized_savings_amount NUMERIC(18,4),
    cost_avoidance_amount   NUMERIC(18,4),
    efficiency_improvement_pct NUMERIC(10,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    savings_per_maturity_point NUMERIC(18,4),
    attribution_confidence  opt_confidence_level NOT NULL,
    narrative               TEXT,
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_asm_corr_tenant_period ON asm_outcome_correlation (tenant_id, measurement_period_end DESC);
CREATE INDEX idx_asm_corr_cap ON asm_outcome_correlation (capability_id, tenant_id) WHERE capability_id IS NOT NULL;

-- ============================================================================
-- CERTIFICATION READINESS (ASM-008)
-- ============================================================================

CREATE TABLE asm_certification_requirement (
    requirement_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_scheme    asm_certification_scheme NOT NULL,
    requirement_code        VARCHAR(200) NOT NULL,
    requirement_name        VARCHAR(500) NOT NULL,
    description             TEXT,
    capability_id           UUID REFERENCES asm_capability_definition(capability_id),
    minimum_maturity_level  asm_maturity_level NOT NULL,
    minimum_criteria_json   JSONB,
    is_mandatory            BOOLEAN NOT NULL DEFAULT TRUE,
    scheme_version          VARCHAR(50) NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    documentation_url       TEXT,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (certification_scheme, requirement_code, scheme_version)
);
CREATE INDEX idx_asm_cert_req_scheme ON asm_certification_requirement (certification_scheme) WHERE is_active;

CREATE TABLE asm_certification_readiness (
    readiness_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    source_assessment_id    UUID REFERENCES asm_assessment(assessment_id),
    certification_scheme    asm_certification_scheme NOT NULL,
    scheme_version          VARCHAR(50) NOT NULL,
    readiness_score         NUMERIC(5,4) NOT NULL,
    requirements_total      INTEGER NOT NULL,
    requirements_met        INTEGER NOT NULL,
    requirements_partial    INTEGER NOT NULL DEFAULT 0,
    requirements_unmet      INTEGER NOT NULL,
    gaps_summary_json       JSONB,
    estimated_time_to_ready_days INTEGER,
    narrative               TEXT,
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, certification_scheme, scheme_version, source_assessment_id)
);
CREATE INDEX idx_asm_cert_rd_tenant ON asm_certification_readiness (tenant_id, certification_scheme, calculated_at DESC);

-- ============================================================================
-- CROSS-TENANT COMPARISONS (ASM-009 — anonymized leader/laggard analysis)
-- ============================================================================

CREATE TABLE asm_cohort_comparison (
    comparison_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id               UUID REFERENCES bm_peer_cohort(cohort_id),
    capability_id           UUID REFERENCES asm_capability_definition(capability_id),
    comparison_date         DATE NOT NULL,
    cohort_p25_score        NUMERIC(5,4),
    cohort_p50_score        NUMERIC(5,4),
    cohort_p75_score        NUMERIC(5,4),
    cohort_p90_score        NUMERIC(5,4),
    cohort_mean_score       NUMERIC(5,4),
    sample_size             INTEGER NOT NULL,
    leader_anonymized_key   CHAR(64),
    leader_achieved_level   asm_maturity_level,
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cohort_id, capability_id, comparison_date)
);
CREATE INDEX idx_asm_cohort_cmp_date ON asm_cohort_comparison (cohort_id, comparison_date DESC);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE asm_capability_weight_override ENABLE ROW LEVEL SECURITY;
ALTER TABLE asm_assessment                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE asm_capability_result          ENABLE ROW LEVEL SECURITY;
ALTER TABLE asm_maturity_snapshot          ENABLE ROW LEVEL SECURITY;
ALTER TABLE asm_roadmap_item               ENABLE ROW LEVEL SECURITY;
ALTER TABLE asm_outcome_correlation        ENABLE ROW LEVEL SECURITY;
ALTER TABLE asm_certification_readiness    ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_asm_wo   ON asm_capability_weight_override USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_asm_a    ON asm_assessment                 USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_asm_r    ON asm_capability_result          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_asm_s    ON asm_maturity_snapshot          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_asm_rm   ON asm_roadmap_item               USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_asm_oc   ON asm_outcome_correlation        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_asm_crd  ON asm_certification_readiness    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- asm_capability_definition, asm_maturity_criterion, asm_criterion_evaluation,
-- asm_certification_requirement, asm_cohort_comparison intentionally platform-wide
-- (reference data / anonymized aggregations)

-- =============================================================================
-- END OF V024 — A21 Assessment Agent
-- Tables: 11 (Library: 3, Assessments: 3, Trends/Roadmap: 3, Certification: 2, Cohort: 1 — minus overlap = 11)
-- Actually: capability_def, maturity_criterion, weight_override, assessment,
--           capability_result, criterion_evaluation, maturity_snapshot,
--           roadmap_item, outcome_correlation, cert_requirement, cert_readiness,
--           cohort_comparison = 12 tables
-- Enums: 7 new
-- Indexes: 22
-- RLS Policies: 7
-- Reuses: opt_confidence_level, opt_priority_tier, bm_peer_cohort (from V013)
-- =============================================================================
-- FINAL PLATFORM GRAND TOTAL: 260 tables across 24 migrations
-- Every FSD now has authoritative DDL.
-- =============================================================================
