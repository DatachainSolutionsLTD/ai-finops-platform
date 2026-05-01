-- ============================================================================
-- Migration: V003__A03_allocation_agent.sql
-- Agent:     A03 — Allocation Agent
-- Module:    Cost Allocation & Shared Service Distribution
-- Scope:     Seed Round (Understand Layer)
-- Database:  PostgreSQL 16 with Row-Level Security
-- Depends:   V001 (A01), V002 (A02 — references normalized_cost_record,
--            normalization_run_log)
-- ============================================================================
-- Entities:  allocation_rule, allocated_cost_record, allocation_run_log,
--            shared_service_pool, allocation_audit_log
-- ============================================================================

SET search_path TO public;

-- --------------------------------------------------------------------------
-- ENUM TYPES — A03
-- --------------------------------------------------------------------------

CREATE TYPE allocation_model AS ENUM (
    'Fixed', 'Proportional', 'Dynamic'
);

CREATE TYPE allocation_model_extended AS ENUM (
    'Fixed', 'Proportional', 'Dynamic', 'Unattributed'
);

CREATE TYPE allocation_owner_type AS ENUM (
    'BU', 'Application', 'Project', 'CostCenter', 'SharedPool', 'Unattributed'
);

CREATE TYPE distribution_key AS ENUM (
    'Utilization', 'Reservation', 'Headcount', 'Custom'
);

CREATE TYPE approval_status AS ENUM (
    'Draft', 'Pending_Approval', 'Approved', 'Rejected'
);

CREATE TYPE cost_category AS ENUM (
    'Direct', 'Shared', 'IdleCapacityTax', 'Unattributed'
);

CREATE TYPE allocation_trigger_type AS ENUM (
    'Normalization_Event', 'Rule_Change', 'Scheduled',
    'Enrichment_Update', 'Manual_Request', 'Chargeback_Cycle',
    'Tag_Remediation', 'Retry'
);

CREATE TYPE allocation_run_status AS ENUM (
    'Running', 'Completed', 'Partial', 'Failed'
);

CREATE TYPE shared_pool_distribution_method AS ENUM (
    'Proportional_Utilization', 'Proportional_Headcount',
    'Equal_Split', 'Custom'
);

CREATE TYPE allocation_audit_event_type AS ENUM (
    'Allocation_Started', 'Allocation_Completed', 'Allocation_Failed',
    'Rule_Created', 'Rule_Modified', 'Rule_Deleted',
    'Simulation_Run', 'Chargeback_Generated',
    'Dispute_Opened', 'Dispute_Resolved',
    'Re_Allocation_Triggered', 'Reconciliation_Warning', 'Coverage_Alert'
);


-- --------------------------------------------------------------------------
-- TABLE: shared_service_pool
-- (Created before allocation_rule due to FK dependency)
-- --------------------------------------------------------------------------

CREATE TABLE shared_service_pool (
    pool_id                 UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID                            NOT NULL,
    pool_name               VARCHAR(200)                    NOT NULL,
    description             VARCHAR(500),
    resource_scope          JSONB                           NOT NULL,
    distribution_method     shared_pool_distribution_method NOT NULL,
    idle_tax_enabled        BOOLEAN                         NOT NULL DEFAULT TRUE,
    is_active               BOOLEAN                         NOT NULL DEFAULT TRUE,
    created_by              UUID                            NOT NULL,
    created_date            TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pool_name_per_tenant
        UNIQUE (tenant_id, pool_name)
);

COMMENT ON TABLE shared_service_pool IS 'A03: Shared service cost pools for proportional distribution';


-- --------------------------------------------------------------------------
-- TABLE: allocation_rule
-- --------------------------------------------------------------------------

CREATE TABLE allocation_rule (
    rule_id                 UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID                NOT NULL,
    rule_name               VARCHAR(200)        NOT NULL,
    allocation_model        allocation_model    NOT NULL,
    resource_scope          JSONB               NOT NULL,
    owner_type              allocation_owner_type NOT NULL,
    owner_id                UUID,
    shared_pool_id          UUID                REFERENCES shared_service_pool(pool_id),
    priority                INTEGER             NOT NULL CHECK (priority BETWEEN 1 AND 999),
    distribution_key        distribution_key,
    idle_tax_enabled        BOOLEAN             NOT NULL DEFAULT FALSE,
    idle_tax_rate_pct       NUMERIC(5,2)        DEFAULT 100
                                                CHECK (idle_tax_rate_pct BETWEEN 0 AND 100),
    is_active               BOOLEAN             NOT NULL DEFAULT TRUE,
    effective_from          DATE                NOT NULL,
    effective_to            DATE,
    approval_status         approval_status     NOT NULL DEFAULT 'Draft',
    approved_by             UUID,
    created_by              UUID                NOT NULL,
    created_date            TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    last_modified_by        UUID                NOT NULL,
    last_modified_date      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_rule_name_per_tenant
        UNIQUE (tenant_id, rule_name),
    CONSTRAINT chk_allocation_rule_dates
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

COMMENT ON TABLE allocation_rule IS 'A03: Cost allocation rules defining how spend is distributed to owners';


-- --------------------------------------------------------------------------
-- TABLE: allocation_run_log
-- --------------------------------------------------------------------------

CREATE TABLE allocation_run_log (
    run_id                          UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID                    NOT NULL,
    source_normalization_run_id     UUID                    REFERENCES normalization_run_log(run_id),
    trigger_type                    allocation_trigger_type NOT NULL,
    billing_period                  DATE                    NOT NULL,
    start_timestamp                 TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    end_timestamp                   TIMESTAMPTZ,
    status                          allocation_run_status   NOT NULL DEFAULT 'Running',
    records_input                   INTEGER                 CHECK (records_input >= 0),
    records_allocated               INTEGER                 CHECK (records_allocated >= 0),
    records_unattributed            INTEGER                 CHECK (records_unattributed >= 0),
    total_cost_input_sar            NUMERIC(18,4)           CHECK (total_cost_input_sar >= 0),
    total_cost_allocated_sar        NUMERIC(18,4)           CHECK (total_cost_allocated_sar >= 0),
    reconciliation_variance_pct     NUMERIC(8,4),
    coverage_rate_pct               NUMERIC(5,2)            CHECK (coverage_rate_pct BETWEEN 0 AND 100),
    duration_seconds                INTEGER,
    pipeline_version                VARCHAR(50)             NOT NULL
);

COMMENT ON TABLE allocation_run_log IS 'A03: Execution log for each allocation pipeline run';


-- --------------------------------------------------------------------------
-- TABLE: allocated_cost_record
-- --------------------------------------------------------------------------

CREATE TABLE allocated_cost_record (
    allocation_record_id        UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID                        NOT NULL,
    allocation_run_id           UUID                        NOT NULL
                                                            REFERENCES allocation_run_log(run_id),
    source_cost_record_id       UUID                        NOT NULL
                                                            REFERENCES normalized_cost_record(record_id),
    rule_id                     UUID                        NOT NULL
                                                            REFERENCES allocation_rule(rule_id),
    allocation_model            allocation_model_extended   NOT NULL,
    owner_bu_id                 UUID,
    owner_application_id        UUID,
    owner_project_id            UUID,
    owner_cost_center_id        UUID,
    owner_environment           environment_type,
    allocated_amount_sar        NUMERIC(18,6)               NOT NULL CHECK (allocated_amount_sar >= 0),
    allocation_percentage       NUMERIC(8,4)                NOT NULL CHECK (allocation_percentage BETWEEN 0 AND 100),
    cost_category               cost_category               NOT NULL,
    shared_pool_id              UUID                        REFERENCES shared_service_pool(pool_id),
    provider                    provider_type               NOT NULL,
    service_category            VARCHAR(100)                NOT NULL,
    billing_period              DATE                        NOT NULL,
    allocation_timestamp        TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE allocated_cost_record IS 'A03: Individual cost allocation records — one per source record × rule';


-- --------------------------------------------------------------------------
-- TABLE: allocation_audit_log  (append-only)
-- --------------------------------------------------------------------------

CREATE TABLE allocation_audit_log (
    log_id              UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID                            NOT NULL,
    event_type          allocation_audit_event_type     NOT NULL,
    run_id              UUID,
    rule_id             UUID,
    performed_by        UUID,
    event_detail        JSONB,
    before_state        JSONB,
    after_state         JSONB,
    event_timestamp     TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    ip_address          VARCHAR(45)
);

COMMENT ON TABLE allocation_audit_log IS 'A03: Immutable audit trail for all allocation events';


-- --------------------------------------------------------------------------
-- ROW-LEVEL SECURITY — A03 Tables
-- --------------------------------------------------------------------------

ALTER TABLE shared_service_pool     ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_rule         ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_run_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocated_cost_record   ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_audit_log    ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_shared_service_pool ON shared_service_pool
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_allocation_rule ON allocation_rule
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_allocation_run_log ON allocation_run_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_allocated_cost_record ON allocated_cost_record
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_allocation_audit_log ON allocation_audit_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);


-- --------------------------------------------------------------------------
-- INDEXES — A03
-- --------------------------------------------------------------------------

-- shared_service_pool
CREATE INDEX idx_ssp_tenant              ON shared_service_pool (tenant_id);
CREATE INDEX idx_ssp_active              ON shared_service_pool (tenant_id, is_active)
    WHERE is_active = TRUE;

-- allocation_rule
CREATE INDEX idx_ar_tenant               ON allocation_rule (tenant_id);
CREATE INDEX idx_ar_priority             ON allocation_rule (tenant_id, priority);
CREATE INDEX idx_ar_model                ON allocation_rule (tenant_id, allocation_model);
CREATE INDEX idx_ar_approval             ON allocation_rule (tenant_id, approval_status);
CREATE INDEX idx_ar_active               ON allocation_rule (tenant_id, is_active, effective_from, effective_to)
    WHERE is_active = TRUE;

-- allocation_run_log
CREATE INDEX idx_alrl_tenant             ON allocation_run_log (tenant_id);
CREATE INDEX idx_alrl_billing_period     ON allocation_run_log (tenant_id, billing_period);
CREATE INDEX idx_alrl_status             ON allocation_run_log (tenant_id, status);
CREATE INDEX idx_alrl_start_ts           ON allocation_run_log (tenant_id, start_timestamp DESC);

-- allocated_cost_record (primary chargeback entity — heavily indexed)
CREATE INDEX idx_acr_tenant              ON allocated_cost_record (tenant_id);
CREATE INDEX idx_acr_billing_period      ON allocated_cost_record (tenant_id, billing_period);
CREATE INDEX idx_acr_bu                  ON allocated_cost_record (tenant_id, owner_bu_id)
    WHERE owner_bu_id IS NOT NULL;
CREATE INDEX idx_acr_application         ON allocated_cost_record (tenant_id, owner_application_id)
    WHERE owner_application_id IS NOT NULL;
CREATE INDEX idx_acr_cost_center         ON allocated_cost_record (tenant_id, owner_cost_center_id)
    WHERE owner_cost_center_id IS NOT NULL;
CREATE INDEX idx_acr_category            ON allocated_cost_record (tenant_id, cost_category);
CREATE INDEX idx_acr_provider            ON allocated_cost_record (tenant_id, provider);
CREATE INDEX idx_acr_run                 ON allocated_cost_record (tenant_id, allocation_run_id);
CREATE INDEX idx_acr_source_record       ON allocated_cost_record (source_cost_record_id);

-- allocation_audit_log
CREATE INDEX idx_aal_tenant              ON allocation_audit_log (tenant_id);
CREATE INDEX idx_aal_event_type          ON allocation_audit_log (tenant_id, event_type);
CREATE INDEX idx_aal_timestamp           ON allocation_audit_log (tenant_id, event_timestamp DESC);
CREATE INDEX idx_aal_run                 ON allocation_audit_log (tenant_id, run_id)
    WHERE run_id IS NOT NULL;
CREATE INDEX idx_aal_rule                ON allocation_audit_log (tenant_id, rule_id)
    WHERE rule_id IS NOT NULL;

-- ============================================================================
-- END: V003__A03_allocation_agent.sql
-- ============================================================================
