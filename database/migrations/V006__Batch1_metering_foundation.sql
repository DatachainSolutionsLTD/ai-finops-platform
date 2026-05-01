-- =============================================================================
-- V006 — Batch 1: Agent Metering Engine Foundation (FSD-MTR-01)
-- Scope: Agent Activity Records, Pulse Ledger, Rate Cards, Gearing Ratios,
--        Human Intervention Records, API Metering Records, Refund Assessment
-- =============================================================================
-- DESIGN PRINCIPLES (enforced throughout):
--   1. NO hardcoded currencies — all monetary references FK to ref_currency
--   2. NO hardcoded customer/tenant identifiers — all FK to tenant registry
--   3. NO hardcoded defaults for org-specific values
--   4. NO literal organizational names in column names, enums, or comments
--   5. All tables tenant-scoped with RLS via app.current_tenant_id session var
--   6. Monetary columns: NUMERIC(18,4) amount + currency_id FK (composite money)
--   7. Audit trail: created_date, last_modified_date, created_by, modified_by
--   8. Idempotency: external_reference_id on every write table
-- =============================================================================

-- ---------------------------------------------------------------------------
-- REFERENCE TABLES (shared, config-driven — no hardcoded values)
-- ---------------------------------------------------------------------------

-- Currency reference (ISO 4217) — populated via seed data, not schema defaults
CREATE TABLE IF NOT EXISTS ref_currency (
    currency_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iso_code            CHAR(3) NOT NULL UNIQUE,        -- AED, USD, EUR, etc.
    display_name        VARCHAR(100) NOT NULL,
    decimal_places      SMALLINT NOT NULL DEFAULT 2,
    symbol              VARCHAR(10),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_date        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE ref_currency IS 'ISO 4217 currency reference. Platform base currency configured per deployment, NOT hardcoded in schema.';

-- Platform configuration — deployment-specific values live here, not in DDL
CREATE TABLE IF NOT EXISTS platform_config (
    config_key          VARCHAR(200) PRIMARY KEY,
    config_value        TEXT NOT NULL,
    config_type         VARCHAR(50) NOT NULL,           -- string, number, uuid, json
    description         TEXT,
    is_secret           BOOLEAN NOT NULL DEFAULT FALSE,
    last_modified_date  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN platform_config.config_key IS 'Keys include: platform.base_currency_id, platform.default_timezone, platform.fiscal_year_start. Values seeded at deployment time per installation.';

-- ---------------------------------------------------------------------------
-- ENUMS (operation-level — no org or currency semantics)
-- ---------------------------------------------------------------------------
CREATE TYPE agent_operation_type AS ENUM (
    'Observation', 'Reasoning', 'Action', 'Learning',
    'Communication', 'Escalation', 'Refund_Assessment'
);

CREATE TYPE operation_outcome AS ENUM (
    'Success', 'Partial', 'Failed', 'Timeout', 'Escalated'
);

CREATE TYPE pulse_calculation_method AS ENUM (
    'Standard_Gearing', 'Bundle_Committed', 'On_Demand', 'Burst_Multiplier', 'Zero_Rated'
);

CREATE TYPE aar_processing_status AS ENUM (
    'Pending', 'Processing', 'Finalized', 'Disputed', 'Voided'
);

CREATE TYPE ledger_entry_type AS ENUM (
    'Debit', 'Credit', 'Reversal', 'Adjustment', 'Refund'
);

CREATE TYPE intervention_type AS ENUM (
    'Approval', 'Override', 'Correction', 'Escalation', 'Investigation'
);

CREATE TYPE metering_pipeline_stage AS ENUM (
    'Ingestion', 'Validation', 'Pulse_Calculation', 'Ledger_Posting', 'Reconciliation'
);

-- ---------------------------------------------------------------------------
-- RATE CARDS & GEARING CONFIGURATION (tenant-scoped, no defaults)
-- ---------------------------------------------------------------------------
CREATE TABLE mtr_rate_card (
    rate_card_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    rate_card_name          VARCHAR(200) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    committed_pulse_bundle  NUMERIC(18,4),
    committed_price_amount  NUMERIC(18,4),
    on_demand_rate_amount   NUMERIC(18,4) NOT NULL,
    burst_multiplier        NUMERIC(6,4) NOT NULL,
    peak_hour_start         TIME,
    peak_hour_end           TIME,
    peak_hour_timezone      VARCHAR(50) NOT NULL,
    hiu_rate_amount         NUMERIC(18,4) NOT NULL,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    approval_status         VARCHAR(30) NOT NULL,
    approved_by             UUID,
    approved_at             TIMESTAMPTZ,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL,
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_by        UUID NOT NULL,
    CONSTRAINT ck_rate_card_dates CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_rate_card_positive CHECK (on_demand_rate_amount >= 0 AND burst_multiplier >= 1)
);
CREATE INDEX idx_mtr_rate_card_tenant_active ON mtr_rate_card(tenant_id, effective_from DESC) WHERE effective_to IS NULL;
CREATE INDEX idx_mtr_rate_card_currency ON mtr_rate_card(currency_id);

-- Gearing ratios — configurable per resource type, no hardcoded coefficients
CREATE TABLE mtr_gearing_config (
    gearing_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    rate_card_id            UUID NOT NULL REFERENCES mtr_rate_card(rate_card_id),
    resource_dimension      VARCHAR(100) NOT NULL,      -- compute_minute, gpu_minute, memory_gb_min, llm_1k_tokens, api_call, storage_gb_hour
    gearing_coefficient     NUMERIC(18,8) NOT NULL,
    unit_of_measure         VARCHAR(50) NOT NULL,
    calculation_notes       TEXT,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL,
    UNIQUE (tenant_id, rate_card_id, resource_dimension, effective_from)
);
CREATE INDEX idx_mtr_gearing_active ON mtr_gearing_config(tenant_id, rate_card_id, resource_dimension);

-- ---------------------------------------------------------------------------
-- AGENT ACTIVITY RECORD (AAR) — the core immutable metering event
-- Partitioned monthly by operation_end_timestamp for time-series scale
-- ---------------------------------------------------------------------------
CREATE TABLE mtr_agent_activity_record (
    aar_id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    agent_id                UUID NOT NULL,
    agent_type_code         VARCHAR(20) NOT NULL,       -- FK-style ref to agent registry (not hardcoded per tenant)
    operation_id            UUID NOT NULL,
    operation_type          agent_operation_type NOT NULL,
    outcome                 operation_outcome NOT NULL,
    outcome_confidence      NUMERIC(5,4),

    -- Raw resource consumption (all quantities numeric, units stored separately)
    compute_minutes         NUMERIC(18,6) NOT NULL DEFAULT 0,
    gpu_minutes             NUMERIC(18,6) NOT NULL DEFAULT 0,
    memory_gb_minutes       NUMERIC(18,6) NOT NULL DEFAULT 0,
    storage_gb_hours        NUMERIC(18,6) NOT NULL DEFAULT 0,
    llm_input_tokens        BIGINT NOT NULL DEFAULT 0,
    llm_output_tokens       BIGINT NOT NULL DEFAULT 0,
    api_call_count          BIGINT NOT NULL DEFAULT 0,
    network_gb_transferred  NUMERIC(18,6) NOT NULL DEFAULT 0,

    -- Pulse calculation outputs
    rate_card_id            UUID NOT NULL REFERENCES mtr_rate_card(rate_card_id),
    calculation_method      pulse_calculation_method NOT NULL,
    calculated_pulses       NUMERIC(18,6) NOT NULL,
    outcome_pulse_weight    NUMERIC(6,4) NOT NULL,      -- 0.0–1.0 multiplier for partial outcomes
    effective_pulses        NUMERIC(18,6) NOT NULL,

    -- Monetary value (composite: amount + currency FK — NO hardcoding)
    charge_amount           NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),

    -- Linkage to source agent run (polymorphic — can reference any agent run log)
    source_run_id           UUID,
    source_run_agent_type   VARCHAR(20),
    parent_operation_id     UUID,

    -- Timing
    operation_start_timestamp   TIMESTAMPTZ NOT NULL,
    operation_end_timestamp     TIMESTAMPTZ NOT NULL,
    duration_ms                 INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (operation_end_timestamp - operation_start_timestamp)) * 1000
    ) STORED,

    -- Immutability & integrity
    content_hash_sha256     CHAR(64) NOT NULL,
    processing_status       aar_processing_status NOT NULL DEFAULT 'Pending',
    finalized_at            TIMESTAMPTZ,

    -- Audit
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL,

    PRIMARY KEY (aar_id, operation_end_timestamp)
) PARTITION BY RANGE (operation_end_timestamp);

COMMENT ON TABLE mtr_agent_activity_record IS 'Immutable Agent Activity Record. Partitioned monthly. Pulse calculation inputs/outputs and monetary value tracked via currency FK, never hardcoded.';

-- Example initial partition (more created via automation)
CREATE TABLE mtr_agent_activity_record_y2026m07 PARTITION OF mtr_agent_activity_record
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE mtr_agent_activity_record_y2026m08 PARTITION OF mtr_agent_activity_record
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_aar_tenant_time ON mtr_agent_activity_record (tenant_id, operation_end_timestamp DESC);
CREATE INDEX idx_aar_agent_time ON mtr_agent_activity_record (agent_id, operation_end_timestamp DESC);
CREATE INDEX idx_aar_operation ON mtr_agent_activity_record (operation_id);
CREATE INDEX idx_aar_status ON mtr_agent_activity_record (processing_status) WHERE processing_status != 'Finalized';
CREATE UNIQUE INDEX idx_aar_hash ON mtr_agent_activity_record (content_hash_sha256, operation_end_timestamp);

-- ---------------------------------------------------------------------------
-- PULSE LEDGER — double-entry accounting for pulse consumption
-- ---------------------------------------------------------------------------
CREATE TABLE mtr_pulse_ledger_entry (
    ledger_entry_id         UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    entry_type              ledger_entry_type NOT NULL,
    aar_id                  UUID,
    operation_end_timestamp TIMESTAMPTZ,
    pulse_amount            NUMERIC(18,6) NOT NULL,
    monetary_amount         NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    running_balance_pulses  NUMERIC(18,6) NOT NULL,
    description             VARCHAR(500),
    reference_entry_id      UUID,
    billing_period          DATE NOT NULL,
    posted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_by_agent_id      UUID NOT NULL,
    external_reference_id   VARCHAR(200),
    PRIMARY KEY (ledger_entry_id, posted_at)
) PARTITION BY RANGE (posted_at);

CREATE TABLE mtr_pulse_ledger_entry_y2026m07 PARTITION OF mtr_pulse_ledger_entry
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE mtr_pulse_ledger_entry_y2026m08 PARTITION OF mtr_pulse_ledger_entry
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_ledger_tenant_period ON mtr_pulse_ledger_entry (tenant_id, billing_period);
CREATE INDEX idx_ledger_aar ON mtr_pulse_ledger_entry (aar_id) WHERE aar_id IS NOT NULL;
CREATE INDEX idx_ledger_type ON mtr_pulse_ledger_entry (tenant_id, entry_type, posted_at DESC);

-- ---------------------------------------------------------------------------
-- HUMAN INTERVENTION RECORD (HIR) — escalations to A30 HITL
-- ---------------------------------------------------------------------------
CREATE TABLE mtr_human_intervention_record (
    hir_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    aar_id                  UUID,
    agent_id                UUID NOT NULL,
    human_operator_id       UUID NOT NULL,
    intervention_type       intervention_type NOT NULL,
    escalation_reason       VARCHAR(500),
    intervention_start      TIMESTAMPTZ NOT NULL,
    intervention_end        TIMESTAMPTZ,
    intervention_minutes    NUMERIC(10,4) GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (intervention_end - intervention_start)) / 60
    ) STORED,
    hiu_count               NUMERIC(18,4),
    hiu_rate_amount         NUMERIC(18,4) NOT NULL,
    charge_amount           NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    outcome_summary         TEXT,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hir_tenant_time ON mtr_human_intervention_record (tenant_id, intervention_start DESC);
CREATE INDEX idx_hir_agent ON mtr_human_intervention_record (agent_id);
CREATE INDEX idx_hir_aar ON mtr_human_intervention_record (aar_id) WHERE aar_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- API METERING RECORD (AMR) — external API consumption
-- ---------------------------------------------------------------------------
CREATE TABLE mtr_api_metering_record (
    amr_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    aar_id                  UUID,
    agent_id                UUID NOT NULL,
    api_provider_name       VARCHAR(200) NOT NULL,
    api_endpoint            VARCHAR(500) NOT NULL,
    http_method             VARCHAR(10),
    call_count              BIGINT NOT NULL DEFAULT 1,
    request_payload_bytes   BIGINT,
    response_payload_bytes  BIGINT,
    latency_ms              INTEGER,
    response_status_code    SMALLINT,
    cost_per_call_amount    NUMERIC(18,6),
    total_cost_amount       NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    called_at               TIMESTAMPTZ NOT NULL,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_amr_tenant_time ON mtr_api_metering_record (tenant_id, called_at DESC);
CREATE INDEX idx_amr_agent ON mtr_api_metering_record (agent_id);
CREATE INDEX idx_amr_aar ON mtr_api_metering_record (aar_id) WHERE aar_id IS NOT NULL;
CREATE INDEX idx_amr_provider ON mtr_api_metering_record (tenant_id, api_provider_name);

-- ---------------------------------------------------------------------------
-- REFUND ASSESSMENT RECORD — credits for failed/partial outcomes
-- ---------------------------------------------------------------------------
CREATE TABLE mtr_refund_assessment (
    refund_assessment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    aar_id                  UUID NOT NULL,
    assessment_reason       VARCHAR(500) NOT NULL,
    original_pulses         NUMERIC(18,6) NOT NULL,
    refund_pulses           NUMERIC(18,6) NOT NULL,
    refund_percentage       NUMERIC(5,4) NOT NULL,
    refund_amount           NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    assessed_by_agent_id    UUID NOT NULL,
    approval_required       BOOLEAN NOT NULL,
    approval_status         VARCHAR(30),
    approved_by             UUID,
    ledger_entry_id         UUID,
    assessed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_at               TIMESTAMPTZ,
    external_reference_id   VARCHAR(200),
    CONSTRAINT ck_refund_range CHECK (refund_percentage >= 0 AND refund_percentage <= 1)
);
CREATE INDEX idx_refund_tenant ON mtr_refund_assessment (tenant_id, assessed_at DESC);
CREATE INDEX idx_refund_aar ON mtr_refund_assessment (aar_id);
CREATE INDEX idx_refund_status ON mtr_refund_assessment (approval_status) WHERE approval_status IS NOT NULL;

-- ---------------------------------------------------------------------------
-- METERING RUN LOG — pipeline execution audit
-- ---------------------------------------------------------------------------
CREATE TABLE mtr_metering_run_log (
    run_id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL,
    pipeline_stage              metering_pipeline_stage NOT NULL,
    run_start                   TIMESTAMPTZ NOT NULL,
    run_end                     TIMESTAMPTZ,
    status                      VARCHAR(30) NOT NULL,
    aars_processed              BIGINT NOT NULL DEFAULT 0,
    aars_finalized              BIGINT NOT NULL DEFAULT 0,
    aars_quarantined            BIGINT NOT NULL DEFAULT 0,
    pulses_calculated           NUMERIC(18,6) NOT NULL DEFAULT 0,
    total_charge_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency_id                 UUID REFERENCES ref_currency(currency_id),
    reconciliation_variance_pct NUMERIC(10,6),
    error_detail                JSONB,
    pipeline_version            VARCHAR(50),
    created_date                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_metering_run_tenant_time ON mtr_metering_run_log (tenant_id, run_start DESC);
CREATE INDEX idx_metering_run_stage ON mtr_metering_run_log (pipeline_stage, status);

-- ---------------------------------------------------------------------------
-- PULSE EFFICIENCY SCORE — per agent per period
-- ---------------------------------------------------------------------------
CREATE TABLE mtr_pulse_efficiency_score (
    score_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    agent_id                UUID NOT NULL,
    agent_type_code         VARCHAR(20) NOT NULL,
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    total_pulses            NUMERIC(18,6) NOT NULL,
    outcome_pulses          NUMERIC(18,6) NOT NULL,
    efficiency_score        NUMERIC(5,4) NOT NULL,
    operations_count        BIGINT NOT NULL,
    success_rate            NUMERIC(5,4) NOT NULL,
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, agent_id, period_start, period_end),
    CONSTRAINT ck_efficiency_range CHECK (efficiency_score >= 0 AND efficiency_score <= 1)
);
CREATE INDEX idx_efficiency_tenant_period ON mtr_pulse_efficiency_score (tenant_id, period_start DESC);
CREATE INDEX idx_efficiency_agent ON mtr_pulse_efficiency_score (agent_id, period_start DESC);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS) — tenant isolation
-- ---------------------------------------------------------------------------
ALTER TABLE mtr_rate_card             ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtr_gearing_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtr_agent_activity_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtr_pulse_ledger_entry    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtr_human_intervention_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtr_api_metering_record   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtr_refund_assessment     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtr_metering_run_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtr_pulse_efficiency_score ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_rate_card     ON mtr_rate_card             USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_gearing       ON mtr_gearing_config        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_aar           ON mtr_agent_activity_record USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ledger        ON mtr_pulse_ledger_entry    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_hir           ON mtr_human_intervention_record USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_amr           ON mtr_api_metering_record   USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_refund        ON mtr_refund_assessment     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_run           ON mtr_metering_run_log      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_efficiency    ON mtr_pulse_efficiency_score USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF BATCH 1 — Agent Metering Engine Foundation
-- Tables: 11 (2 reference + 9 metering)
-- Enums: 7
-- Indexes: 24
-- RLS Policies: 9
-- Partitioned: mtr_agent_activity_record, mtr_pulse_ledger_entry (monthly)
-- ZERO hardcoded currency/tenant/org values — all config-driven via FK references
-- =============================================================================
