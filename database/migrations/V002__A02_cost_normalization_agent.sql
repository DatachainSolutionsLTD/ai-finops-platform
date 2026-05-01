-- ============================================================================
-- Migration: V002__A02_cost_normalization_agent.sql
-- Agent:     A02 — Cost Normalization Agent
-- Module:    FOCUS Schema Transformation & Enrichment
-- Scope:     Seed Round (Understand Layer)
-- Database:  PostgreSQL 16 with Row-Level Security
-- Depends:   V001 (A01 — references ingestion_run_log, data_source_connector)
-- ============================================================================
-- Entities:  normalization_run_log, service_taxonomy_registry,
--            exchange_rate_config, normalization_audit_log
-- ============================================================================

SET search_path TO public;

-- --------------------------------------------------------------------------
-- ENUM TYPES — A02
-- --------------------------------------------------------------------------

CREATE TYPE normalization_trigger_type AS ENUM (
    'Ingestion_Event', 'Rate_Card_Update', 'Exchange_Rate_Update',
    'Taxonomy_Update', 'Enrichment_Update', 'Manual_Request',
    'FOCUS_Schema_Update', 'Retry', 'Tag_Remediation'
);

CREATE TYPE normalization_run_status AS ENUM (
    'Running', 'Completed', 'Partial', 'Failed', 'Quarantined'
);

CREATE TYPE taxonomy_service_category AS ENUM (
    'Compute', 'Storage', 'Database', 'Network', 'GPU',
    'Serverless', 'Platform', 'Security', 'Analytics', 'AI_ML', 'Other'
);

CREATE TYPE taxonomy_provider AS ENUM (
    'AWS', 'Azure', 'GCP', 'OCI'
);

CREATE TYPE normalization_audit_event_type AS ENUM (
    'Normalization_Started', 'Normalization_Completed', 'Normalization_Failed',
    'Retry_Initiated', 'Rate_Card_Applied', 'Exchange_Rate_Applied',
    'Taxonomy_Gap_Detected', 'Reconciliation_Warning',
    'FOCUS_Validation_Failed', 'Re_Normalization_Triggered',
    'Duplicate_Event_Discarded', 'Mapping_Conflict_Detected', 'Quality_Warning'
);


-- --------------------------------------------------------------------------
-- TABLE: normalization_run_log
-- --------------------------------------------------------------------------

CREATE TABLE normalization_run_log (
    run_id                          UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID                        NOT NULL,
    source_run_id                   UUID                        NOT NULL
                                                                REFERENCES ingestion_run_log(run_id),
    connector_id                    UUID                        NOT NULL
                                                                REFERENCES data_source_connector(connector_id),
    source_type                     source_type                 NOT NULL,
    trigger_type                    normalization_trigger_type   NOT NULL,
    start_timestamp                 TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    end_timestamp                   TIMESTAMPTZ,
    status                          normalization_run_status    NOT NULL DEFAULT 'Running',
    records_input                   INTEGER                     CHECK (records_input >= 0),
    records_normalized              INTEGER                     CHECK (records_normalized >= 0),
    records_quarantined             INTEGER                     CHECK (records_quarantined >= 0),
    reconciliation_source_sar       NUMERIC(18,4)               CHECK (reconciliation_source_sar >= 0),
    reconciliation_output_sar       NUMERIC(18,4)               CHECK (reconciliation_output_sar >= 0),
    reconciliation_variance_pct     NUMERIC(8,4),
    quality_score                   NUMERIC(5,2)                CHECK (quality_score BETWEEN 0 AND 100),
    focus_compliance_score          NUMERIC(5,2)                CHECK (focus_compliance_score BETWEEN 0 AND 100),
    unattributed_count              INTEGER                     CHECK (unattributed_count >= 0),
    taxonomy_gap_count              INTEGER                     CHECK (taxonomy_gap_count >= 0),
    duration_seconds                INTEGER,
    error_type                      VARCHAR(100),
    error_detail                    VARCHAR(4000),
    pipeline_version                VARCHAR(50)                 NOT NULL,
    rate_card_version               VARCHAR(50),
    exchange_rate_snapshot          JSONB,
    taxonomy_version                VARCHAR(50)
);

COMMENT ON TABLE normalization_run_log IS 'A02: Execution log for each normalization pipeline run';

-- Add FK from normalized_cost_record to this table
ALTER TABLE normalized_cost_record
    ADD CONSTRAINT fk_ncr_normalization_run
    FOREIGN KEY (normalization_run_id) REFERENCES normalization_run_log(run_id);


-- --------------------------------------------------------------------------
-- TABLE: service_taxonomy_registry  (reference table — no tenant scoping)
-- --------------------------------------------------------------------------

CREATE TABLE service_taxonomy_registry (
    mapping_id                      UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider                        taxonomy_provider           NOT NULL,
    source_service_name             VARCHAR(300)                NOT NULL,
    normalized_service_name         VARCHAR(200)                NOT NULL,
    normalized_service_category     taxonomy_service_category   NOT NULL,
    is_active                       BOOLEAN                     NOT NULL DEFAULT TRUE,
    created_by                      UUID                        NOT NULL,
    created_date                    TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    last_modified_by                UUID                        NOT NULL,
    last_modified_date              TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_taxonomy_provider_source
        UNIQUE (provider, source_service_name)
);

COMMENT ON TABLE service_taxonomy_registry IS 'A02: Cross-provider service name taxonomy mapping (reference table, replicated)';


-- --------------------------------------------------------------------------
-- TABLE: exchange_rate_config  (reference table — no tenant scoping)
-- --------------------------------------------------------------------------

CREATE TABLE exchange_rate_config (
    rate_id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    source_currency     CHAR(3)         NOT NULL,
    target_currency     CHAR(3)         NOT NULL DEFAULT 'SAR',
    exchange_rate       NUMERIC(12,6)   NOT NULL CHECK (exchange_rate > 0),
    effective_from      DATE            NOT NULL,
    effective_to        DATE,
    updated_by          UUID            NOT NULL,
    updated_date        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_exchange_rate_dates
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

COMMENT ON TABLE exchange_rate_config IS 'A02: Currency exchange rate configuration (SAR as base target currency)';


-- --------------------------------------------------------------------------
-- TABLE: normalization_audit_log  (append-only)
-- --------------------------------------------------------------------------

CREATE TABLE normalization_audit_log (
    log_id              UUID                                PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID                                NOT NULL,
    event_type          normalization_audit_event_type       NOT NULL,
    run_id              UUID,
    source_run_id       UUID,
    performed_by        UUID,
    event_detail        JSONB,
    error_detail        VARCHAR(4000),
    event_timestamp     TIMESTAMPTZ                         NOT NULL DEFAULT NOW(),
    ip_address          VARCHAR(45)
);

COMMENT ON TABLE normalization_audit_log IS 'A02: Immutable audit trail for all normalization events';


-- --------------------------------------------------------------------------
-- ROW-LEVEL SECURITY — A02 Tables
-- --------------------------------------------------------------------------
-- service_taxonomy_registry and exchange_rate_config are reference tables
-- (no tenant scoping) — RLS not applied.

ALTER TABLE normalization_run_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE normalization_audit_log     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_normalization_run_log ON normalization_run_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_normalization_audit_log ON normalization_audit_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);


-- --------------------------------------------------------------------------
-- INDEXES — A02
-- --------------------------------------------------------------------------

-- normalization_run_log
CREATE INDEX idx_nrl_tenant              ON normalization_run_log (tenant_id);
CREATE INDEX idx_nrl_source_run          ON normalization_run_log (tenant_id, source_run_id);
CREATE INDEX idx_nrl_status              ON normalization_run_log (tenant_id, status);
CREATE INDEX idx_nrl_start_ts            ON normalization_run_log (tenant_id, start_timestamp DESC);
CREATE INDEX idx_nrl_connector           ON normalization_run_log (tenant_id, connector_id);

-- service_taxonomy_registry
CREATE INDEX idx_str_provider            ON service_taxonomy_registry (provider);
CREATE INDEX idx_str_normalized_name     ON service_taxonomy_registry (normalized_service_name);
CREATE INDEX idx_str_category            ON service_taxonomy_registry (normalized_service_category);
CREATE INDEX idx_str_active              ON service_taxonomy_registry (provider, is_active)
    WHERE is_active = TRUE;

-- exchange_rate_config
CREATE INDEX idx_erc_currency_pair       ON exchange_rate_config (source_currency, target_currency);
CREATE INDEX idx_erc_effective           ON exchange_rate_config (source_currency, target_currency, effective_from, effective_to);

-- normalization_audit_log
CREATE INDEX idx_nal_tenant              ON normalization_audit_log (tenant_id);
CREATE INDEX idx_nal_event_type          ON normalization_audit_log (tenant_id, event_type);
CREATE INDEX idx_nal_timestamp           ON normalization_audit_log (tenant_id, event_timestamp DESC);
CREATE INDEX idx_nal_run                 ON normalization_audit_log (tenant_id, run_id)
    WHERE run_id IS NOT NULL;

-- ============================================================================
-- END: V002__A02_cost_normalization_agent.sql
-- ============================================================================
