-- ============================================================================
-- Migration: V001__A01_data_ingestion_agent.sql
-- Agent:     A01 — Data Ingestion Agent
-- Module:    Data Acquisition & Normalization
-- Scope:     Seed Round (Understand Layer)
-- Database:  PostgreSQL 16 with Row-Level Security
-- ============================================================================
-- Entities:  data_source_connector, ingestion_run_log, raw_staging_record,
--            normalized_cost_record, rate_card, ingestion_audit_log
-- ============================================================================

SET search_path TO public;

-- --------------------------------------------------------------------------
-- ENUM TYPES — A01
-- --------------------------------------------------------------------------

CREATE TYPE source_type AS ENUM (
    'AWS', 'Azure', 'GCP', 'OCI',
    'VMware', 'Kubernetes', 'OpenShift', 'OpenStack', 'GPU_DCGM',
    'ERP', 'ITSM', 'CMDB', 'Manual'
);

CREATE TYPE credential_type AS ENUM (
    'API_Key', 'Service_Account', 'OAuth_Token', 'IAM_Role', 'Username_Password'
);

CREATE TYPE connector_status AS ENUM (
    'Healthy', 'Degraded', 'Failed', 'Pending'
);

CREATE TYPE ingestion_trigger_type AS ENUM (
    'Scheduled', 'On_Demand', 'Retry', 'Onboarding', 'Webhook', 'Manual_Upload'
);

CREATE TYPE ingestion_run_status AS ENUM (
    'Running', 'Completed', 'Partial', 'Failed', 'Quarantined'
);

CREATE TYPE quality_status AS ENUM (
    'Valid', 'Warning', 'Error', 'Quarantined'
);

CREATE TYPE provider_type AS ENUM (
    'AWS', 'Azure', 'GCP', 'OCI',
    'OnPrem_VMware', 'OnPrem_K8s', 'OnPrem_OpenShift',
    'OnPrem_OpenStack', 'OnPrem_GPU'
);

CREATE TYPE service_category AS ENUM (
    'Compute', 'Storage', 'Database', 'Network', 'GPU',
    'Serverless', 'Platform', 'Other'
);

CREATE TYPE charge_type AS ENUM (
    'Usage', 'Purchase', 'Tax', 'Credit', 'Adjustment', 'Fee'
);

CREATE TYPE attribution_status AS ENUM (
    'Fully_Attributed', 'Partially_Attributed', 'Unattributed'
);

CREATE TYPE environment_type AS ENUM (
    'Production', 'NonProd', 'Dev', 'Test', 'Staging', 'DR'
);

CREATE TYPE rate_card_resource_type AS ENUM (
    'Compute', 'Memory', 'Storage', 'GPU', 'License', 'Network', 'Facility'
);

CREATE TYPE ingestion_audit_event_type AS ENUM (
    'Ingestion_Started', 'Ingestion_Completed', 'Ingestion_Failed',
    'Retry_Initiated', 'Schema_Change_Detected', 'Credential_Alert',
    'Manual_Upload', 'Rate_Card_Updated', 'Connector_Created',
    'Connector_Modified', 'Quality_Warning'
);


-- --------------------------------------------------------------------------
-- TABLE: data_source_connector
-- --------------------------------------------------------------------------

CREATE TABLE data_source_connector (
    connector_id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID            NOT NULL,
    connector_name          VARCHAR(200)    NOT NULL,
    source_type             source_type     NOT NULL,
    source_subtype          VARCHAR(100),
    endpoint_url            VARCHAR(500),
    credential_ref          VARCHAR(200)    NOT NULL,
    credential_type         credential_type NOT NULL,
    credential_expiry       TIMESTAMPTZ,
    ingestion_schedule      VARCHAR(50)     NOT NULL DEFAULT '0 2,14 * * *',
    ingestion_interval_hours INTEGER        NOT NULL DEFAULT 12
                                            CHECK (ingestion_interval_hours BETWEEN 1 AND 24),
    last_successful_run     TIMESTAMPTZ,
    last_run_status         connector_status NOT NULL DEFAULT 'Pending',
    last_run_record_count   INTEGER         CHECK (last_run_record_count >= 0),
    retry_count             INTEGER         NOT NULL DEFAULT 0
                                            CHECK (retry_count BETWEEN 0 AND 5),
    error_type              VARCHAR(100),
    error_detail            VARCHAR(2000),
    schema_version          VARCHAR(50),
    config_json             JSONB,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by              UUID            NOT NULL,
    created_date            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_modified_by        UUID            NOT NULL,
    last_modified_date      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_connector_name_per_tenant
        UNIQUE (tenant_id, connector_name)
);

COMMENT ON TABLE data_source_connector IS 'A01: Registered data source connectors for ingestion pipelines';


-- --------------------------------------------------------------------------
-- TABLE: ingestion_run_log
-- --------------------------------------------------------------------------

CREATE TABLE ingestion_run_log (
    run_id                          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID                NOT NULL,
    connector_id                    UUID                NOT NULL
                                                        REFERENCES data_source_connector(connector_id),
    trigger_type                    ingestion_trigger_type NOT NULL,
    start_timestamp                 TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    end_timestamp                   TIMESTAMPTZ,
    status                          ingestion_run_status NOT NULL DEFAULT 'Running',
    records_expected                INTEGER             CHECK (records_expected >= 0),
    records_received                INTEGER             CHECK (records_received >= 0),
    records_validated               INTEGER             CHECK (records_validated >= 0),
    records_quarantined             INTEGER             CHECK (records_quarantined >= 0),
    records_deduplicated            INTEGER             CHECK (records_deduplicated >= 0),
    cost_reconciliation_source      NUMERIC(18,4)       CHECK (cost_reconciliation_source >= 0),
    cost_reconciliation_staged      NUMERIC(18,4)       CHECK (cost_reconciliation_staged >= 0),
    reconciliation_variance_pct     NUMERIC(8,4),
    quality_score                   NUMERIC(5,2)        CHECK (quality_score BETWEEN 0 AND 100),
    duration_seconds                INTEGER,
    error_type                      VARCHAR(100),
    error_detail                    VARCHAR(4000),
    pipeline_version                VARCHAR(50)         NOT NULL,
    performed_by                    UUID
);

COMMENT ON TABLE ingestion_run_log IS 'A01: Execution log for each ingestion pipeline run';


-- --------------------------------------------------------------------------
-- TABLE: raw_staging_record
-- --------------------------------------------------------------------------

CREATE TABLE raw_staging_record (
    record_id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID            NOT NULL,
    run_id                  UUID            NOT NULL
                                            REFERENCES ingestion_run_log(run_id),
    connector_id            UUID            NOT NULL
                                            REFERENCES data_source_connector(connector_id),
    source_type             source_type     NOT NULL,
    billing_period          DATE            NOT NULL,
    resource_id             VARCHAR(500),
    resource_name           VARCHAR(500),
    service_name            VARCHAR(200),
    region                  VARCHAR(100),
    account_id              VARCHAR(200),
    raw_cost                NUMERIC(18,6)   CHECK (raw_cost >= 0),
    raw_currency            CHAR(3),
    raw_usage_quantity      NUMERIC(18,6)   CHECK (raw_usage_quantity >= 0),
    raw_usage_unit          VARCHAR(50),
    tags_json               JSONB,
    raw_payload             JSONB,
    quality_status          quality_status  NOT NULL DEFAULT 'Valid',
    quality_notes           VARCHAR(1000),
    ingestion_timestamp     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE raw_staging_record IS 'A01: Raw ingested records before normalization';


-- --------------------------------------------------------------------------
-- TABLE: normalized_cost_record  (FOCUS-compliant)
-- --------------------------------------------------------------------------

CREATE TABLE normalized_cost_record (
    record_id                   UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID                NOT NULL,
    normalization_run_id        UUID                NOT NULL,
    source_run_id               UUID                NOT NULL
                                                    REFERENCES ingestion_run_log(run_id),
    billing_account_id          VARCHAR(200)        NOT NULL,
    sub_account_id              VARCHAR(200),
    provider                    provider_type       NOT NULL,
    service_name                VARCHAR(200)        NOT NULL,
    service_category            service_category    NOT NULL,
    resource_id                 VARCHAR(500),
    resource_name               VARCHAR(500),
    region                      VARCHAR(100),
    availability_zone           VARCHAR(100),
    charge_type                 charge_type         NOT NULL,
    billed_cost_sar             NUMERIC(18,6)       NOT NULL CHECK (billed_cost_sar >= 0),
    effective_cost_sar          NUMERIC(18,6)       CHECK (effective_cost_sar >= 0),
    amortized_cost_sar          NUMERIC(18,6)       CHECK (amortized_cost_sar >= 0),
    usage_quantity              NUMERIC(18,6)       CHECK (usage_quantity >= 0),
    usage_unit                  VARCHAR(50),
    billing_period              DATE                NOT NULL,
    business_unit_id            UUID,
    application_id              UUID,
    project_id                  UUID,
    cost_center_id              UUID,
    environment                 environment_type,
    tags_json                   JSONB,
    attribution_status          attribution_status  NOT NULL DEFAULT 'Unattributed',
    normalization_timestamp     TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE normalized_cost_record IS 'A01/A02: FOCUS-compliant normalized cost records — primary analytical entity';


-- --------------------------------------------------------------------------
-- TABLE: rate_card
-- --------------------------------------------------------------------------

CREATE TABLE rate_card (
    rate_card_id        UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID                    NOT NULL,
    resource_type       rate_card_resource_type  NOT NULL,
    unit_of_measure     VARCHAR(50)             NOT NULL,
    rate_sar            NUMERIC(12,6)           NOT NULL CHECK (rate_sar > 0),
    effective_from      DATE                    NOT NULL,
    effective_to        DATE,
    datacenter          VARCHAR(200),
    cluster             VARCHAR(200),
    notes               VARCHAR(500),
    approved_by         UUID,
    created_by          UUID                    NOT NULL,
    created_date        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_rate_card_dates
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

COMMENT ON TABLE rate_card IS 'A01: On-premises rate cards for cost computation';


-- --------------------------------------------------------------------------
-- TABLE: ingestion_audit_log  (append-only)
-- --------------------------------------------------------------------------

CREATE TABLE ingestion_audit_log (
    log_id              UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID                        NOT NULL,
    event_type          ingestion_audit_event_type  NOT NULL,
    run_id              UUID,
    connector_id        UUID,
    performed_by        UUID,
    event_detail        JSONB,
    error_detail        VARCHAR(4000),
    event_timestamp     TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    ip_address          VARCHAR(45)
);

COMMENT ON TABLE ingestion_audit_log IS 'A01: Immutable audit trail for all ingestion events';


-- --------------------------------------------------------------------------
-- ROW-LEVEL SECURITY — A01 Tables
-- --------------------------------------------------------------------------

ALTER TABLE data_source_connector   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_run_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_staging_record      ENABLE ROW LEVEL SECURITY;
ALTER TABLE normalized_cost_record  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_audit_log     ENABLE ROW LEVEL SECURITY;

-- RLS policies enforce tenant isolation via app-level SET role / current_setting
CREATE POLICY tenant_isolation_data_source_connector ON data_source_connector
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_ingestion_run_log ON ingestion_run_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_raw_staging_record ON raw_staging_record
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_normalized_cost_record ON normalized_cost_record
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_rate_card ON rate_card
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_ingestion_audit_log ON ingestion_audit_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);


-- --------------------------------------------------------------------------
-- INDEXES — A01
-- --------------------------------------------------------------------------

-- data_source_connector
CREATE INDEX idx_dsc_tenant              ON data_source_connector (tenant_id);
CREATE INDEX idx_dsc_source_type         ON data_source_connector (tenant_id, source_type);
CREATE INDEX idx_dsc_status              ON data_source_connector (tenant_id, last_run_status)
    WHERE is_active = TRUE;

-- ingestion_run_log
CREATE INDEX idx_irl_tenant              ON ingestion_run_log (tenant_id);
CREATE INDEX idx_irl_connector           ON ingestion_run_log (tenant_id, connector_id);
CREATE INDEX idx_irl_status              ON ingestion_run_log (tenant_id, status);
CREATE INDEX idx_irl_start_ts            ON ingestion_run_log (tenant_id, start_timestamp DESC);

-- raw_staging_record
CREATE INDEX idx_rsr_tenant              ON raw_staging_record (tenant_id);
CREATE INDEX idx_rsr_run                 ON raw_staging_record (tenant_id, run_id);
CREATE INDEX idx_rsr_billing_period      ON raw_staging_record (tenant_id, billing_period);
CREATE INDEX idx_rsr_quality             ON raw_staging_record (tenant_id, quality_status)
    WHERE quality_status != 'Valid';

-- normalized_cost_record (primary analytical table — heavily indexed)
CREATE INDEX idx_ncr_tenant              ON normalized_cost_record (tenant_id);
CREATE INDEX idx_ncr_billing_period      ON normalized_cost_record (tenant_id, billing_period);
CREATE INDEX idx_ncr_provider            ON normalized_cost_record (tenant_id, provider);
CREATE INDEX idx_ncr_service_category    ON normalized_cost_record (tenant_id, service_category);
CREATE INDEX idx_ncr_business_unit       ON normalized_cost_record (tenant_id, business_unit_id)
    WHERE business_unit_id IS NOT NULL;
CREATE INDEX idx_ncr_application         ON normalized_cost_record (tenant_id, application_id)
    WHERE application_id IS NOT NULL;
CREATE INDEX idx_ncr_attribution         ON normalized_cost_record (tenant_id, attribution_status);
CREATE INDEX idx_ncr_norm_run            ON normalized_cost_record (tenant_id, normalization_run_id);

-- rate_card
CREATE INDEX idx_rc_tenant               ON rate_card (tenant_id);
CREATE INDEX idx_rc_effective            ON rate_card (tenant_id, resource_type, effective_from, effective_to);

-- ingestion_audit_log
CREATE INDEX idx_ial_tenant              ON ingestion_audit_log (tenant_id);
CREATE INDEX idx_ial_event_type          ON ingestion_audit_log (tenant_id, event_type);
CREATE INDEX idx_ial_timestamp           ON ingestion_audit_log (tenant_id, event_timestamp DESC);
CREATE INDEX idx_ial_run                 ON ingestion_audit_log (tenant_id, run_id)
    WHERE run_id IS NOT NULL;

-- ============================================================================
-- END: V001__A01_data_ingestion_agent.sql
-- ============================================================================
