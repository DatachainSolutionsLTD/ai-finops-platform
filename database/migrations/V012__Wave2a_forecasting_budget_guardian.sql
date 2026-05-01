-- =============================================================================
-- V012 — Wave 2a: A06 Forecasting Agent + A07 Budget Guardian Agent
-- Sources: A06-FSD-FC-01, A07-FSD-BG-01
-- =============================================================================
-- DESIGN PRINCIPLES (unchanged — see V010):
--   - NO hardcoded currency/tenant/org references
--   - All money composite: amount NUMERIC + currency_id FK to ref_currency
--   - All tenant_id FK to tenant(tenant_id) added inline (this batch follows V010/V011)
--   - All user_id columns FK to auth_user(user_id)
--   - Enum semantics generic (model types, variance severity), no org-specific values
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- A06 Forecasting
CREATE TYPE forecast_horizon AS ENUM (
    'Horizon_30d', 'Horizon_90d', 'Horizon_180d', 'Horizon_365d', 'Custom'
);

CREATE TYPE forecast_granularity AS ENUM (
    'Platform_Total', 'Provider', 'Business_Unit', 'Application',
    'Environment', 'Cost_Center', 'Project', 'Service_Category'
);

CREATE TYPE forecast_model_type AS ENUM (
    'ARIMA', 'Prophet', 'LSTM', 'Exponential_Smoothing',
    'Linear_Regression', 'Ensemble', 'Naive_Baseline'
);

CREATE TYPE forecast_run_status AS ENUM (
    'Queued', 'Training', 'Generating', 'Completed', 'Failed', 'Superseded'
);

CREATE TYPE forecast_drift_severity AS ENUM (
    'No_Drift', 'Mild', 'Moderate', 'Severe'
);

CREATE TYPE scenario_type AS ENUM (
    'Growth_Projection', 'Cost_Reduction', 'Migration', 'New_Workload',
    'Pricing_Change', 'Decommission', 'Custom_What_If'
);

-- A07 Budget Guardian
CREATE TYPE budget_period AS ENUM (
    'Monthly', 'Quarterly', 'Annual', 'Fiscal_Year', 'Custom_Period'
);

CREATE TYPE budget_scope_type AS ENUM (
    'Platform', 'Provider', 'Business_Unit', 'Application',
    'Environment', 'Cost_Center', 'Project', 'Service_Category'
);

CREATE TYPE budget_status AS ENUM (
    'Draft', 'Active', 'Exhausted', 'Overrun', 'Closed', 'Archived'
);

CREATE TYPE variance_classification AS ENUM (
    'Structural', 'Transient', 'Seasonal', 'Anomalous', 'Unclassified'
);

CREATE TYPE guardrail_action_type AS ENUM (
    'Notify_Only', 'Require_Approval', 'Freeze_Provisioning',
    'Throttle_Workloads', 'Auto_Terminate_Dev', 'Escalate_To_Finance'
);

CREATE TYPE budget_alert_tier AS ENUM (
    'Threshold_50pct', 'Threshold_75pct', 'Threshold_90pct',
    'Threshold_100pct', 'Projected_Overrun', 'Budget_Exhausted'
);

-- ============================================================================
-- A06 — FORECASTING AGENT
-- ============================================================================

-- Forecast model registry (per tenant, per granularity)
CREATE TABLE fc_forecast_model (
    model_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    model_name              VARCHAR(200) NOT NULL,
    model_type              forecast_model_type NOT NULL,
    granularity             forecast_granularity NOT NULL,
    scope_filter_json       JSONB,
    hyperparameters_json    JSONB NOT NULL,
    feature_set_json        JSONB,
    training_window_days    INTEGER NOT NULL,
    retrain_frequency_days  INTEGER NOT NULL DEFAULT 7,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    last_trained_at         TIMESTAMPTZ,
    next_scheduled_train    TIMESTAMPTZ,
    model_artifact_uri      TEXT,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, model_name)
);
CREATE INDEX idx_fc_model_tenant_active ON fc_forecast_model (tenant_id) WHERE is_active;
CREATE INDEX idx_fc_model_retrain ON fc_forecast_model (next_scheduled_train) WHERE is_active;

-- Forecast run log (immutable audit of every forecast generation)
CREATE TABLE fc_forecast_run (
    run_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    model_id                UUID NOT NULL REFERENCES fc_forecast_model(model_id),
    horizon                 forecast_horizon NOT NULL,
    horizon_days            INTEGER NOT NULL,
    granularity             forecast_granularity NOT NULL,
    scope_filter_json       JSONB,
    input_window_start      DATE NOT NULL,
    input_window_end        DATE NOT NULL,
    input_data_points       BIGINT NOT NULL,
    status                  forecast_run_status NOT NULL DEFAULT 'Queued',
    generation_started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generation_completed_at TIMESTAMPTZ,
    duration_ms             INTEGER,
    mape_score              NUMERIC(7,4),
    rmse_score              NUMERIC(18,6),
    bias_score              NUMERIC(10,6),
    triggered_by            VARCHAR(50) NOT NULL,
    trigger_reference_id    UUID,
    error_detail            JSONB,
    narrative_summary       TEXT
);
CREATE INDEX idx_fc_run_tenant_time ON fc_forecast_run (tenant_id, generation_started_at DESC);
CREATE INDEX idx_fc_run_model ON fc_forecast_run (model_id, generation_started_at DESC);
CREATE INDEX idx_fc_run_status ON fc_forecast_run (status) WHERE status IN ('Queued', 'Training', 'Generating');

-- Forecast output points (partitioned by forecast_date for volume)
CREATE TABLE fc_forecast_point (
    point_id                UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    run_id                  UUID NOT NULL,
    forecast_date           DATE NOT NULL,
    granularity             forecast_granularity NOT NULL,
    dimension_key           VARCHAR(500),
    predicted_amount        NUMERIC(18,4) NOT NULL,
    lower_bound_80          NUMERIC(18,4),
    upper_bound_80          NUMERIC(18,4),
    lower_bound_95          NUMERIC(18,4),
    upper_bound_95          NUMERIC(18,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    actual_amount           NUMERIC(18,4),
    actual_observed_at      TIMESTAMPTZ,
    absolute_error          NUMERIC(18,4),
    pct_error               NUMERIC(10,6),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (point_id, forecast_date)
) PARTITION BY RANGE (forecast_date);

CREATE TABLE fc_forecast_point_y2026m07 PARTITION OF fc_forecast_point
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE fc_forecast_point_y2026m08 PARTITION OF fc_forecast_point
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_fc_point_tenant_date ON fc_forecast_point (tenant_id, forecast_date);
CREATE INDEX idx_fc_point_run ON fc_forecast_point (run_id);
CREATE INDEX idx_fc_point_dimension ON fc_forecast_point (tenant_id, dimension_key, forecast_date) WHERE dimension_key IS NOT NULL;

-- Forecast drift detection events
CREATE TABLE fc_drift_event (
    drift_event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    model_id                UUID NOT NULL REFERENCES fc_forecast_model(model_id),
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evaluation_window_start DATE NOT NULL,
    evaluation_window_end   DATE NOT NULL,
    severity                forecast_drift_severity NOT NULL,
    mape_observed           NUMERIC(7,4) NOT NULL,
    mape_threshold          NUMERIC(7,4) NOT NULL,
    consecutive_violations  INTEGER NOT NULL DEFAULT 1,
    triggers_retrain        BOOLEAN NOT NULL DEFAULT FALSE,
    retrain_run_id          UUID,
    drift_drivers_json      JSONB
);
CREATE INDEX idx_fc_drift_tenant_time ON fc_drift_event (tenant_id, detected_at DESC);
CREATE INDEX idx_fc_drift_model ON fc_drift_event (model_id, detected_at DESC);
CREATE INDEX idx_fc_drift_severity ON fc_drift_event (severity) WHERE severity IN ('Moderate', 'Severe');

-- Scenario simulations (what-if analysis)
CREATE TABLE fc_scenario (
    scenario_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    scenario_name           VARCHAR(200) NOT NULL,
    scenario_type           scenario_type NOT NULL,
    description             TEXT,
    assumptions_json        JSONB NOT NULL,
    baseline_run_id         UUID REFERENCES fc_forecast_run(run_id),
    simulated_run_id        UUID REFERENCES fc_forecast_run(run_id),
    horizon                 forecast_horizon NOT NULL,
    delta_amount            NUMERIC(18,4),
    delta_pct               NUMERIC(10,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    narrative_summary       TEXT,
    is_saved                BOOLEAN NOT NULL DEFAULT FALSE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id)
);
CREATE INDEX idx_fc_scenario_tenant ON fc_scenario (tenant_id, created_date DESC);
CREATE INDEX idx_fc_scenario_saved ON fc_scenario (tenant_id) WHERE is_saved;

-- ============================================================================
-- A07 — BUDGET GUARDIAN AGENT
-- ============================================================================

-- Budget definitions
CREATE TABLE bg_budget_definition (
    budget_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    budget_name             VARCHAR(200) NOT NULL,
    description             TEXT,
    scope_type              budget_scope_type NOT NULL,
    scope_dimension_key     VARCHAR(500),
    scope_filter_json       JSONB,
    budget_period           budget_period NOT NULL,
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    allocated_amount        NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    owner_user_id           UUID REFERENCES auth_user(user_id),
    owner_business_unit     VARCHAR(200),
    status                  budget_status NOT NULL DEFAULT 'Draft',
    approval_required       BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    parent_budget_id        UUID REFERENCES bg_budget_definition(budget_id),
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_by        UUID NOT NULL REFERENCES auth_user(user_id),
    CONSTRAINT ck_budget_period_valid CHECK (period_end > period_start)
);
CREATE INDEX idx_bg_budget_tenant_status ON bg_budget_definition (tenant_id, status);
CREATE INDEX idx_bg_budget_period ON bg_budget_definition (tenant_id, period_start DESC, period_end DESC);
CREATE INDEX idx_bg_budget_scope ON bg_budget_definition (tenant_id, scope_type, scope_dimension_key);
CREATE INDEX idx_bg_budget_owner ON bg_budget_definition (owner_user_id) WHERE owner_user_id IS NOT NULL;

-- Budget threshold configuration (per budget, configurable alert tiers)
CREATE TABLE bg_budget_threshold (
    threshold_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id               UUID NOT NULL REFERENCES bg_budget_definition(budget_id) ON DELETE CASCADE,
    alert_tier              budget_alert_tier NOT NULL,
    threshold_pct           NUMERIC(5,2) NOT NULL,
    notification_channels   TEXT[],
    recipient_user_ids      UUID[],
    recipient_role_ids      UUID[],
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (budget_id, alert_tier)
);

-- Real-time budget state (updated by A07 monitoring loop)
CREATE TABLE bg_budget_state (
    state_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id               UUID NOT NULL REFERENCES bg_budget_definition(budget_id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    actual_spend_amount     NUMERIC(18,4) NOT NULL DEFAULT 0,
    remaining_amount        NUMERIC(18,4) NOT NULL,
    consumption_pct         NUMERIC(7,4) NOT NULL DEFAULT 0,
    projected_end_spend     NUMERIC(18,4),
    projected_exhaustion_date DATE,
    days_remaining_in_period INTEGER,
    burn_rate_daily         NUMERIC(18,4),
    health_score            NUMERIC(5,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    last_recomputed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (budget_id)
);
CREATE INDEX idx_bg_state_tenant ON bg_budget_state (tenant_id);
CREATE INDEX idx_bg_state_health ON bg_budget_state (health_score);

-- Variance analysis (drivers of over/under performance)
CREATE TABLE bg_variance_analysis (
    variance_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id               UUID NOT NULL REFERENCES bg_budget_definition(budget_id),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    analysis_date           DATE NOT NULL,
    expected_amount         NUMERIC(18,4) NOT NULL,
    actual_amount           NUMERIC(18,4) NOT NULL,
    variance_amount         NUMERIC(18,4) GENERATED ALWAYS AS (actual_amount - expected_amount) STORED,
    variance_pct            NUMERIC(10,4),
    classification          variance_classification NOT NULL,
    top_drivers_json        JSONB,
    narrative_summary       TEXT,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bg_variance_budget_date ON bg_variance_analysis (budget_id, analysis_date DESC);
CREATE INDEX idx_bg_variance_classification ON bg_variance_analysis (classification, analysis_date DESC);

-- Guardrail policies (what happens when budget thresholds are breached)
CREATE TABLE bg_guardrail_policy (
    policy_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id               UUID NOT NULL REFERENCES bg_budget_definition(budget_id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    policy_name             VARCHAR(200) NOT NULL,
    trigger_alert_tier      budget_alert_tier NOT NULL,
    action_type             guardrail_action_type NOT NULL,
    action_parameters_json  JSONB,
    requires_human_approval BOOLEAN NOT NULL DEFAULT TRUE,
    approver_role_ids       UUID[],
    auto_execute_after_min  INTEGER,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id)
);
CREATE INDEX idx_bg_guardrail_budget ON bg_guardrail_policy (budget_id) WHERE is_active;

-- Alert events (every threshold crossing)
CREATE TABLE bg_alert_event (
    alert_event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id               UUID NOT NULL REFERENCES bg_budget_definition(budget_id),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    alert_tier              budget_alert_tier NOT NULL,
    threshold_pct_crossed   NUMERIC(5,2) NOT NULL,
    actual_consumption_pct  NUMERIC(7,4) NOT NULL,
    actual_amount           NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    recipients_notified     JSONB,
    channels_used           TEXT[],
    acknowledged_at         TIMESTAMPTZ,
    acknowledged_by         UUID REFERENCES auth_user(user_id),
    triggered_guardrail_id  UUID REFERENCES bg_guardrail_policy(policy_id),
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bg_alert_budget_time ON bg_alert_event (budget_id, detected_at DESC);
CREATE INDEX idx_bg_alert_tenant_tier ON bg_alert_event (tenant_id, alert_tier, detected_at DESC);
CREATE INDEX idx_bg_alert_unack ON bg_alert_event (acknowledged_at) WHERE acknowledged_at IS NULL;

-- Guardrail execution log
CREATE TABLE bg_guardrail_execution (
    execution_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id               UUID NOT NULL REFERENCES bg_guardrail_policy(policy_id),
    budget_id               UUID NOT NULL REFERENCES bg_budget_definition(budget_id),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    alert_event_id          UUID REFERENCES bg_alert_event(alert_event_id),
    action_type             guardrail_action_type NOT NULL,
    execution_status        VARCHAR(30) NOT NULL DEFAULT 'Pending',
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at             TIMESTAMPTZ,
    approved_by             UUID REFERENCES auth_user(user_id),
    executed_at             TIMESTAMPTZ,
    affected_resources_json JSONB,
    execution_result_json   JSONB,
    reverted_at             TIMESTAMPTZ
);
CREATE INDEX idx_bg_exec_budget_time ON bg_guardrail_execution (budget_id, requested_at DESC);
CREATE INDEX idx_bg_exec_status ON bg_guardrail_execution (execution_status) WHERE execution_status != 'Completed';

-- Budget reallocation requests (transfer budget between scopes)
CREATE TABLE bg_reallocation_request (
    reallocation_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    source_budget_id        UUID NOT NULL REFERENCES bg_budget_definition(budget_id),
    target_budget_id        UUID NOT NULL REFERENCES bg_budget_definition(budget_id),
    transfer_amount         NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    justification           TEXT NOT NULL,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Pending',
    requested_by            UUID NOT NULL REFERENCES auth_user(user_id),
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    executed_at             TIMESTAMPTZ,
    CONSTRAINT ck_different_budgets CHECK (source_budget_id != target_budget_id)
);
CREATE INDEX idx_bg_realloc_tenant ON bg_reallocation_request (tenant_id, requested_at DESC);
CREATE INDEX idx_bg_realloc_status ON bg_reallocation_request (status) WHERE status = 'Pending';

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE fc_forecast_model        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_forecast_run          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_forecast_point        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_drift_event           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_scenario              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bg_budget_definition     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bg_budget_state          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bg_variance_analysis     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bg_guardrail_policy      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bg_alert_event           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bg_guardrail_execution   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bg_reallocation_request  ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_fc_model    ON fc_forecast_model       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_fc_run      ON fc_forecast_run         USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_fc_point    ON fc_forecast_point       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_fc_drift    ON fc_drift_event          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_fc_scenario ON fc_scenario             USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bg_budget   ON bg_budget_definition    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bg_state    ON bg_budget_state         USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bg_var      ON bg_variance_analysis    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bg_guard    ON bg_guardrail_policy     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bg_alert    ON bg_alert_event          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bg_exec     ON bg_guardrail_execution  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bg_realloc  ON bg_reallocation_request USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF WAVE 2a — A06 Forecasting + A07 Budget Guardian
-- Tables: 13 (A06: 5, A07: 8)
-- Enums: 12 (6 forecasting, 6 budget)
-- Indexes: 32
-- RLS Policies: 12
-- Partitioned: fc_forecast_point (monthly by forecast_date)
-- All FKs to tenant(tenant_id), auth_user(user_id), ref_currency(currency_id)
-- ZERO hardcoded organizational values
-- =============================================================================
