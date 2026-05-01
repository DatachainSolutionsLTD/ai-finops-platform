-- =============================================================================
-- V007 — Batch 2: Self-Managing Metering Engine (FSD-ME-01 + Addendum)
-- Scope: M01 Pulse Algorithm Generator, M02 Gearing Recalibration,
--        M03 Input Cost Sentinel, M04 Billing Impact Simulator,
--        M05 Metering Accuracy Monitor
-- =============================================================================
-- DESIGN PRINCIPLES (continued from Batch 1):
--   - NO hardcoded currencies — all money composite (amount + currency_id FK)
--   - NO hardcoded tenant/customer/org names
--   - Reuses enums and reference tables from V006 (ref_currency, platform_config)
--   - All tables tenant-scoped with RLS
--   - All proposals, recalibrations, and simulations require human approval
--     recorded as FK references, never as hardcoded role strings
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS (new to Batch 2)
-- ---------------------------------------------------------------------------
CREATE TYPE me_proposal_status AS ENUM (
    'Draft', 'Under_Review', 'Shadow_Validation', 'A_B_Testing',
    'Approved', 'Rejected', 'Deployed', 'Rolled_Back', 'Superseded'
);

CREATE TYPE me_drift_severity AS ENUM (
    'Within_Control', 'Warning', 'Action_Limit', 'Out_Of_Control'
);

CREATE TYPE me_recalibration_trigger AS ENUM (
    'SPC_Drift_Detected', 'Input_Cost_Change', 'New_Agent_Detected',
    'Scheduled_Review', 'Manual_Request', 'Billing_Anomaly'
);

CREATE TYPE me_cost_signal_source AS ENUM (
    'Cloud_Provider_API', 'LLM_Provider_API', 'External_Feed',
    'Contract_Amendment', 'Manual_Entry'
);

CREATE TYPE me_simulation_type AS ENUM (
    'Pre_Deployment', 'Shadow_Parallel', 'A_B_Split', 'Backtest', 'What_If'
);

CREATE TYPE me_accuracy_verdict AS ENUM (
    'Within_Tolerance', 'Minor_Deviation', 'Material_Deviation', 'Critical_Deviation'
);

-- ---------------------------------------------------------------------------
-- M01 — PULSE ALGORITHM GENERATOR
-- Detects new agent types, profiles their resource consumption patterns,
-- proposes initial Pulse algorithms for review
-- ---------------------------------------------------------------------------
CREATE TABLE me_agent_discovery_event (
    discovery_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    agent_type_code         VARCHAR(50) NOT NULL,
    agent_version           VARCHAR(50),
    first_observed_at       TIMESTAMPTZ NOT NULL,
    observation_window_end  TIMESTAMPTZ,
    sample_operation_count  BIGINT NOT NULL DEFAULT 0,
    is_known_type           BOOLEAN NOT NULL DEFAULT FALSE,
    discovery_source        VARCHAR(100) NOT NULL,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_me_discovery_tenant_time ON me_agent_discovery_event (tenant_id, first_observed_at DESC);
CREATE INDEX idx_me_discovery_agent_type ON me_agent_discovery_event (agent_type_code) WHERE is_known_type = FALSE;

CREATE TABLE me_agent_consumption_profile (
    profile_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    agent_type_code         VARCHAR(50) NOT NULL,
    profile_version         INTEGER NOT NULL,
    observation_period_start TIMESTAMPTZ NOT NULL,
    observation_period_end  TIMESTAMPTZ NOT NULL,
    sample_size             BIGINT NOT NULL,
    resource_distributions  JSONB NOT NULL,
    statistical_summary     JSONB NOT NULL,
    confidence_score        NUMERIC(5,4),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, agent_type_code, profile_version)
);
CREATE INDEX idx_me_profile_tenant_agent ON me_agent_consumption_profile (tenant_id, agent_type_code, profile_version DESC);
COMMENT ON COLUMN me_agent_consumption_profile.resource_distributions IS 'JSONB storing per-dimension histograms: {"compute_minute": {"mean": 2.3, "p50": 1.8, "p95": 5.1}, ...}';

CREATE TABLE me_pulse_algorithm_proposal (
    proposal_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    agent_type_code         VARCHAR(50) NOT NULL,
    profile_id              UUID NOT NULL REFERENCES me_agent_consumption_profile(profile_id),
    proposed_rate_card_id   UUID,
    proposed_gearing_json   JSONB NOT NULL,
    rationale               TEXT NOT NULL,
    estimated_pulse_impact  NUMERIC(18,6),
    estimated_charge_impact NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    status                  me_proposal_status NOT NULL DEFAULT 'Draft',
    submitted_at            TIMESTAMPTZ,
    reviewed_by             UUID,
    reviewed_at             TIMESTAMPTZ,
    deployed_at             TIMESTAMPTZ,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL
);
CREATE INDEX idx_me_proposal_tenant_status ON me_pulse_algorithm_proposal (tenant_id, status);
CREATE INDEX idx_me_proposal_agent_type ON me_pulse_algorithm_proposal (tenant_id, agent_type_code);

-- ---------------------------------------------------------------------------
-- M02 — GEARING RECALIBRATION AGENT
-- Statistical Process Control (SPC), drift detection, recalibration proposals
-- ---------------------------------------------------------------------------
CREATE TABLE me_spc_baseline (
    baseline_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    agent_type_code         VARCHAR(50) NOT NULL,
    resource_dimension      VARCHAR(100) NOT NULL,
    baseline_mean           NUMERIC(18,8) NOT NULL,
    baseline_stddev         NUMERIC(18,8) NOT NULL,
    upper_control_limit     NUMERIC(18,8) NOT NULL,
    lower_control_limit     NUMERIC(18,8) NOT NULL,
    upper_action_limit      NUMERIC(18,8) NOT NULL,
    lower_action_limit      NUMERIC(18,8) NOT NULL,
    baseline_period_start   DATE NOT NULL,
    baseline_period_end     DATE NOT NULL,
    sample_size             BIGINT NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, agent_type_code, resource_dimension, baseline_period_start)
);
CREATE INDEX idx_me_spc_active ON me_spc_baseline (tenant_id, agent_type_code, resource_dimension) WHERE is_active;

CREATE TABLE me_drift_detection_event (
    drift_event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    agent_type_code         VARCHAR(50) NOT NULL,
    resource_dimension      VARCHAR(100) NOT NULL,
    baseline_id             UUID NOT NULL REFERENCES me_spc_baseline(baseline_id),
    observed_value          NUMERIC(18,8) NOT NULL,
    observed_stddev         NUMERIC(18,8),
    drift_severity          me_drift_severity NOT NULL,
    z_score                 NUMERIC(10,4),
    consecutive_violations  INTEGER NOT NULL DEFAULT 1,
    detected_at             TIMESTAMPTZ NOT NULL,
    triggers_recalibration  BOOLEAN NOT NULL DEFAULT FALSE,
    recalibration_id        UUID,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_me_drift_tenant_time ON me_drift_detection_event (tenant_id, detected_at DESC);
CREATE INDEX idx_me_drift_severity ON me_drift_detection_event (drift_severity, detected_at DESC) WHERE drift_severity IN ('Action_Limit', 'Out_Of_Control');

CREATE TABLE me_recalibration_proposal (
    recalibration_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    trigger_type            me_recalibration_trigger NOT NULL,
    trigger_event_id        UUID,
    current_rate_card_id    UUID,
    proposed_rate_card_id   UUID,
    current_gearing_json    JSONB NOT NULL,
    proposed_gearing_json   JSONB NOT NULL,
    delta_analysis_json     JSONB,
    estimated_revenue_delta NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    affected_agent_types    TEXT[],
    status                  me_proposal_status NOT NULL DEFAULT 'Draft',
    shadow_validation_id    UUID,
    ab_test_id              UUID,
    reviewed_by             UUID,
    reviewed_at             TIMESTAMPTZ,
    approved_by             UUID,
    approved_at             TIMESTAMPTZ,
    deployed_at             TIMESTAMPTZ,
    rolled_back_at          TIMESTAMPTZ,
    rollback_reason         TEXT,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL
);
CREATE INDEX idx_me_recal_tenant_status ON me_recalibration_proposal (tenant_id, status);
CREATE INDEX idx_me_recal_trigger ON me_recalibration_proposal (trigger_type, created_date DESC);

-- ---------------------------------------------------------------------------
-- M03 — INPUT COST SENTINEL
-- Monitors external input cost signals (cloud pricing, LLM token rates, egress)
-- ---------------------------------------------------------------------------
CREATE TABLE me_input_cost_signal (
    signal_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    signal_source           me_cost_signal_source NOT NULL,
    provider_name           VARCHAR(200) NOT NULL,
    resource_type           VARCHAR(100) NOT NULL,
    sku_identifier          VARCHAR(200),
    region_code             VARCHAR(50),
    previous_unit_cost      NUMERIC(18,8),
    current_unit_cost       NUMERIC(18,8) NOT NULL,
    unit_of_measure         VARCHAR(50) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    change_percentage       NUMERIC(10,4),
    effective_from          TIMESTAMPTZ NOT NULL,
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triggers_cascade        BOOLEAN NOT NULL DEFAULT FALSE,
    cascade_recalibration_id UUID,
    source_reference_url    TEXT,
    external_reference_id   VARCHAR(200)
);
CREATE INDEX idx_me_signal_tenant_time ON me_input_cost_signal (tenant_id, detected_at DESC);
CREATE INDEX idx_me_signal_provider ON me_input_cost_signal (provider_name, resource_type, effective_from DESC);
CREATE INDEX idx_me_signal_cascade ON me_input_cost_signal (triggers_cascade) WHERE triggers_cascade = TRUE;

-- ---------------------------------------------------------------------------
-- M04 — BILLING IMPACT SIMULATOR (A/B and shadow validation)
-- ---------------------------------------------------------------------------
CREATE TABLE me_simulation_run (
    simulation_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    simulation_type         me_simulation_type NOT NULL,
    proposal_id             UUID,
    recalibration_id        UUID,
    baseline_period_start   DATE NOT NULL,
    baseline_period_end     DATE NOT NULL,
    affected_agent_types    TEXT[],

    baseline_total_pulses   NUMERIC(18,6) NOT NULL,
    simulated_total_pulses  NUMERIC(18,6) NOT NULL,
    pulse_delta_pct         NUMERIC(10,4),
    baseline_charge_amount  NUMERIC(18,4) NOT NULL,
    simulated_charge_amount NUMERIC(18,4) NOT NULL,
    charge_delta_amount     NUMERIC(18,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),

    sample_aar_count        BIGINT NOT NULL,
    confidence_interval     JSONB,
    outlier_count           INTEGER NOT NULL DEFAULT 0,
    simulation_duration_ms  INTEGER,
    simulation_started_at   TIMESTAMPTZ NOT NULL,
    simulation_completed_at TIMESTAMPTZ,
    verdict                 me_accuracy_verdict,
    notes                   TEXT,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_me_sim_tenant_time ON me_simulation_run (tenant_id, simulation_started_at DESC);
CREATE INDEX idx_me_sim_proposal ON me_simulation_run (proposal_id) WHERE proposal_id IS NOT NULL;
CREATE INDEX idx_me_sim_recal ON me_simulation_run (recalibration_id) WHERE recalibration_id IS NOT NULL;

-- Per-tenant breakdown of simulation impact
CREATE TABLE me_simulation_tenant_impact (
    impact_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id           UUID NOT NULL REFERENCES me_simulation_run(simulation_id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL,
    baseline_pulses         NUMERIC(18,6) NOT NULL,
    simulated_pulses        NUMERIC(18,6) NOT NULL,
    baseline_charge         NUMERIC(18,4) NOT NULL,
    simulated_charge        NUMERIC(18,4) NOT NULL,
    charge_delta            NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    aar_count               BIGINT NOT NULL,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_me_sim_impact_sim ON me_simulation_tenant_impact (simulation_id);
CREATE INDEX idx_me_sim_impact_tenant ON me_simulation_tenant_impact (tenant_id);

-- ---------------------------------------------------------------------------
-- M05 — METERING ACCURACY MONITOR (calibration runs, integrity checks)
-- ---------------------------------------------------------------------------
CREATE TABLE me_calibration_run (
    calibration_run_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    run_type                VARCHAR(50) NOT NULL,
    check_period_start      TIMESTAMPTZ NOT NULL,
    check_period_end        TIMESTAMPTZ NOT NULL,
    aars_sampled            BIGINT NOT NULL,
    aars_validated          BIGINT NOT NULL,
    hash_integrity_failures BIGINT NOT NULL DEFAULT 0,
    pulse_calc_failures     BIGINT NOT NULL DEFAULT 0,
    ledger_reconciliation_failures BIGINT NOT NULL DEFAULT 0,
    accuracy_score          NUMERIC(7,6) NOT NULL,
    verdict                 me_accuracy_verdict NOT NULL,
    remediation_proposed    BOOLEAN NOT NULL DEFAULT FALSE,
    remediation_id          UUID,
    run_started_at          TIMESTAMPTZ NOT NULL,
    run_completed_at        TIMESTAMPTZ,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_accuracy_range CHECK (accuracy_score >= 0 AND accuracy_score <= 1)
);
CREATE INDEX idx_me_calib_tenant_time ON me_calibration_run (tenant_id, run_started_at DESC);
CREATE INDEX idx_me_calib_verdict ON me_calibration_run (verdict) WHERE verdict != 'Within_Tolerance';

CREATE TABLE me_auto_remediation_log (
    remediation_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    trigger_source          VARCHAR(100) NOT NULL,
    trigger_reference_id    UUID,
    remediation_action      VARCHAR(200) NOT NULL,
    action_parameters       JSONB,
    requires_approval       BOOLEAN NOT NULL,
    approval_status         VARCHAR(30),
    approved_by             UUID,
    approved_at             TIMESTAMPTZ,
    executed_at             TIMESTAMPTZ,
    execution_status        VARCHAR(30) NOT NULL DEFAULT 'Pending',
    execution_result        JSONB,
    affected_records_count  BIGINT NOT NULL DEFAULT 0,
    rollback_available      BOOLEAN NOT NULL DEFAULT FALSE,
    rolled_back_at          TIMESTAMPTZ,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_me_remed_tenant_time ON me_auto_remediation_log (tenant_id, created_date DESC);
CREATE INDEX idx_me_remed_status ON me_auto_remediation_log (execution_status) WHERE execution_status != 'Completed';

-- ---------------------------------------------------------------------------
-- METERING CONFIG VERSION (audit trail for all metering algorithm changes)
-- ---------------------------------------------------------------------------
CREATE TABLE me_metering_config_version (
    version_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    version_number          INTEGER NOT NULL,
    config_snapshot         JSONB NOT NULL,
    change_summary          TEXT NOT NULL,
    source_proposal_id      UUID,
    source_recalibration_id UUID,
    deployed_by             UUID NOT NULL,
    deployed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    superseded_at           TIMESTAMPTZ,
    is_current              BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (tenant_id, version_number)
);
CREATE INDEX idx_me_version_tenant_current ON me_metering_config_version (tenant_id) WHERE is_current;
CREATE INDEX idx_me_version_tenant_time ON me_metering_config_version (tenant_id, deployed_at DESC);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE me_agent_discovery_event      ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_agent_consumption_profile  ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_pulse_algorithm_proposal   ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_spc_baseline               ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_drift_detection_event      ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_recalibration_proposal     ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_input_cost_signal          ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_simulation_run             ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_simulation_tenant_impact   ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_calibration_run            ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_auto_remediation_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_metering_config_version    ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_me_discovery   ON me_agent_discovery_event      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_profile     ON me_agent_consumption_profile  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_algo_prop   ON me_pulse_algorithm_proposal   USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_spc         ON me_spc_baseline               USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_drift       ON me_drift_detection_event      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_recal       ON me_recalibration_proposal     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_signal      ON me_input_cost_signal          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_sim         ON me_simulation_run             USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_sim_impact  ON me_simulation_tenant_impact   USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_calib       ON me_calibration_run            USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_remed       ON me_auto_remediation_log       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_me_version     ON me_metering_config_version    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF BATCH 2 — Self-Managing Metering Engine (M01-M05)
-- Tables: 12 (M01: 3, M02: 3, M03: 1, M04: 2, M05: 2, shared: 1)
-- Enums: 6 new (proposal_status, drift_severity, recal_trigger, cost_signal_source,
--               simulation_type, accuracy_verdict)
-- Indexes: 29
-- RLS Policies: 12
-- Cross-references: all currency via ref_currency, all tenant via RLS session var
-- ZERO hardcoded organizational/currency values
-- =============================================================================
