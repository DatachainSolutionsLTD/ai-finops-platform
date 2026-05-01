-- =============================================================================
-- V015 — Wave 3a: A11 Workload Optimizer + A12 Rate Optimizer + A13 Architecture Advisor
-- Sources: A11-FSD-WO-11, A12-FSD-RO-12, A13-FSD-AA-01
-- =============================================================================
-- DESIGN PATTERN ESTABLISHED IN THIS BATCH (reused by Wave 3b and 3c):
--   Every Optimize agent follows the same lifecycle:
--     detect finding → generate recommendation → track approval → measure savings
--
--   Shared enums (defined here, reused across all 9 Optimize agents):
--     - opt_recommendation_status (workflow state)
--     - opt_confidence_level      (statistical confidence tier)
--     - opt_priority_tier         (execution urgency)
--
--   Per-agent tables follow the pattern:
--     {prefix}_finding         — raw detection of an optimization opportunity
--     {prefix}_recommendation  — actionable proposal with savings estimate
--     {prefix}_execution_log   — record of approved and executed actions
--     {prefix}_savings_realized — backtested actual savings post-execution
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SHARED ENUMS (reused across all 9 Optimize agents A11–A19)
-- ---------------------------------------------------------------------------
CREATE TYPE opt_recommendation_status AS ENUM (
    'Draft', 'Pending_Review', 'Approved', 'Rejected',
    'In_Execution', 'Executed', 'Reverted', 'Superseded', 'Expired'
);

CREATE TYPE opt_confidence_level AS ENUM (
    'Low', 'Medium', 'High', 'Very_High'
);

CREATE TYPE opt_priority_tier AS ENUM (
    'P1_Critical', 'P2_High', 'P3_Medium', 'P4_Low', 'P5_Backlog'
);

CREATE TYPE opt_performance_impact AS ENUM (
    'None', 'Negligible', 'Minor', 'Moderate', 'Significant'
);

-- ---------------------------------------------------------------------------
-- A11-SPECIFIC ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE wo_finding_type AS ENUM (
    'Oversized_Compute', 'Undersized_Compute', 'Idle_Resource',
    'Unattached_Volume', 'Idle_GPU', 'Inactive_Endpoint',
    'Oversized_Memory', 'Oversized_Storage', 'Underutilized_Cluster'
);

CREATE TYPE wo_action_type AS ENUM (
    'Rightsize', 'Terminate', 'Stop_Schedule',
    'Reassign', 'Consolidate', 'Downgrade_Tier'
);

-- ---------------------------------------------------------------------------
-- A12-SPECIFIC ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE ro_commitment_type AS ENUM (
    'Reserved_Instance', 'Savings_Plan', 'Committed_Use_Discount',
    'Enterprise_Agreement', 'Spot_Instance', 'Preemptible_Instance'
);

CREATE TYPE ro_commitment_term AS ENUM (
    'One_Year', 'Three_Year', 'Monthly', 'Custom'
);

CREATE TYPE ro_payment_option AS ENUM (
    'No_Upfront', 'Partial_Upfront', 'All_Upfront'
);

CREATE TYPE ro_commitment_status AS ENUM (
    'Active', 'Underutilized', 'Expiring_Soon', 'Expired',
    'Exchanged', 'Cancelled', 'Pending_Activation'
);

-- ---------------------------------------------------------------------------
-- A13-SPECIFIC ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE aa_antipattern_category AS ENUM (
    'Data_Transfer_Inefficiency', 'Storage_Misuse', 'Compute_Overprovisioning',
    'Network_Topology', 'Database_Pattern', 'Caching_Absent',
    'Monolithic_Workload', 'Chatty_Architecture', 'Unmanaged_Service_Use'
);

CREATE TYPE aa_migration_target AS ENUM (
    'Managed_Service', 'Serverless', 'Container', 'Spot_Compute',
    'Multi_Region', 'Hybrid', 'On_Premises', 'Edge'
);

-- ============================================================================
-- A11 — WORKLOAD OPTIMIZER AGENT
-- ============================================================================

-- Utilization baselines per resource (for rightsizing analysis)
CREATE TABLE wo_utilization_baseline (
    baseline_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    resource_identifier     VARCHAR(1000) NOT NULL,
    resource_type           VARCHAR(200) NOT NULL,
    provider                VARCHAR(100) NOT NULL,
    observation_window_start DATE NOT NULL,
    observation_window_end   DATE NOT NULL,
    cpu_p50                 NUMERIC(7,4),
    cpu_p95                 NUMERIC(7,4),
    cpu_p99                 NUMERIC(7,4),
    memory_p50              NUMERIC(7,4),
    memory_p95              NUMERIC(7,4),
    memory_p99              NUMERIC(7,4),
    iops_p95                NUMERIC(18,4),
    network_p95_mbps        NUMERIC(18,4),
    sample_count            BIGINT NOT NULL,
    data_quality_score      NUMERIC(5,4),
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, resource_identifier, observation_window_start)
);
CREATE INDEX idx_wo_baseline_tenant ON wo_utilization_baseline (tenant_id, resource_type);

-- Workload findings (detected inefficiencies)
CREATE TABLE wo_finding (
    finding_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    resource_identifier     VARCHAR(1000) NOT NULL,
    resource_type           VARCHAR(200) NOT NULL,
    provider                VARCHAR(100) NOT NULL,
    finding_type            wo_finding_type NOT NULL,
    baseline_id             UUID REFERENCES wo_utilization_baseline(baseline_id),
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_monthly_cost    NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    severity                gov_severity NOT NULL,
    owner_user_id           UUID REFERENCES auth_user(user_id),
    owner_business_unit     VARCHAR(200),
    status                  VARCHAR(30) NOT NULL DEFAULT 'Open',
    resolved_at             TIMESTAMPTZ
);
CREATE INDEX idx_wo_finding_tenant_open ON wo_finding (tenant_id, status) WHERE status = 'Open';
CREATE INDEX idx_wo_finding_type ON wo_finding (tenant_id, finding_type);
CREATE INDEX idx_wo_finding_owner ON wo_finding (owner_user_id) WHERE status = 'Open';

-- Rightsizing recommendations
CREATE TABLE wo_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    finding_id              UUID NOT NULL REFERENCES wo_finding(finding_id),
    action_type             wo_action_type NOT NULL,
    current_spec_json       JSONB NOT NULL,
    recommended_spec_json   JSONB NOT NULL,
    estimated_monthly_savings NUMERIC(18,4) NOT NULL,
    estimated_annual_savings  NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    confidence              opt_confidence_level NOT NULL,
    confidence_score        NUMERIC(5,4) NOT NULL,
    performance_impact      opt_performance_impact NOT NULL,
    priority                opt_priority_tier NOT NULL,
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    rationale               TEXT,
    reviewed_by             UUID REFERENCES auth_user(user_id),
    reviewed_at             TIMESTAMPTZ,
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    rejection_reason        TEXT,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ
);
CREATE INDEX idx_wo_rec_tenant_status ON wo_recommendation (tenant_id, status);
CREATE INDEX idx_wo_rec_priority ON wo_recommendation (priority, estimated_monthly_savings DESC) WHERE status = 'Pending_Review';
CREATE INDEX idx_wo_rec_finding ON wo_recommendation (finding_id);

-- Execution log (actions actually taken)
CREATE TABLE wo_execution_log (
    execution_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    recommendation_id       UUID NOT NULL REFERENCES wo_recommendation(recommendation_id),
    executed_by_agent_id    UUID REFERENCES agent_identity(agent_id),
    executed_by_user_id     UUID REFERENCES auth_user(user_id),
    execution_status        VARCHAR(30) NOT NULL DEFAULT 'Pending',
    pre_execution_state_json JSONB,
    post_execution_state_json JSONB,
    executed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    reverted_at             TIMESTAMPTZ,
    revert_reason           TEXT,
    error_detail            TEXT
);
CREATE INDEX idx_wo_exec_rec ON wo_execution_log (recommendation_id);
CREATE INDEX idx_wo_exec_tenant_time ON wo_execution_log (tenant_id, executed_at DESC);

-- Realized savings tracking
CREATE TABLE wo_savings_realized (
    realization_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    execution_id            UUID NOT NULL REFERENCES wo_execution_log(execution_id),
    recommendation_id       UUID NOT NULL REFERENCES wo_recommendation(recommendation_id),
    measurement_period_start DATE NOT NULL,
    measurement_period_end   DATE NOT NULL,
    estimated_savings_amount NUMERIC(18,4) NOT NULL,
    actual_savings_amount   NUMERIC(18,4) NOT NULL,
    realization_ratio       NUMERIC(7,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    measured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wo_savings_rec ON wo_savings_realized (recommendation_id);
CREATE INDEX idx_wo_savings_period ON wo_savings_realized (tenant_id, measurement_period_end DESC);

-- ============================================================================
-- A12 — RATE OPTIMIZER AGENT
-- ============================================================================

-- Commitment portfolio (existing RIs, Savings Plans, CUDs)
CREATE TABLE ro_commitment (
    commitment_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    provider                VARCHAR(100) NOT NULL,
    commitment_type         ro_commitment_type NOT NULL,
    provider_commitment_id  VARCHAR(500) NOT NULL,
    commitment_term         ro_commitment_term NOT NULL,
    payment_option          ro_payment_option,
    hourly_commitment_amount NUMERIC(18,6) NOT NULL,
    total_commitment_amount  NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    scope_json              JSONB,
    utilization_pct_current NUMERIC(7,4),
    utilization_pct_lifetime NUMERIC(7,4),
    coverage_pct_current    NUMERIC(7,4),
    status                  ro_commitment_status NOT NULL DEFAULT 'Active',
    purchased_by            UUID REFERENCES auth_user(user_id),
    purchased_at            TIMESTAMPTZ,
    external_reference_id   VARCHAR(200),
    last_updated            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_commitment_id)
);
CREATE INDEX idx_ro_commit_tenant_status ON ro_commitment (tenant_id, status);
CREATE INDEX idx_ro_commit_expiring ON ro_commitment (end_date) WHERE status = 'Active';
CREATE INDEX idx_ro_commit_underutil ON ro_commitment (utilization_pct_current) WHERE status = 'Active' AND utilization_pct_current < 80;

-- Commitment purchase recommendations
CREATE TABLE ro_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    recommendation_category VARCHAR(100) NOT NULL,
    provider                VARCHAR(100) NOT NULL,
    commitment_type         ro_commitment_type NOT NULL,
    commitment_term         ro_commitment_term NOT NULL,
    payment_option          ro_payment_option,
    scope_json              JSONB NOT NULL,
    recommended_hourly_commitment NUMERIC(18,6) NOT NULL,
    estimated_upfront_cost  NUMERIC(18,4),
    estimated_monthly_cost  NUMERIC(18,4) NOT NULL,
    estimated_monthly_savings NUMERIC(18,4) NOT NULL,
    estimated_annual_savings  NUMERIC(18,4) NOT NULL,
    break_even_months       INTEGER,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    confidence              opt_confidence_level NOT NULL,
    confidence_score        NUMERIC(5,4) NOT NULL,
    priority                opt_priority_tier NOT NULL,
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    analysis_lookback_days  INTEGER NOT NULL,
    rationale               TEXT,
    reviewed_by             UUID REFERENCES auth_user(user_id),
    reviewed_at             TIMESTAMPTZ,
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ,
    resulting_commitment_id UUID REFERENCES ro_commitment(commitment_id)
);
CREATE INDEX idx_ro_rec_tenant_status ON ro_recommendation (tenant_id, status);
CREATE INDEX idx_ro_rec_savings ON ro_recommendation (estimated_annual_savings DESC) WHERE status = 'Pending_Review';

-- Spot/preemptible instance opportunities
CREATE TABLE ro_spot_opportunity (
    opportunity_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    workload_identifier     VARCHAR(1000) NOT NULL,
    workload_classification VARCHAR(100),
    fault_tolerance_score   NUMERIC(5,4),
    provider                VARCHAR(100) NOT NULL,
    current_monthly_cost    NUMERIC(18,4) NOT NULL,
    projected_spot_cost     NUMERIC(18,4) NOT NULL,
    estimated_savings       NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    spot_availability_score NUMERIC(5,4),
    interruption_risk_score NUMERIC(5,4),
    confidence              opt_confidence_level NOT NULL,
    recommended_strategy    VARCHAR(500),
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ro_spot_tenant ON ro_spot_opportunity (tenant_id, status);

-- ============================================================================
-- A13 — ARCHITECTURE ADVISOR AGENT
-- ============================================================================

-- Architectural anti-pattern catalog (platform-wide reference data)
CREATE TABLE aa_antipattern_definition (
    antipattern_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    antipattern_code        VARCHAR(200) NOT NULL UNIQUE,
    display_name            VARCHAR(500) NOT NULL,
    category                aa_antipattern_category NOT NULL,
    description             TEXT NOT NULL,
    detection_rule_json     JSONB NOT NULL,
    cost_impact_model_json  JSONB,
    remediation_guidance    TEXT,
    reference_docs          TEXT[],
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aa_anti_cat ON aa_antipattern_definition (category) WHERE is_active;

-- Workload classification (captured once per workload, updated periodically)
CREATE TABLE aa_workload_classification (
    classification_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    application_identifier  VARCHAR(500) NOT NULL,
    provider                VARCHAR(100),
    workload_pattern        VARCHAR(100),
    statefulness            VARCHAR(30),
    scaling_behavior        VARCHAR(50),
    access_pattern          VARCHAR(50),
    data_locality           VARCHAR(50),
    fault_tolerance         VARCHAR(30),
    criticality_tier        VARCHAR(30),
    classification_confidence NUMERIC(5,4),
    classified_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, application_identifier)
);
CREATE INDEX idx_aa_class_tenant_app ON aa_workload_classification (tenant_id, application_identifier);

-- Detected anti-patterns (findings)
CREATE TABLE aa_antipattern_detection (
    detection_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    antipattern_id          UUID NOT NULL REFERENCES aa_antipattern_definition(antipattern_id),
    classification_id       UUID REFERENCES aa_workload_classification(classification_id),
    affected_resources      TEXT[],
    evidence_json           JSONB,
    current_monthly_cost    NUMERIC(18,4),
    estimated_waste_pct     NUMERIC(7,4),
    estimated_waste_amount  NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    severity                gov_severity NOT NULL,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Open',
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ
);
CREATE INDEX idx_aa_det_tenant_open ON aa_antipattern_detection (tenant_id, status) WHERE status = 'Open';
CREATE INDEX idx_aa_det_antipattern ON aa_antipattern_detection (antipattern_id);

-- Architecture assessment reports
CREATE TABLE aa_assessment_report (
    report_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    scope_filter_json       JSONB,
    assessment_date         DATE NOT NULL,
    workloads_analyzed      INTEGER NOT NULL,
    antipatterns_detected   INTEGER NOT NULL,
    total_waste_amount      NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    overall_maturity_score  NUMERIC(5,4),
    narrative_summary       TEXT,
    report_artifact_uri     TEXT,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by_agent_id   UUID REFERENCES agent_identity(agent_id)
);
CREATE INDEX idx_aa_report_tenant_date ON aa_assessment_report (tenant_id, assessment_date DESC);

-- Architecture recommendations (migration/refactoring)
CREATE TABLE aa_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    detection_id            UUID REFERENCES aa_antipattern_detection(detection_id),
    classification_id       UUID REFERENCES aa_workload_classification(classification_id),
    report_id               UUID REFERENCES aa_assessment_report(report_id),
    migration_target        aa_migration_target NOT NULL,
    current_architecture_json JSONB NOT NULL,
    target_architecture_json JSONB NOT NULL,
    estimated_migration_effort_hrs INTEGER,
    estimated_monthly_savings NUMERIC(18,4) NOT NULL,
    estimated_annual_savings NUMERIC(18,4) NOT NULL,
    estimated_migration_cost NUMERIC(18,4),
    payback_months          INTEGER,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    confidence              opt_confidence_level NOT NULL,
    performance_impact      opt_performance_impact NOT NULL,
    priority                opt_priority_tier NOT NULL,
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    rationale               TEXT,
    dependencies_json       JSONB,
    reviewed_by             UUID REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id),
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aa_rec_tenant_status ON aa_recommendation (tenant_id, status);
CREATE INDEX idx_aa_rec_priority ON aa_recommendation (priority, estimated_annual_savings DESC) WHERE status = 'Pending_Review';

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE wo_utilization_baseline    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wo_finding                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE wo_recommendation          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wo_execution_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wo_savings_realized        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ro_commitment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ro_recommendation          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ro_spot_opportunity        ENABLE ROW LEVEL SECURITY;
ALTER TABLE aa_workload_classification ENABLE ROW LEVEL SECURITY;
ALTER TABLE aa_antipattern_detection   ENABLE ROW LEVEL SECURITY;
ALTER TABLE aa_assessment_report       ENABLE ROW LEVEL SECURITY;
ALTER TABLE aa_recommendation          ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_wo_base   ON wo_utilization_baseline USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_wo_find   ON wo_finding              USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_wo_rec    ON wo_recommendation       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_wo_exec   ON wo_execution_log        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_wo_save   ON wo_savings_realized     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ro_com    ON ro_commitment           USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ro_rec    ON ro_recommendation       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ro_spot   ON ro_spot_opportunity     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_aa_class  ON aa_workload_classification USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_aa_det    ON aa_antipattern_detection USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_aa_rep    ON aa_assessment_report    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_aa_rec    ON aa_recommendation       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF WAVE 3a — A11 Workload Optimizer + A12 Rate Optimizer + A13 Architecture Advisor
-- Tables: 13 (A11: 5, A12: 3, A13: 5)
-- Enums: 10 (4 shared Optimize pattern + 2 A11 + 3 A12 + 2 A13 categories — minus 1 shared reuse)
-- Actually: 4 shared opt_* + 2 wo_* + 3 ro_* + 2 aa_* = 11 enums
-- Indexes: 26
-- RLS Policies: 12
-- Shared pattern established: finding → recommendation → execution → savings_realized
-- Reused across Wave 3b (A14/A15/A16) and Wave 3c (A17/A18/A19)
-- =============================================================================
