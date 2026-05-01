-- =============================================================================
-- V013 — Wave 2b: A08 Benchmarking Agent + A09 Unit Economics Agent
-- Sources: A08-FSD-BM-08, A09-FSD-UE-01
-- =============================================================================
-- DESIGN PRINCIPLES (unchanged): no hardcoded currency/tenant/org references,
-- all composite money, all FKs to V010 foundation, config-driven thresholds.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE bm_benchmark_source AS ENUM (
    'Internal_Historical', 'Industry_Average', 'FinOps_Foundation_KPI',
    'Peer_Cohort', 'Custom_Target', 'Vendor_Published'
);

CREATE TYPE bm_benchmark_scope AS ENUM (
    'Platform', 'Provider', 'Service_Category', 'Business_Unit',
    'Application', 'Environment', 'Region', 'Workload_Type'
);

CREATE TYPE bm_efficiency_verdict AS ENUM (
    'Above_Benchmark', 'At_Benchmark', 'Below_Benchmark', 'Outlier_High', 'Outlier_Low'
);

CREATE TYPE bm_trend_direction AS ENUM (
    'Improving', 'Stable', 'Degrading', 'Volatile'
);

CREATE TYPE ue_metric_source_type AS ENUM (
    'API_Endpoint', 'Prometheus_Metric', 'Application_Telemetry',
    'Database_Query', 'External_Webhook', 'Manual_Entry', 'Business_System'
);

CREATE TYPE ue_transaction_metric_type AS ENUM (
    'Request_Count', 'Transaction_Count', 'User_Session',
    'Business_Event', 'Processed_Item', 'Custom_Event'
);

CREATE TYPE ue_aggregation_period AS ENUM (
    'Hourly', 'Daily', 'Weekly', 'Monthly'
);

CREATE TYPE ue_cpt_status AS ENUM (
    'Healthy', 'Warning', 'Degraded', 'Insufficient_Data', 'Stale'
);

-- ============================================================================
-- A08 — BENCHMARKING AGENT
-- ============================================================================

CREATE TABLE bm_benchmark_definition (
    benchmark_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    benchmark_name          VARCHAR(200) NOT NULL,
    description             TEXT,
    scope                   bm_benchmark_scope NOT NULL,
    scope_filter_json       JSONB,
    unit_of_measure         VARCHAR(100) NOT NULL,
    source                  bm_benchmark_source NOT NULL,
    source_metadata_json    JSONB,
    target_value            NUMERIC(18,6) NOT NULL,
    target_currency_id      UUID REFERENCES ref_currency(currency_id),
    deviation_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    is_dynamic_target       BOOLEAN NOT NULL DEFAULT FALSE,
    improvement_rate_pct    NUMERIC(5,2),
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_by        UUID NOT NULL REFERENCES auth_user(user_id),
    UNIQUE (tenant_id, benchmark_name, effective_from)
);
CREATE INDEX idx_bm_def_tenant_active ON bm_benchmark_definition (tenant_id) WHERE is_active;
CREATE INDEX idx_bm_def_scope ON bm_benchmark_definition (tenant_id, scope);

CREATE TABLE bm_efficiency_measurement (
    measurement_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    benchmark_id            UUID NOT NULL REFERENCES bm_benchmark_definition(benchmark_id),
    measurement_date        DATE NOT NULL,
    dimension_key           VARCHAR(500),
    actual_value            NUMERIC(18,6) NOT NULL,
    target_value            NUMERIC(18,6) NOT NULL,
    deviation_amount        NUMERIC(18,6) GENERATED ALWAYS AS (actual_value - target_value) STORED,
    deviation_pct           NUMERIC(10,4),
    verdict                 bm_efficiency_verdict NOT NULL,
    sample_size             BIGINT,
    currency_id             UUID REFERENCES ref_currency(currency_id),
    measured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (benchmark_id, measurement_date, dimension_key)
);
CREATE INDEX idx_bm_meas_tenant_date ON bm_efficiency_measurement (tenant_id, measurement_date DESC);
CREATE INDEX idx_bm_meas_benchmark_date ON bm_efficiency_measurement (benchmark_id, measurement_date DESC);
CREATE INDEX idx_bm_meas_verdict ON bm_efficiency_measurement (verdict, measurement_date DESC) WHERE verdict IN ('Above_Benchmark', 'Outlier_High');

CREATE TABLE bm_benchmark_trend (
    trend_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    benchmark_id            UUID NOT NULL REFERENCES bm_benchmark_definition(benchmark_id),
    trend_period_start      DATE NOT NULL,
    trend_period_end        DATE NOT NULL,
    period_type             VARCHAR(30) NOT NULL,
    starting_value          NUMERIC(18,6) NOT NULL,
    ending_value            NUMERIC(18,6) NOT NULL,
    change_pct              NUMERIC(10,4) NOT NULL,
    direction               bm_trend_direction NOT NULL,
    velocity_score          NUMERIC(5,4),
    narrative_summary       TEXT,
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (benchmark_id, trend_period_start, trend_period_end)
);
CREATE INDEX idx_bm_trend_benchmark ON bm_benchmark_trend (benchmark_id, trend_period_end DESC);

CREATE TABLE bm_peer_cohort (
    cohort_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_name             VARCHAR(200) NOT NULL UNIQUE,
    cohort_description      TEXT,
    cohort_criteria_json    JSONB NOT NULL,
    member_count            INTEGER NOT NULL DEFAULT 0,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE bm_peer_cohort IS 'Anonymized peer cohorts for cross-tenant benchmarking. Tenants opt-in to participate.';

CREATE TABLE bm_cohort_membership (
    membership_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id               UUID NOT NULL REFERENCES bm_peer_cohort(cohort_id),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    opted_in_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opted_in_by             UUID NOT NULL REFERENCES auth_user(user_id),
    opted_out_at            TIMESTAMPTZ,
    anonymization_key       CHAR(64) NOT NULL,
    UNIQUE (cohort_id, tenant_id)
);
CREATE INDEX idx_bm_cohort_active ON bm_cohort_membership (cohort_id) WHERE opted_out_at IS NULL;

CREATE TABLE bm_cohort_statistic (
    statistic_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id               UUID NOT NULL REFERENCES bm_peer_cohort(cohort_id),
    metric_name             VARCHAR(200) NOT NULL,
    statistic_date          DATE NOT NULL,
    p25_value               NUMERIC(18,6),
    p50_value               NUMERIC(18,6),
    p75_value               NUMERIC(18,6),
    p90_value               NUMERIC(18,6),
    mean_value              NUMERIC(18,6),
    sample_size             INTEGER NOT NULL,
    unit_of_measure         VARCHAR(100) NOT NULL,
    currency_id             UUID REFERENCES ref_currency(currency_id),
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cohort_id, metric_name, statistic_date)
);
CREATE INDEX idx_bm_cohort_stat_date ON bm_cohort_statistic (cohort_id, metric_name, statistic_date DESC);

-- ============================================================================
-- A09 — UNIT ECONOMICS AGENT
-- ============================================================================

CREATE TABLE ue_transaction_metric_definition (
    metric_definition_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    metric_name             VARCHAR(200) NOT NULL,
    description             TEXT,
    application_id          UUID,
    business_unit_id        UUID,
    metric_type             ue_transaction_metric_type NOT NULL,
    source_type             ue_metric_source_type NOT NULL,
    source_connection_json  JSONB NOT NULL,
    source_query            TEXT,
    unit_of_measure         VARCHAR(100) NOT NULL,
    aggregation_period      ue_aggregation_period NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, metric_name)
);
CREATE INDEX idx_ue_metric_def_tenant_app ON ue_transaction_metric_definition (tenant_id, application_id) WHERE is_active;

CREATE TABLE ue_transaction_volume (
    volume_id               UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    metric_definition_id    UUID NOT NULL,
    period_start            TIMESTAMPTZ NOT NULL,
    period_end              TIMESTAMPTZ NOT NULL,
    aggregation_period      ue_aggregation_period NOT NULL,
    transaction_count       NUMERIC(18,4) NOT NULL,
    ingestion_timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_reference        VARCHAR(500),
    PRIMARY KEY (volume_id, period_start)
) PARTITION BY RANGE (period_start);

CREATE TABLE ue_transaction_volume_y2026m07 PARTITION OF ue_transaction_volume
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE ue_transaction_volume_y2026m08 PARTITION OF ue_transaction_volume
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_ue_vol_tenant_metric_period ON ue_transaction_volume (tenant_id, metric_definition_id, period_start DESC);

CREATE TABLE ue_cpt_calculation (
    calculation_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    metric_definition_id    UUID NOT NULL REFERENCES ue_transaction_metric_definition(metric_definition_id),
    calculation_date        DATE NOT NULL,
    aggregation_period      ue_aggregation_period NOT NULL,
    dimension_scope         VARCHAR(100) NOT NULL,
    dimension_key           VARCHAR(500),
    total_cost_amount       NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    transaction_count       NUMERIC(18,4) NOT NULL,
    cpt_value               NUMERIC(18,8) NOT NULL,
    cpt_pct_change_dod      NUMERIC(10,4),
    cpt_pct_change_wow      NUMERIC(10,4),
    cpt_pct_change_mom      NUMERIC(10,4),
    status                  ue_cpt_status NOT NULL DEFAULT 'Healthy',
    data_quality_score      NUMERIC(5,4),
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (metric_definition_id, calculation_date, dimension_scope, dimension_key)
);
CREATE INDEX idx_ue_cpt_tenant_date ON ue_cpt_calculation (tenant_id, calculation_date DESC);
CREATE INDEX idx_ue_cpt_metric_date ON ue_cpt_calculation (metric_definition_id, calculation_date DESC);
CREATE INDEX idx_ue_cpt_status ON ue_cpt_calculation (status, calculation_date DESC) WHERE status != 'Healthy';

CREATE TABLE ue_cpt_threshold (
    threshold_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    metric_definition_id    UUID NOT NULL REFERENCES ue_transaction_metric_definition(metric_definition_id),
    dimension_key           VARCHAR(500),
    warning_cpt_value       NUMERIC(18,8),
    critical_cpt_value      NUMERIC(18,8),
    warning_pct_change      NUMERIC(10,4),
    critical_pct_change     NUMERIC(10,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id)
);
CREATE INDEX idx_ue_thresh_metric ON ue_cpt_threshold (metric_definition_id) WHERE is_active;

CREATE TABLE ue_cpt_anomaly_event (
    anomaly_event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    calculation_id          UUID NOT NULL REFERENCES ue_cpt_calculation(calculation_id),
    threshold_id            UUID REFERENCES ue_cpt_threshold(threshold_id),
    severity                VARCHAR(30) NOT NULL,
    observed_cpt            NUMERIC(18,8) NOT NULL,
    threshold_cpt           NUMERIC(18,8),
    observed_pct_change     NUMERIC(10,4),
    threshold_pct_change    NUMERIC(10,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    acknowledged_at         TIMESTAMPTZ,
    acknowledged_by         UUID REFERENCES auth_user(user_id),
    resolved_at             TIMESTAMPTZ,
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ue_anom_tenant_time ON ue_cpt_anomaly_event (tenant_id, detected_at DESC);
CREATE INDEX idx_ue_anom_unack ON ue_cpt_anomaly_event (acknowledged_at) WHERE acknowledged_at IS NULL;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE bm_benchmark_definition    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_efficiency_measurement  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_benchmark_trend         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_cohort_membership       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ue_transaction_metric_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE ue_transaction_volume      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ue_cpt_calculation         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ue_cpt_threshold           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ue_cpt_anomaly_event       ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_bm_def     ON bm_benchmark_definition    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bm_meas    ON bm_efficiency_measurement  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bm_trend   ON bm_benchmark_trend         USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_bm_cohort  ON bm_cohort_membership       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ue_def     ON ue_transaction_metric_definition USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ue_vol     ON ue_transaction_volume      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ue_cpt     ON ue_cpt_calculation         USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ue_thresh  ON ue_cpt_threshold           USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ue_anom    ON ue_cpt_anomaly_event       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Peer cohort and cohort statistic tables: intentionally NOT tenant-scoped
-- (cross-tenant aggregated data, anonymized via anonymization_key)

-- =============================================================================
-- END OF WAVE 2b — A08 Benchmarking + A09 Unit Economics
-- Tables: 11 (A08: 6, A09: 5)
-- Enums: 8 (4 benchmarking, 4 unit economics)
-- Indexes: 22
-- RLS Policies: 9
-- Partitioned: ue_transaction_volume (monthly by period_start)
-- =============================================================================
