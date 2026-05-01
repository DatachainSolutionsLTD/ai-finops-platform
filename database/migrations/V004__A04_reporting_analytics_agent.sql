-- ============================================================================
-- Migration: V004__A04_reporting_analytics_agent.sql
-- Agent:     A04 — Reporting & Analytics Agent
-- Module:    Report Generation, NL Query, Proactive Insights
-- Scope:     Seed Round (Understand Layer)
-- Database:  PostgreSQL 16 with Row-Level Security
-- Depends:   V001 (A01), V002 (A02), V003 (A03)
-- ============================================================================
-- Entities:  report_definition, report_generation_log, nl_query_log,
--            proactive_insight_log, report_consumption_metric,
--            report_audit_log
-- ============================================================================

SET search_path TO public;

-- --------------------------------------------------------------------------
-- ENUM TYPES — A04
-- --------------------------------------------------------------------------

CREATE TYPE report_type AS ENUM (
    'Cost_Summary', 'Budget_Variance', 'Optimization_Summary',
    'Executive_Briefing', 'Chargeback', 'Governance_Scorecard', 'Custom'
);

CREATE TYPE time_range_type AS ENUM (
    'Last_7d', 'Last_30d', 'Last_90d', 'MTD', 'QTD', 'YTD', 'Custom'
);

CREATE TYPE report_granularity AS ENUM (
    'Daily', 'Weekly', 'Monthly'
);

CREATE TYPE distribution_channel AS ENUM (
    'Email', 'Dashboard', 'API', 'Webhook'
);

CREATE TYPE persona_type AS ENUM (
    'Executive', 'Finance', 'Engineering', 'FinOps_Analyst', 'All'
);

CREATE TYPE report_generation_trigger AS ENUM (
    'Scheduled', 'On_Demand', 'Data_Refresh', 'Retry'
);

CREATE TYPE report_generation_status AS ENUM (
    'Running', 'Completed', 'Partial', 'Failed', 'Timeout'
);

CREATE TYPE nl_response_type AS ENUM (
    'Narrative', 'Chart', 'Table', 'Clarification', 'Error'
);

CREATE TYPE user_feedback AS ENUM (
    'Positive', 'Negative', 'None'
);

CREATE TYPE insight_type AS ENUM (
    'Trend', 'Efficiency', 'Governance', 'Benchmark', 'Forecast', 'Budget'
);

CREATE TYPE insight_severity AS ENUM (
    'Informational', 'Warning', 'Critical'
);

CREATE TYPE insight_channel AS ENUM (
    'Email', 'In_App', 'API', 'Webhook'
);

CREATE TYPE engagement_status AS ENUM (
    'Pending', 'Viewed', 'Dismissed', 'Acted_Upon'
);

CREATE TYPE consumption_event_type AS ENUM (
    'View', 'Download', 'Email_Open', 'NL_Query', 'Insight_View', 'Export'
);

CREATE TYPE report_persona AS ENUM (
    'Executive', 'Finance', 'Engineering', 'FinOps_Analyst'
);

CREATE TYPE report_audit_event_type AS ENUM (
    'Report_Generated', 'Report_Distributed', 'Report_Viewed',
    'Report_Exported', 'Report_Config_Created', 'Report_Config_Modified',
    'NL_Query_Executed', 'Insight_Generated', 'Insight_Distributed',
    'Access_Denied'
);


-- --------------------------------------------------------------------------
-- TABLE: report_definition
-- --------------------------------------------------------------------------

CREATE TABLE report_definition (
    report_id               UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID                NOT NULL,
    report_name             VARCHAR(200)        NOT NULL,
    report_type             report_type         NOT NULL,
    template_id             UUID                NOT NULL,
    template_version        VARCHAR(20)         NOT NULL,
    schedule_cron           VARCHAR(50),
    schedule_timezone       VARCHAR(50)         DEFAULT 'UTC',
    time_range_type         time_range_type     NOT NULL,
    granularity             report_granularity  NOT NULL,
    filter_config_json      JSONB,
    recipient_list_json     JSONB,
    distribution_channels   distribution_channel[] NOT NULL,
    persona_target          persona_type,
    is_active               BOOLEAN             NOT NULL DEFAULT TRUE,
    created_by              UUID                NOT NULL,
    created_date            TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    last_modified_by        UUID                NOT NULL,
    last_modified_date      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_report_name_per_tenant
        UNIQUE (tenant_id, report_name)
);

COMMENT ON TABLE report_definition IS 'A04: Report configuration definitions with scheduling and distribution';


-- --------------------------------------------------------------------------
-- TABLE: report_generation_log
-- --------------------------------------------------------------------------

CREATE TABLE report_generation_log (
    generation_id           UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID                        NOT NULL,
    report_id               UUID                        NOT NULL
                                                        REFERENCES report_definition(report_id),
    trigger_type            report_generation_trigger   NOT NULL,
    start_timestamp         TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    end_timestamp           TIMESTAMPTZ,
    status                  report_generation_status    NOT NULL DEFAULT 'Running',
    records_queried         INTEGER                     CHECK (records_queried >= 0),
    sections_rendered       INTEGER                     CHECK (sections_rendered >= 0),
    data_freshness_json     JSONB,
    duration_seconds        INTEGER,
    output_formats          VARCHAR(100),
    file_size_bytes         INTEGER                     CHECK (file_size_bytes >= 0),
    distribution_count      INTEGER                     CHECK (distribution_count >= 0),
    error_type              VARCHAR(100),
    error_detail            VARCHAR(4000),
    pipeline_version        VARCHAR(50)                 NOT NULL
);

COMMENT ON TABLE report_generation_log IS 'A04: Execution log for each report generation run';


-- --------------------------------------------------------------------------
-- TABLE: nl_query_log
-- --------------------------------------------------------------------------

CREATE TABLE nl_query_log (
    query_id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID            NOT NULL,
    user_id                     UUID            NOT NULL,
    query_text                  VARCHAR(2000)   NOT NULL,
    intent_classified           VARCHAR(100),
    entities_extracted_json     JSONB,
    confidence_score            NUMERIC(5,2)    CHECK (confidence_score BETWEEN 0 AND 100),
    query_sql_generated         VARCHAR(4000),
    response_type               nl_response_type,
    response_duration_ms        INTEGER         CHECK (response_duration_ms >= 0),
    user_feedback               user_feedback   DEFAULT 'None',
    session_id                  UUID,
    query_timestamp             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE nl_query_log IS 'A04: Natural language query interactions and feedback tracking';


-- --------------------------------------------------------------------------
-- TABLE: proactive_insight_log
-- --------------------------------------------------------------------------

CREATE TABLE proactive_insight_log (
    insight_id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID                NOT NULL,
    insight_type            insight_type        NOT NULL,
    severity                insight_severity    NOT NULL,
    audience_personas       report_persona[]    NOT NULL,
    narrative_text          VARCHAR(4000)       NOT NULL,
    data_snapshot_json      JSONB               NOT NULL,
    relevance_score         NUMERIC(5,2)        CHECK (relevance_score BETWEEN 0 AND 100),
    distribution_channels   insight_channel[]   NOT NULL,
    engagement_status       engagement_status   DEFAULT 'Pending',
    suppression_flag        BOOLEAN             NOT NULL DEFAULT FALSE,
    related_agent_id        VARCHAR(10),
    generation_timestamp    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    engagement_timestamp    TIMESTAMPTZ
);

COMMENT ON TABLE proactive_insight_log IS 'A04: Proactively generated cost insights pushed to stakeholders';


-- --------------------------------------------------------------------------
-- TABLE: report_consumption_metric
-- --------------------------------------------------------------------------

CREATE TABLE report_consumption_metric (
    metric_id               UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID                    NOT NULL,
    report_id               UUID                    REFERENCES report_definition(report_id),
    dashboard_id            VARCHAR(100),
    user_id                 UUID,
    persona                 report_persona          NOT NULL,
    event_type              consumption_event_type  NOT NULL,
    duration_seconds        INTEGER                 CHECK (duration_seconds >= 0),
    interaction_depth       INTEGER                 CHECK (interaction_depth >= 0),
    export_format           VARCHAR(10),
    event_timestamp         TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE report_consumption_metric IS 'A04: Report and dashboard consumption analytics for engagement tracking';


-- --------------------------------------------------------------------------
-- TABLE: report_audit_log  (append-only)
-- --------------------------------------------------------------------------

CREATE TABLE report_audit_log (
    log_id              UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID                        NOT NULL,
    event_type          report_audit_event_type     NOT NULL,
    report_id           UUID,
    generation_id       UUID,
    user_id             UUID,
    event_detail        JSONB,
    error_detail        VARCHAR(4000),
    event_timestamp     TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    ip_address          VARCHAR(45)
);

COMMENT ON TABLE report_audit_log IS 'A04: Immutable audit trail for all reporting and analytics events';


-- --------------------------------------------------------------------------
-- ROW-LEVEL SECURITY — A04 Tables
-- --------------------------------------------------------------------------

ALTER TABLE report_definition           ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generation_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nl_query_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_insight_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_consumption_metric   ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_audit_log            ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_report_definition ON report_definition
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_report_generation_log ON report_generation_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_nl_query_log ON nl_query_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_proactive_insight_log ON proactive_insight_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_report_consumption_metric ON report_consumption_metric
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_report_audit_log ON report_audit_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);


-- --------------------------------------------------------------------------
-- INDEXES — A04
-- --------------------------------------------------------------------------

-- report_definition
CREATE INDEX idx_rd_tenant               ON report_definition (tenant_id);
CREATE INDEX idx_rd_type                 ON report_definition (tenant_id, report_type);
CREATE INDEX idx_rd_active               ON report_definition (tenant_id, is_active)
    WHERE is_active = TRUE;
CREATE INDEX idx_rd_persona              ON report_definition (tenant_id, persona_target);

-- report_generation_log
CREATE INDEX idx_rgl_tenant              ON report_generation_log (tenant_id);
CREATE INDEX idx_rgl_report              ON report_generation_log (tenant_id, report_id);
CREATE INDEX idx_rgl_status              ON report_generation_log (tenant_id, status);
CREATE INDEX idx_rgl_start_ts            ON report_generation_log (tenant_id, start_timestamp DESC);

-- nl_query_log
CREATE INDEX idx_nql_tenant              ON nl_query_log (tenant_id);
CREATE INDEX idx_nql_user                ON nl_query_log (tenant_id, user_id);
CREATE INDEX idx_nql_session             ON nl_query_log (tenant_id, session_id)
    WHERE session_id IS NOT NULL;
CREATE INDEX idx_nql_timestamp           ON nl_query_log (tenant_id, query_timestamp DESC);
CREATE INDEX idx_nql_feedback            ON nl_query_log (tenant_id, user_feedback)
    WHERE user_feedback != 'None';

-- proactive_insight_log
CREATE INDEX idx_pil_tenant              ON proactive_insight_log (tenant_id);
CREATE INDEX idx_pil_type                ON proactive_insight_log (tenant_id, insight_type);
CREATE INDEX idx_pil_severity            ON proactive_insight_log (tenant_id, severity);
CREATE INDEX idx_pil_engagement          ON proactive_insight_log (tenant_id, engagement_status);
CREATE INDEX idx_pil_timestamp           ON proactive_insight_log (tenant_id, generation_timestamp DESC);
CREATE INDEX idx_pil_unsuppressed        ON proactive_insight_log (tenant_id, generation_timestamp DESC)
    WHERE suppression_flag = FALSE;

-- report_consumption_metric
CREATE INDEX idx_rcm_tenant              ON report_consumption_metric (tenant_id);
CREATE INDEX idx_rcm_report              ON report_consumption_metric (tenant_id, report_id)
    WHERE report_id IS NOT NULL;
CREATE INDEX idx_rcm_persona             ON report_consumption_metric (tenant_id, persona);
CREATE INDEX idx_rcm_event_type          ON report_consumption_metric (tenant_id, event_type);
CREATE INDEX idx_rcm_timestamp           ON report_consumption_metric (tenant_id, event_timestamp DESC);

-- report_audit_log
CREATE INDEX idx_ral_tenant              ON report_audit_log (tenant_id);
CREATE INDEX idx_ral_event_type          ON report_audit_log (tenant_id, event_type);
CREATE INDEX idx_ral_timestamp           ON report_audit_log (tenant_id, event_timestamp DESC);
CREATE INDEX idx_ral_report              ON report_audit_log (tenant_id, report_id)
    WHERE report_id IS NOT NULL;

-- ============================================================================
-- END: V004__A04_reporting_analytics_agent.sql
-- ============================================================================
