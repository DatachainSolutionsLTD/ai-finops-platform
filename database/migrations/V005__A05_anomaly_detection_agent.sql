-- ============================================================================
-- Migration: V005__A05_anomaly_detection_agent.sql
-- Agent:     A05 — Anomaly Detection Agent
-- Module:    Cost Anomaly Detection, Alerting & Lifecycle Management
-- Scope:     Seed Round (Understand Layer)
-- Database:  PostgreSQL 16 with Row-Level Security
-- Depends:   V001 (A01), V002 (A02), V003 (A03), V004 (A04)
-- ============================================================================
-- Entities:  anomaly_record, detection_run_log, anomaly_alert_log,
--            anomaly_lifecycle_log, suppression_rule, anomaly_audit_log
-- ============================================================================

SET search_path TO public;

-- --------------------------------------------------------------------------
-- ENUM TYPES — A05
-- --------------------------------------------------------------------------

CREATE TYPE detection_method AS ENUM (
    'Z_Score', 'IQR', 'EWMA', 'Rate_of_Change',
    'Isolation_Forest', 'Autoencoder', 'Transformer',
    'Manual_Report', 'Ensemble'
);

CREATE TYPE anomaly_severity AS ENUM (
    'Informational', 'Warning', 'Critical'
);

CREATE TYPE root_cause_category AS ENUM (
    'Billing_Error', 'Resource_Misconfiguration', 'Demand_Spike',
    'Pricing_Change', 'Security_Incident', 'Data_Quality', 'Unclassified'
);

CREATE TYPE deviation_direction AS ENUM (
    'Spike', 'Drop'
);

CREATE TYPE lifecycle_status AS ENUM (
    'Detected', 'Acknowledged', 'Investigating',
    'Resolved_Confirmed', 'Resolved_False_Positive',
    'Resolved_Expected', 'Auto_Suppressed'
);

CREATE TYPE resolution_type AS ENUM (
    'Confirmed', 'False_Positive', 'Expected_Change'
);

CREATE TYPE detection_trigger_type AS ENUM (
    'Scheduled', 'Data_Refresh', 'Threshold_Change',
    'Manual', 'Forecast_Deviation', 'Model_Update'
);

CREATE TYPE detection_run_status AS ENUM (
    'Running', 'Completed', 'Partial', 'Timeout', 'Failed'
);

CREATE TYPE alert_channel AS ENUM (
    'Email', 'In_App', 'Webhook', 'SMS', 'API'
);

CREATE TYPE alert_delivery_status AS ENUM (
    'Sent', 'Delivered', 'Failed', 'Bounced'
);

CREATE TYPE suppression_rule_type AS ENUM (
    'Explicit', 'Learned', 'User_Feedback'
);

CREATE TYPE suppression_max_severity AS ENUM (
    'Informational', 'Warning'
);

CREATE TYPE anomaly_audit_event_type AS ENUM (
    'Detection_Run', 'Anomaly_Created', 'Alert_Sent',
    'Lifecycle_Transition', 'Suppression_Applied',
    'Threshold_Changed', 'Rule_Created', 'Rule_Modified',
    'Agent_Notification', 'Manual_Report',
    'Access_Denied', 'Storm_Mode_Activated'
);


-- --------------------------------------------------------------------------
-- TABLE: detection_run_log
-- (Created before anomaly_record due to FK dependency)
-- --------------------------------------------------------------------------

CREATE TABLE detection_run_log (
    run_id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID                    NOT NULL,
    trigger_type            detection_trigger_type  NOT NULL,
    start_timestamp         TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    end_timestamp           TIMESTAMPTZ,
    status                  detection_run_status    NOT NULL DEFAULT 'Running',
    dimensions_scanned      INTEGER                 CHECK (dimensions_scanned >= 0),
    records_analyzed        INTEGER                 CHECK (records_analyzed >= 0),
    anomalies_detected      INTEGER                 CHECK (anomalies_detected >= 0),
    anomalies_suppressed    INTEGER                 CHECK (anomalies_suppressed >= 0),
    models_used             VARCHAR(200),
    duration_seconds        INTEGER,
    error_detail            VARCHAR(4000),
    pipeline_version        VARCHAR(50)             NOT NULL
);

COMMENT ON TABLE detection_run_log IS 'A05: Execution log for each anomaly detection cycle';


-- --------------------------------------------------------------------------
-- TABLE: suppression_rule
-- (Created before anomaly_record due to FK dependency)
-- --------------------------------------------------------------------------

CREATE TABLE suppression_rule (
    rule_id                     UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID                    NOT NULL,
    rule_name                   VARCHAR(200)            NOT NULL,
    rule_type                   suppression_rule_type   NOT NULL,
    match_criteria_json         JSONB                   NOT NULL,
    max_severity_suppressed     suppression_max_severity NOT NULL,
    effective_from              TIMESTAMPTZ             NOT NULL,
    effective_to                TIMESTAMPTZ,
    last_triggered              TIMESTAMPTZ,
    trigger_count               INTEGER                 NOT NULL DEFAULT 0,
    is_active                   BOOLEAN                 NOT NULL DEFAULT TRUE,
    created_by                  UUID                    NOT NULL,
    created_date                TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    approved_by                 UUID,

    CONSTRAINT uq_suppression_rule_name_per_tenant
        UNIQUE (tenant_id, rule_name),
    CONSTRAINT chk_suppression_rule_dates
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

COMMENT ON TABLE suppression_rule IS 'A05: Anomaly suppression rules to reduce alert fatigue';


-- --------------------------------------------------------------------------
-- TABLE: anomaly_record
-- --------------------------------------------------------------------------

CREATE TABLE anomaly_record (
    anomaly_id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID                NOT NULL,
    detection_run_id            UUID                NOT NULL
                                                    REFERENCES detection_run_log(run_id),
    detection_method            detection_method    NOT NULL,
    detection_timestamp         TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    severity                    anomaly_severity    NOT NULL,
    severity_score              NUMERIC(5,2)        NOT NULL CHECK (severity_score BETWEEN 0 AND 100),
    root_cause_category         root_cause_category NOT NULL DEFAULT 'Unclassified',
    root_cause_confidence       NUMERIC(5,2)        NOT NULL CHECK (root_cause_confidence BETWEEN 0 AND 100),
    provider                    VARCHAR(50),
    service_name                VARCHAR(200),
    region                      VARCHAR(100),
    business_unit_id            UUID,
    application_id              UUID,
    environment                 VARCHAR(50),
    baseline_value_sar          NUMERIC(18,4)       NOT NULL CHECK (baseline_value_sar >= 0),
    actual_value_sar            NUMERIC(18,4)       NOT NULL CHECK (actual_value_sar >= 0),
    deviation_amount_sar        NUMERIC(18,4)       NOT NULL,
    deviation_pct               NUMERIC(8,2)        NOT NULL,
    deviation_direction         deviation_direction NOT NULL,
    financial_impact_7d_sar     NUMERIC(18,4),
    financial_impact_30d_sar    NUMERIC(18,4),
    blast_radius                INTEGER             CHECK (blast_radius >= 1),
    confidence_score            NUMERIC(5,2)        NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    lifecycle_status            lifecycle_status    NOT NULL DEFAULT 'Detected',
    resolution_type             resolution_type,
    resolution_notes            VARCHAR(4000),
    resolved_by                 UUID,
    resolved_timestamp          TIMESTAMPTZ,
    suppression_rule_id         UUID                REFERENCES suppression_rule(rule_id),
    correlation_group_id        UUID,
    expected_change_id          UUID,
    created_date                TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE anomaly_record IS 'A05: Detected cost anomalies with severity scoring and lifecycle tracking';


-- --------------------------------------------------------------------------
-- TABLE: anomaly_alert_log
-- --------------------------------------------------------------------------

CREATE TABLE anomaly_alert_log (
    alert_id                UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    anomaly_id              UUID                    NOT NULL
                                                    REFERENCES anomaly_record(anomaly_id),
    tenant_id               UUID                    NOT NULL,
    alert_timestamp         TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    severity                anomaly_severity        NOT NULL,
    channel                 alert_channel           NOT NULL,
    recipient_id            UUID,
    recipient_email         VARCHAR(200),
    delivery_status         alert_delivery_status   NOT NULL DEFAULT 'Sent',
    retry_count             INTEGER                 NOT NULL DEFAULT 0
                                                    CHECK (retry_count BETWEEN 0 AND 3),
    escalation_tier         INTEGER                 CHECK (escalation_tier BETWEEN 1 AND 3),
    escalation_timestamp    TIMESTAMPTZ,
    narrative_text          VARCHAR(4000)
);

COMMENT ON TABLE anomaly_alert_log IS 'A05: Alert delivery log for anomaly notifications across channels';


-- --------------------------------------------------------------------------
-- TABLE: anomaly_lifecycle_log  (append-only)
-- --------------------------------------------------------------------------

CREATE TABLE anomaly_lifecycle_log (
    transition_id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    anomaly_id                      UUID            NOT NULL
                                                    REFERENCES anomaly_record(anomaly_id),
    tenant_id                       UUID            NOT NULL,
    previous_status                 lifecycle_status NOT NULL,
    new_status                      lifecycle_status NOT NULL,
    transitioned_by                 UUID,
    transition_timestamp            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    notes                           VARCHAR(4000),
    remediation_action              VARCHAR(4000),
    financial_impact_confirmed_sar  NUMERIC(18,4)   CHECK (financial_impact_confirmed_sar >= 0),
    root_cause_validated            root_cause_category,
    ip_address                      VARCHAR(45)
);

COMMENT ON TABLE anomaly_lifecycle_log IS 'A05: Immutable lifecycle state transitions for anomaly investigation workflow';


-- --------------------------------------------------------------------------
-- TABLE: anomaly_audit_log  (append-only)
-- --------------------------------------------------------------------------

CREATE TABLE anomaly_audit_log (
    log_id              UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID                        NOT NULL,
    event_type          anomaly_audit_event_type    NOT NULL,
    anomaly_id          UUID,
    run_id              UUID,
    performed_by        UUID,
    event_detail        JSONB,
    error_detail        VARCHAR(4000),
    event_timestamp     TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    ip_address          VARCHAR(45)
);

COMMENT ON TABLE anomaly_audit_log IS 'A05: Immutable audit trail for all anomaly detection events';


-- --------------------------------------------------------------------------
-- ROW-LEVEL SECURITY — A05 Tables
-- --------------------------------------------------------------------------

ALTER TABLE detection_run_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_rule        ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_record          ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alert_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_lifecycle_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_audit_log       ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_detection_run_log ON detection_run_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_suppression_rule ON suppression_rule
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_anomaly_record ON anomaly_record
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_anomaly_alert_log ON anomaly_alert_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_anomaly_lifecycle_log ON anomaly_lifecycle_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_anomaly_audit_log ON anomaly_audit_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);


-- --------------------------------------------------------------------------
-- INDEXES — A05
-- --------------------------------------------------------------------------

-- detection_run_log
CREATE INDEX idx_drl_tenant              ON detection_run_log (tenant_id);
CREATE INDEX idx_drl_status              ON detection_run_log (tenant_id, status);
CREATE INDEX idx_drl_start_ts            ON detection_run_log (tenant_id, start_timestamp DESC);

-- suppression_rule
CREATE INDEX idx_sr_tenant               ON suppression_rule (tenant_id);
CREATE INDEX idx_sr_active               ON suppression_rule (tenant_id, is_active)
    WHERE is_active = TRUE;
CREATE INDEX idx_sr_type                 ON suppression_rule (tenant_id, rule_type);

-- anomaly_record (primary anomaly entity — heavily indexed)
CREATE INDEX idx_anr_tenant              ON anomaly_record (tenant_id);
CREATE INDEX idx_anr_severity            ON anomaly_record (tenant_id, severity);
CREATE INDEX idx_anr_lifecycle           ON anomaly_record (tenant_id, lifecycle_status);
CREATE INDEX idx_anr_active              ON anomaly_record (tenant_id, severity, lifecycle_status)
    WHERE lifecycle_status NOT IN ('Resolved_Confirmed', 'Resolved_False_Positive',
                                    'Resolved_Expected', 'Auto_Suppressed');
CREATE INDEX idx_anr_provider            ON anomaly_record (tenant_id, provider)
    WHERE provider IS NOT NULL;
CREATE INDEX idx_anr_service             ON anomaly_record (tenant_id, service_name)
    WHERE service_name IS NOT NULL;
CREATE INDEX idx_anr_bu                  ON anomaly_record (tenant_id, business_unit_id)
    WHERE business_unit_id IS NOT NULL;
CREATE INDEX idx_anr_detection_ts        ON anomaly_record (tenant_id, detection_timestamp DESC);
CREATE INDEX idx_anr_detection_run       ON anomaly_record (tenant_id, detection_run_id);
CREATE INDEX idx_anr_correlation         ON anomaly_record (correlation_group_id)
    WHERE correlation_group_id IS NOT NULL;
CREATE INDEX idx_anr_root_cause          ON anomaly_record (tenant_id, root_cause_category);
CREATE INDEX idx_anr_impact_30d          ON anomaly_record (tenant_id, financial_impact_30d_sar DESC NULLS LAST)
    WHERE lifecycle_status NOT IN ('Resolved_Confirmed', 'Resolved_False_Positive',
                                    'Resolved_Expected', 'Auto_Suppressed');

-- anomaly_alert_log
CREATE INDEX idx_aal5_tenant             ON anomaly_alert_log (tenant_id);
CREATE INDEX idx_aal5_anomaly            ON anomaly_alert_log (anomaly_id);
CREATE INDEX idx_aal5_delivery           ON anomaly_alert_log (tenant_id, delivery_status);
CREATE INDEX idx_aal5_timestamp          ON anomaly_alert_log (tenant_id, alert_timestamp DESC);
CREATE INDEX idx_aal5_recipient          ON anomaly_alert_log (tenant_id, recipient_id)
    WHERE recipient_id IS NOT NULL;

-- anomaly_lifecycle_log
CREATE INDEX idx_all_tenant              ON anomaly_lifecycle_log (tenant_id);
CREATE INDEX idx_all_anomaly             ON anomaly_lifecycle_log (anomaly_id);
CREATE INDEX idx_all_timestamp           ON anomaly_lifecycle_log (tenant_id, transition_timestamp DESC);
CREATE INDEX idx_all_new_status          ON anomaly_lifecycle_log (tenant_id, new_status);

-- anomaly_audit_log
CREATE INDEX idx_aadl_tenant             ON anomaly_audit_log (tenant_id);
CREATE INDEX idx_aadl_event_type         ON anomaly_audit_log (tenant_id, event_type);
CREATE INDEX idx_aadl_timestamp          ON anomaly_audit_log (tenant_id, event_timestamp DESC);
CREATE INDEX idx_aadl_anomaly            ON anomaly_audit_log (tenant_id, anomaly_id)
    WHERE anomaly_id IS NOT NULL;
CREATE INDEX idx_aadl_run                ON anomaly_audit_log (tenant_id, run_id)
    WHERE run_id IS NOT NULL;

-- ============================================================================
-- END: V005__A05_anomaly_detection_agent.sql
-- ============================================================================
