-- =============================================================================
-- V020 — Wave 4c: A26 Intersecting Disciplines + A32 Continuous Learning
-- Sources: A26-FSD-ID-01, A32-FSD-CL-32
-- =============================================================================
-- Platform intelligence layer — completes Wave 4 (Manage agents).
-- A26 bridges FinOps with DevOps/SecOps/DataOps/ITSM disciplines.
-- A32 monitors model performance and orchestrates retraining across all 31 agents.
--
-- Reuses: gov_severity, opt_priority_tier, opt_confidence_level,
--         agent_autonomy_level, forecast_drift_severity
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- A26 Intersecting Disciplines
CREATE TYPE id_discipline AS ENUM (
    'DevOps', 'SecOps', 'DataOps', 'ITSM', 'ITAM',
    'GRC', 'Procurement', 'Sustainability', 'Product_Management',
    'Engineering', 'Enterprise_Architecture'
);

CREATE TYPE id_integration_direction AS ENUM (
    'Inbound', 'Outbound', 'Bidirectional'
);

CREATE TYPE id_integration_health AS ENUM (
    'Healthy', 'Degraded', 'Partial_Outage', 'Failed', 'Unknown'
);

CREATE TYPE id_sync_status AS ENUM (
    'Pending', 'In_Progress', 'Completed', 'Failed', 'Partial_Success', 'Skipped'
);

-- A32 Continuous Learning
CREATE TYPE cl_model_registry_status AS ENUM (
    'Training', 'Candidate', 'Shadow', 'AB_Testing',
    'Production', 'Deprecated', 'Rolled_Back', 'Archived'
);

CREATE TYPE cl_retrain_trigger AS ENUM (
    'Drift_Detected', 'Scheduled_Interval', 'Accuracy_Degradation',
    'Feedback_Threshold', 'Manual_Request', 'Upstream_Data_Change'
);

CREATE TYPE cl_feedback_source AS ENUM (
    'Explicit_Rating', 'Approval_Action', 'Rejection_Action',
    'Override_Action', 'Dismissal', 'Implementation_Outcome', 'User_Correction'
);

CREATE TYPE cl_ab_test_verdict AS ENUM (
    'Candidate_Superior', 'Control_Superior', 'Inconclusive',
    'Candidate_Unsafe', 'Terminated_Early'
);

-- ============================================================================
-- A26 — INTERSECTING DISCIPLINES AGENT
-- ============================================================================

-- Discipline integration registry (one entry per tenant × discipline × system)
CREATE TABLE id_discipline_integration (
    integration_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    discipline              id_discipline NOT NULL,
    external_system_name    VARCHAR(200) NOT NULL,
    external_system_type    VARCHAR(100),
    integration_direction   id_integration_direction NOT NULL,
    connection_config_json  JSONB NOT NULL,
    credential_vault_path   VARCHAR(500),
    sync_frequency_minutes  INTEGER,
    data_contracts_json     JSONB,
    field_mappings_json     JSONB,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at            TIMESTAMPTZ,
    last_successful_sync_at TIMESTAMPTZ,
    current_health          id_integration_health NOT NULL DEFAULT 'Unknown',
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id),
    UNIQUE (tenant_id, discipline, external_system_name)
);
CREATE INDEX idx_id_int_tenant_disc ON id_discipline_integration (tenant_id, discipline) WHERE is_active;
CREATE INDEX idx_id_int_unhealthy ON id_discipline_integration (current_health) WHERE is_active AND current_health != 'Healthy';

-- Sync events (every data exchange with an external discipline system)
CREATE TABLE id_sync_event (
    sync_event_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    integration_id          UUID NOT NULL REFERENCES id_discipline_integration(integration_id),
    direction               id_integration_direction NOT NULL,
    entity_type             VARCHAR(200) NOT NULL,
    records_processed       BIGINT NOT NULL DEFAULT 0,
    records_succeeded       BIGINT NOT NULL DEFAULT 0,
    records_failed          BIGINT NOT NULL DEFAULT 0,
    status                  id_sync_status NOT NULL DEFAULT 'Pending',
    started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    duration_ms             INTEGER,
    error_detail            TEXT,
    payload_sample_json     JSONB,
    external_batch_id       VARCHAR(200)
);
CREATE INDEX idx_id_sync_int_time ON id_sync_event (integration_id, started_at DESC);
CREATE INDEX idx_id_sync_tenant_status ON id_sync_event (tenant_id, status, started_at DESC);
CREATE INDEX idx_id_sync_failed ON id_sync_event (status) WHERE status IN ('Failed', 'Partial_Success');

-- Cross-discipline alignment records (shared objectives across teams)
CREATE TABLE id_alignment_record (
    alignment_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    primary_discipline      id_discipline NOT NULL,
    secondary_disciplines   id_discipline[],
    alignment_topic         VARCHAR(500) NOT NULL,
    shared_objective        TEXT NOT NULL,
    shared_metrics_json     JSONB,
    alignment_score         NUMERIC(5,4),
    gaps_detected_json      JSONB,
    recommendations_json    JSONB,
    scope_filter_json       JSONB,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by_agent_id   UUID REFERENCES agent_identity(agent_id),
    review_status           VARCHAR(30) NOT NULL DEFAULT 'Generated',
    reviewed_by             UUID REFERENCES auth_user(user_id),
    reviewed_at             TIMESTAMPTZ
);
CREATE INDEX idx_id_align_tenant_time ON id_alignment_record (tenant_id, generated_at DESC);
CREATE INDEX idx_id_align_disciplines ON id_alignment_record USING GIN (secondary_disciplines);

-- ITSM ticket bridge (A26 creates tickets in ServiceNow/Jira/etc for FinOps findings)
CREATE TABLE id_external_ticket (
    external_ticket_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    integration_id          UUID NOT NULL REFERENCES id_discipline_integration(integration_id),
    source_entity_type      VARCHAR(100) NOT NULL,
    source_entity_id        UUID NOT NULL,
    external_ticket_ref     VARCHAR(500) NOT NULL,
    external_ticket_url     TEXT,
    ticket_title            VARCHAR(500) NOT NULL,
    ticket_priority         VARCHAR(50),
    ticket_status           VARCHAR(100),
    assignee_external_id    VARCHAR(500),
    created_in_external_at  TIMESTAMPTZ,
    last_status_sync_at     TIMESTAMPTZ,
    closed_at               TIMESTAMPTZ,
    resolution_notes        TEXT,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (integration_id, external_ticket_ref)
);
CREATE INDEX idx_id_ticket_source ON id_external_ticket (source_entity_type, source_entity_id);
CREATE INDEX idx_id_ticket_tenant_open ON id_external_ticket (tenant_id) WHERE closed_at IS NULL;

-- Cross-discipline conflict log (handed to A28 Conflict Resolution when detected)
CREATE TABLE id_workflow_conflict (
    workflow_conflict_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    discipline_a            id_discipline NOT NULL,
    discipline_b            id_discipline NOT NULL,
    conflict_summary        TEXT NOT NULL,
    affected_entities_json  JSONB,
    severity                gov_severity NOT NULL,
    a28_conflict_id         UUID,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Detected',
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ
);
CREATE INDEX idx_id_wf_tenant_status ON id_workflow_conflict (tenant_id, status);

-- ============================================================================
-- A32 — CONTINUOUS LEARNING AGENT
-- ============================================================================

-- Model registry (every model version every agent ever ran)
CREATE TABLE cl_model_registry (
    model_version_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    owning_agent_id         UUID NOT NULL REFERENCES agent_identity(agent_id),
    model_name              VARCHAR(200) NOT NULL,
    model_family            VARCHAR(100),
    version_number          VARCHAR(50) NOT NULL,
    model_artifact_uri      TEXT NOT NULL,
    hyperparameters_json    JSONB,
    training_data_window_start DATE,
    training_data_window_end   DATE,
    training_sample_count   BIGINT,
    status                  cl_model_registry_status NOT NULL DEFAULT 'Training',
    is_tenant_specific      BOOLEAN NOT NULL DEFAULT FALSE,
    parent_model_version_id UUID REFERENCES cl_model_registry(model_version_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted_to_production_at TIMESTAMPTZ,
    deprecated_at           TIMESTAMPTZ,
    rolled_back_at          TIMESTAMPTZ,
    UNIQUE (owning_agent_id, tenant_id, model_name, version_number)
);
CREATE INDEX idx_cl_model_agent_status ON cl_model_registry (owning_agent_id, status);
CREATE INDEX idx_cl_model_tenant ON cl_model_registry (tenant_id) WHERE is_tenant_specific;
CREATE INDEX idx_cl_model_production ON cl_model_registry (owning_agent_id) WHERE status = 'Production';

-- Performance monitoring (per model version per period)
CREATE TABLE cl_performance_measurement (
    measurement_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    model_version_id        UUID NOT NULL REFERENCES cl_model_registry(model_version_id),
    measurement_period_start DATE NOT NULL,
    measurement_period_end   DATE NOT NULL,
    predictions_count       BIGINT NOT NULL,
    accuracy_score          NUMERIC(7,6),
    precision_score         NUMERIC(7,6),
    recall_score            NUMERIC(7,6),
    f1_score                NUMERIC(7,6),
    mape_score              NUMERIC(10,6),
    rmse_score              NUMERIC(18,6),
    auc_score               NUMERIC(7,6),
    additional_metrics_json JSONB,
    drift_severity          forecast_drift_severity,
    degradation_pct         NUMERIC(10,4),
    measured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (model_version_id, tenant_id, measurement_period_start)
);
CREATE INDEX idx_cl_perf_model_period ON cl_performance_measurement (model_version_id, measurement_period_end DESC);
CREATE INDEX idx_cl_perf_drift ON cl_performance_measurement (drift_severity, measured_at DESC) WHERE drift_severity IN ('Moderate', 'Severe');

-- Feedback signals (human actions that inform retraining)
CREATE TABLE cl_feedback_signal (
    feedback_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    model_version_id        UUID REFERENCES cl_model_registry(model_version_id),
    source_agent_id         UUID REFERENCES agent_identity(agent_id),
    source_entity_type      VARCHAR(100) NOT NULL,
    source_entity_id        UUID NOT NULL,
    feedback_source         cl_feedback_source NOT NULL,
    feedback_value_json     JSONB NOT NULL,
    label_correction_json   JSONB,
    user_id                 UUID REFERENCES auth_user(user_id),
    captured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cl_fb_model_time ON cl_feedback_signal (model_version_id, captured_at DESC);
CREATE INDEX idx_cl_fb_tenant_source ON cl_feedback_signal (tenant_id, feedback_source, captured_at DESC);
CREATE INDEX idx_cl_fb_entity ON cl_feedback_signal (source_entity_type, source_entity_id);

-- Retraining runs
CREATE TABLE cl_retrain_run (
    retrain_run_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    owning_agent_id         UUID NOT NULL REFERENCES agent_identity(agent_id),
    baseline_model_version_id UUID REFERENCES cl_model_registry(model_version_id),
    candidate_model_version_id UUID REFERENCES cl_model_registry(model_version_id),
    trigger_type            cl_retrain_trigger NOT NULL,
    trigger_reference_id    UUID,
    training_data_window_start DATE NOT NULL,
    training_data_window_end   DATE NOT NULL,
    feedback_signals_count  BIGINT NOT NULL DEFAULT 0,
    training_sample_count   BIGINT NOT NULL,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Running',
    started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    duration_ms             INTEGER,
    rationale               TEXT,
    error_detail            TEXT
);
CREATE INDEX idx_cl_retrain_agent_time ON cl_retrain_run (owning_agent_id, started_at DESC);
CREATE INDEX idx_cl_retrain_tenant_time ON cl_retrain_run (tenant_id, started_at DESC) WHERE tenant_id IS NOT NULL;

-- A/B tests (shadow testing of candidate models against production baseline)
CREATE TABLE cl_ab_test (
    ab_test_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    owning_agent_id         UUID NOT NULL REFERENCES agent_identity(agent_id),
    baseline_model_version_id UUID NOT NULL REFERENCES cl_model_registry(model_version_id),
    candidate_model_version_id UUID NOT NULL REFERENCES cl_model_registry(model_version_id),
    test_name               VARCHAR(200) NOT NULL,
    traffic_split_pct       NUMERIC(5,2) NOT NULL,
    test_period_start       TIMESTAMPTZ NOT NULL,
    test_period_end         TIMESTAMPTZ,
    baseline_predictions    BIGINT NOT NULL DEFAULT 0,
    candidate_predictions   BIGINT NOT NULL DEFAULT 0,
    baseline_accuracy       NUMERIC(7,6),
    candidate_accuracy      NUMERIC(7,6),
    statistical_significance NUMERIC(7,6),
    verdict                 cl_ab_test_verdict,
    verdict_rationale       TEXT,
    verdict_decided_at      TIMESTAMPTZ,
    verdict_decided_by      UUID REFERENCES auth_user(user_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_traffic_split CHECK (traffic_split_pct BETWEEN 0 AND 100)
);
CREATE INDEX idx_cl_ab_agent ON cl_ab_test (owning_agent_id, created_at DESC);
CREATE INDEX idx_cl_ab_active ON cl_ab_test (test_period_end) WHERE verdict IS NULL;

-- Model deployment audit (every promotion/rollback)
CREATE TABLE cl_deployment_audit (
    deployment_audit_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    owning_agent_id         UUID NOT NULL REFERENCES agent_identity(agent_id),
    from_model_version_id   UUID REFERENCES cl_model_registry(model_version_id),
    to_model_version_id     UUID NOT NULL REFERENCES cl_model_registry(model_version_id),
    deployment_action       VARCHAR(50) NOT NULL,
    ab_test_id              UUID REFERENCES cl_ab_test(ab_test_id),
    rationale               TEXT NOT NULL,
    approved_by             UUID REFERENCES auth_user(user_id),
    deployed_by_agent_id    UUID REFERENCES agent_identity(agent_id),
    deployed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cl_dep_agent_time ON cl_deployment_audit (owning_agent_id, deployed_at DESC);
CREATE INDEX idx_cl_dep_tenant_time ON cl_deployment_audit (tenant_id, deployed_at DESC) WHERE tenant_id IS NOT NULL;

-- System-wide learning reports (periodic rollup across all 31 agents)
CREATE TABLE cl_system_learning_report (
    report_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    report_period_start     DATE NOT NULL,
    report_period_end       DATE NOT NULL,
    agents_monitored        INTEGER NOT NULL,
    models_in_production    INTEGER NOT NULL,
    retrains_executed       INTEGER NOT NULL,
    ab_tests_completed      INTEGER NOT NULL,
    promotions_count        INTEGER NOT NULL,
    rollbacks_count         INTEGER NOT NULL,
    avg_accuracy_score      NUMERIC(7,6),
    improvement_velocity    NUMERIC(10,6),
    agent_metrics_json      JSONB NOT NULL,
    narrative_summary       TEXT,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    report_artifact_uri     TEXT
);
CREATE INDEX idx_cl_report_tenant_period ON cl_system_learning_report (tenant_id, report_period_end DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_cl_report_platform_period ON cl_system_learning_report (report_period_end DESC) WHERE tenant_id IS NULL;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE id_discipline_integration   ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_sync_event               ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_alignment_record         ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_external_ticket          ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_workflow_conflict        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cl_model_registry           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cl_performance_measurement  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cl_feedback_signal          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cl_retrain_run              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cl_ab_test                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cl_deployment_audit         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cl_system_learning_report   ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_id_int    ON id_discipline_integration USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_id_sync   ON id_sync_event             USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_id_align  ON id_alignment_record       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_id_tkt    ON id_external_ticket        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_id_wf     ON id_workflow_conflict      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- CL tables: tenant_id may be NULL for platform-wide models; allow if NULL or matching
CREATE POLICY tenant_iso_cl_mdl    ON cl_model_registry          USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cl_perf   ON cl_performance_measurement USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cl_fb     ON cl_feedback_signal         USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cl_retr   ON cl_retrain_run             USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cl_ab     ON cl_ab_test                 USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cl_dep    ON cl_deployment_audit        USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cl_rpt    ON cl_system_learning_report  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF WAVE 4c — A26 Intersecting Disciplines + A32 Continuous Learning
-- Tables: 12 (A26: 5, A32: 7)
-- Enums: 8 new
-- Indexes: 29
-- RLS Policies: 12
-- Reuses: gov_severity, forecast_drift_severity, agent_autonomy_level
--
-- WAVE 4 COMPLETE: A22, A25, A26, A28, A29, A30, A32 (7 Manage agents)
--   V018 (4a): 13 tables (A22/A25)
--   V019 (4b): 12 tables (A28/A29/A30)
--   V020 (4c): 12 tables (A26/A32)
--   TOTAL WAVE 4: 37 tables, 28 enums, 82 indexes, 32 RLS policies
-- =============================================================================
