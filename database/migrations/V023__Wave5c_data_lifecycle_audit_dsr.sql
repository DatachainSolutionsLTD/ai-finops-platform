-- =============================================================================
-- V023 — Wave 5c: AP-01 Data Lifecycle + Unified Audit + DSR/GDPR Compliance
-- Source: FSD-AP-01 §Data Lifecycle, §Audit Console, §Compliance
-- =============================================================================
-- Purpose: The compliance layer — retention policies, archival jobs,
-- GDPR/PDPL data subject rights, unified cross-agent audit view.
-- FSD flags "No unified audit log" and "No unified data archival" as CRITICAL GAPs.
--
-- FINAL WAVE — this completes the platform DDL across all FSDs.
--
-- Reuses: gov_severity, opt_priority_tier
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- Data Retention & Archival
CREATE TYPE dl_data_category AS ENUM (
    'Operational_Data', 'Cost_Data', 'Metering_Data', 'Billing_Data',
    'Audit_Log', 'Agent_Reasoning', 'User_Activity', 'Notification_History',
    'Configuration_History', 'Report_Output', 'Personal_Data',
    'Financial_Records', 'Communication_Content', 'Telemetry_Metric'
);

CREATE TYPE dl_retention_action AS ENUM (
    'Delete_Hard', 'Anonymize', 'Archive_Cold_Storage',
    'Move_To_Slower_Tier', 'Aggregate_And_Purge', 'No_Action_Legal_Hold'
);

CREATE TYPE dl_archival_job_status AS ENUM (
    'Scheduled', 'Running', 'Completed', 'Partial_Success',
    'Failed', 'Paused', 'Cancelled', 'Blocked_Legal_Hold'
);

-- Unified Audit
CREATE TYPE au_event_category AS ENUM (
    'Authentication', 'Authorization', 'Data_Access', 'Data_Modification',
    'Configuration_Change', 'Agent_Action', 'Policy_Evaluation',
    'Workflow_Transition', 'Approval_Decision', 'System_Event',
    'Security_Event', 'Compliance_Event', 'Financial_Transaction'
);

CREATE TYPE au_event_outcome AS ENUM (
    'Success', 'Failure', 'Partial', 'Blocked', 'Error'
);

CREATE TYPE au_actor_type AS ENUM (
    'Human_User', 'Agent', 'Service_Account', 'API_Key', 'System', 'External_System'
);

-- Data Subject Rights (GDPR/PDPL)
CREATE TYPE dsr_request_type AS ENUM (
    'Access_Request', 'Erasure_Right_To_Be_Forgotten', 'Rectification',
    'Portability', 'Restriction_Of_Processing', 'Objection_To_Processing',
    'Automated_Decision_Explanation', 'Consent_Withdrawal'
);

CREATE TYPE dsr_request_status AS ENUM (
    'Submitted', 'Identity_Verification_Pending', 'Identity_Verified',
    'In_Progress', 'Pending_Legal_Review', 'Completed', 'Partially_Completed',
    'Rejected', 'Withdrawn', 'Overdue'
);

CREATE TYPE dsr_legal_basis AS ENUM (
    'Consent', 'Contract_Performance', 'Legal_Obligation',
    'Vital_Interests', 'Public_Task', 'Legitimate_Interests'
);

CREATE TYPE lh_legal_hold_status AS ENUM (
    'Active', 'Released', 'Expired'
);

-- ============================================================================
-- DATA RETENTION & ARCHIVAL
-- ============================================================================

-- Retention policies (FSD AP-SET-005, AP-SET-024)
CREATE TABLE dl_retention_policy (
    policy_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    policy_name             VARCHAR(200) NOT NULL,
    data_category           dl_data_category NOT NULL,
    scope_filter_json       JSONB,
    active_retention_days   INTEGER NOT NULL,
    archival_retention_days INTEGER,
    expiry_action           dl_retention_action NOT NULL,
    archival_storage_tier   VARCHAR(100),
    regulatory_framework    VARCHAR(100),
    is_regulatory_minimum   BOOLEAN NOT NULL DEFAULT FALSE,
    data_sovereignty_region VARCHAR(100),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    UNIQUE (tenant_id, policy_name, effective_from)
);
CREATE INDEX idx_dl_pol_tenant_cat ON dl_retention_policy (tenant_id, data_category) WHERE is_active;
CREATE INDEX idx_dl_pol_platform ON dl_retention_policy (data_category) WHERE tenant_id IS NULL AND is_active;

-- Archival job runs
CREATE TABLE dl_archival_job (
    job_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    policy_id               UUID NOT NULL REFERENCES dl_retention_policy(policy_id),
    data_category           dl_data_category NOT NULL,
    target_table_name       VARCHAR(200),
    eligible_record_count   BIGINT,
    records_processed       BIGINT NOT NULL DEFAULT 0,
    records_archived        BIGINT NOT NULL DEFAULT 0,
    records_deleted         BIGINT NOT NULL DEFAULT 0,
    records_anonymized      BIGINT NOT NULL DEFAULT 0,
    records_skipped_legal_hold BIGINT NOT NULL DEFAULT 0,
    records_failed          BIGINT NOT NULL DEFAULT 0,
    archive_storage_uri     TEXT,
    manifest_hash           CHAR(64),
    status                  dl_archival_job_status NOT NULL DEFAULT 'Scheduled',
    scheduled_at            TIMESTAMPTZ NOT NULL,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    duration_ms             INTEGER,
    error_detail            TEXT,
    triggered_by            VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
    triggered_by_user_id    UUID REFERENCES auth_user(user_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dl_job_tenant_status ON dl_archival_job (tenant_id, status, scheduled_at DESC);
CREATE INDEX idx_dl_job_policy ON dl_archival_job (policy_id, scheduled_at DESC);
CREATE INDEX idx_dl_job_failed ON dl_archival_job (status, scheduled_at DESC) WHERE status IN ('Failed', 'Partial_Success');

-- Legal holds (freeze deletion/archival for litigation or regulatory inquiry)
CREATE TABLE dl_legal_hold (
    legal_hold_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    hold_name               VARCHAR(500) NOT NULL,
    hold_reason             TEXT NOT NULL,
    hold_category           VARCHAR(100),
    data_category_filter    dl_data_category[],
    scope_filter_json       JSONB,
    date_range_start        DATE,
    date_range_end          DATE,
    affected_user_ids       UUID[],
    external_case_reference VARCHAR(200),
    status                  lh_legal_hold_status NOT NULL DEFAULT 'Active',
    placed_by               UUID NOT NULL REFERENCES auth_user(user_id),
    placed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_by             UUID REFERENCES auth_user(user_id),
    released_at             TIMESTAMPTZ,
    release_reason          TEXT,
    expires_at              TIMESTAMPTZ,
    notes                   TEXT
);
CREATE INDEX idx_dl_hold_tenant_active ON dl_legal_hold (tenant_id) WHERE status = 'Active';
CREATE INDEX idx_dl_hold_expiring ON dl_legal_hold (expires_at) WHERE status = 'Active' AND expires_at IS NOT NULL;

-- ============================================================================
-- UNIFIED AUDIT LOG (cross-agent, cross-domain)
-- ============================================================================

-- The central audit table (partitioned daily-scale or monthly depending on volume)
CREATE TABLE au_audit_event (
    audit_event_id          UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID,
    event_category          au_event_category NOT NULL,
    event_type              VARCHAR(200) NOT NULL,
    event_outcome           au_event_outcome NOT NULL,
    actor_type              au_actor_type NOT NULL,
    actor_user_id           UUID,
    actor_agent_id          UUID,
    actor_service_account_id UUID,
    actor_api_key_id        UUID,
    actor_display_name      VARCHAR(500),
    target_entity_type      VARCHAR(200),
    target_entity_id        UUID,
    target_display_name     VARCHAR(500),
    source_agent_id         UUID,
    source_module           VARCHAR(200),
    action_performed        VARCHAR(500) NOT NULL,
    request_method          VARCHAR(20),
    request_path            VARCHAR(1000),
    request_payload_json    JSONB,
    response_payload_json   JSONB,
    before_state_json       JSONB,
    after_state_json        JSONB,
    client_ip               INET,
    user_agent              VARCHAR(500),
    correlation_id          UUID,
    parent_event_id         UUID,
    session_id              UUID,
    severity                gov_severity NOT NULL DEFAULT 'Informational',
    requires_review         BOOLEAN NOT NULL DEFAULT FALSE,
    signature_hash          CHAR(64),
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (audit_event_id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE au_audit_event_y2026m07 PARTITION OF au_audit_event
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE au_audit_event_y2026m08 PARTITION OF au_audit_event
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_au_ev_tenant_time ON au_audit_event (tenant_id, occurred_at DESC);
CREATE INDEX idx_au_ev_category ON au_audit_event (event_category, occurred_at DESC);
CREATE INDEX idx_au_ev_actor_user ON au_audit_event (actor_user_id, occurred_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_au_ev_actor_agent ON au_audit_event (actor_agent_id, occurred_at DESC) WHERE actor_agent_id IS NOT NULL;
CREATE INDEX idx_au_ev_target ON au_audit_event (target_entity_type, target_entity_id);
CREATE INDEX idx_au_ev_correlation ON au_audit_event (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_au_ev_review ON au_audit_event (occurred_at DESC) WHERE requires_review = TRUE;
CREATE INDEX idx_au_ev_failures ON au_audit_event (event_category, occurred_at DESC) WHERE event_outcome IN ('Failure', 'Blocked');

-- Audit export jobs (AP-SET-024, regulatory reporting)
CREATE TABLE au_audit_export (
    export_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    export_name             VARCHAR(500) NOT NULL,
    date_range_start        TIMESTAMPTZ NOT NULL,
    date_range_end          TIMESTAMPTZ NOT NULL,
    filter_json             JSONB,
    export_format           VARCHAR(30) NOT NULL,
    record_count            BIGINT,
    file_size_bytes         BIGINT,
    storage_uri             TEXT,
    manifest_hash           CHAR(64),
    status                  VARCHAR(30) NOT NULL DEFAULT 'Queued',
    requested_by            UUID NOT NULL REFERENCES auth_user(user_id),
    requested_purpose       TEXT,
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,
    downloaded_at           TIMESTAMPTZ,
    download_count          INTEGER NOT NULL DEFAULT 0,
    error_detail            TEXT
);
CREATE INDEX idx_au_exp_tenant_time ON au_audit_export (tenant_id, requested_at DESC);
CREATE INDEX idx_au_exp_status ON au_audit_export (status) WHERE status IN ('Queued', 'Running');
CREATE INDEX idx_au_exp_expiring ON au_audit_export (expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- DATA SUBJECT RIGHTS (GDPR / PDPL)
-- ============================================================================

-- DSR request tracking
CREATE TABLE dsr_request (
    request_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number          VARCHAR(50) NOT NULL UNIQUE,
    tenant_id               UUID REFERENCES tenant(tenant_id),
    requester_user_id       UUID REFERENCES auth_user(user_id),
    requester_email         VARCHAR(320) NOT NULL,
    requester_display_name  VARCHAR(500),
    data_subject_user_id    UUID REFERENCES auth_user(user_id),
    data_subject_identifiers_json JSONB NOT NULL,
    request_type            dsr_request_type NOT NULL,
    description             TEXT,
    regulatory_framework    VARCHAR(100) NOT NULL,
    legal_basis             dsr_legal_basis,
    identity_verified       BOOLEAN NOT NULL DEFAULT FALSE,
    identity_verification_method VARCHAR(200),
    identity_verified_at    TIMESTAMPTZ,
    identity_verified_by    UUID REFERENCES auth_user(user_id),
    status                  dsr_request_status NOT NULL DEFAULT 'Submitted',
    priority                opt_priority_tier NOT NULL DEFAULT 'P3_Medium',
    sla_deadline            TIMESTAMPTZ NOT NULL,
    assigned_to_user_id     UUID REFERENCES auth_user(user_id),
    legal_review_required   BOOLEAN NOT NULL DEFAULT FALSE,
    legal_reviewed_by       UUID REFERENCES auth_user(user_id),
    legal_reviewed_at       TIMESTAMPTZ,
    legal_hold_id           UUID REFERENCES dl_legal_hold(legal_hold_id),
    completed_at            TIMESTAMPTZ,
    completion_evidence_uri TEXT,
    rejection_reason        TEXT,
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dsr_tenant_status ON dsr_request (tenant_id, status);
CREATE INDEX idx_dsr_sla ON dsr_request (sla_deadline) WHERE status NOT IN ('Completed', 'Rejected', 'Withdrawn');
CREATE INDEX idx_dsr_subject ON dsr_request (data_subject_user_id) WHERE data_subject_user_id IS NOT NULL;
CREATE INDEX idx_dsr_assigned ON dsr_request (assigned_to_user_id) WHERE status NOT IN ('Completed', 'Rejected', 'Withdrawn');

-- Data discovery results (per DSR request — where does this person's data live)
CREATE TABLE dsr_data_discovery (
    discovery_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id              UUID NOT NULL REFERENCES dsr_request(request_id) ON DELETE CASCADE,
    tenant_id               UUID REFERENCES tenant(tenant_id),
    source_system           VARCHAR(200) NOT NULL,
    table_or_resource       VARCHAR(500) NOT NULL,
    data_category           dl_data_category NOT NULL,
    record_count            BIGINT NOT NULL,
    record_identifiers_json JSONB,
    contains_pii            BOOLEAN NOT NULL DEFAULT TRUE,
    contains_special_category BOOLEAN NOT NULL DEFAULT FALSE,
    discovered_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_taken            VARCHAR(50),
    action_taken_at         TIMESTAMPTZ
);
CREATE INDEX idx_dsr_disc_request ON dsr_data_discovery (request_id);
CREATE INDEX idx_dsr_disc_tenant ON dsr_data_discovery (tenant_id, discovered_at DESC);

-- DSR action log (every operation performed in service of a DSR request)
CREATE TABLE dsr_action_log (
    action_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id              UUID NOT NULL REFERENCES dsr_request(request_id) ON DELETE CASCADE,
    action_type             VARCHAR(100) NOT NULL,
    target_source_system    VARCHAR(200),
    target_table_or_resource VARCHAR(500),
    records_affected        BIGINT,
    action_status           VARCHAR(30) NOT NULL,
    performed_by            UUID REFERENCES auth_user(user_id),
    performed_by_agent_id   UUID REFERENCES agent_identity(agent_id),
    performed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evidence_hash           CHAR(64),
    evidence_uri            TEXT,
    error_detail            TEXT
);
CREATE INDEX idx_dsr_act_request_time ON dsr_action_log (request_id, performed_at);

-- Consent management (track consent grants and withdrawals)
CREATE TABLE dsr_consent_record (
    consent_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    data_subject_user_id    UUID NOT NULL REFERENCES auth_user(user_id),
    consent_purpose         VARCHAR(500) NOT NULL,
    consent_text            TEXT NOT NULL,
    consent_version         VARCHAR(50) NOT NULL,
    legal_basis             dsr_legal_basis NOT NULL,
    granted                 BOOLEAN NOT NULL,
    granted_at              TIMESTAMPTZ,
    withdrawn_at            TIMESTAMPTZ,
    withdrawal_request_id   UUID REFERENCES dsr_request(request_id),
    grant_method            VARCHAR(100),
    client_ip               INET,
    user_agent              VARCHAR(500),
    evidence_hash           CHAR(64),
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dsr_consent_subject ON dsr_consent_record (data_subject_user_id, consent_purpose) WHERE withdrawn_at IS NULL;
CREATE INDEX idx_dsr_consent_tenant ON dsr_consent_record (tenant_id, recorded_at DESC) WHERE tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE dl_retention_policy       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dl_archival_job           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dl_legal_hold             ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_audit_event            ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_audit_export           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsr_request               ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsr_data_discovery        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsr_action_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsr_consent_record        ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_dl_pol   ON dl_retention_policy  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_dl_job   ON dl_archival_job      USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_dl_hold  ON dl_legal_hold        USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_au_ev    ON au_audit_event       USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_au_exp   ON au_audit_export      USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_dsr_req  ON dsr_request          USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_dsr_disc ON dsr_data_discovery   USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_dsr_act  ON dsr_action_log       USING (EXISTS (SELECT 1 FROM dsr_request r WHERE r.request_id = dsr_action_log.request_id AND (r.tenant_id IS NULL OR r.tenant_id = current_setting('app.current_tenant_id')::UUID)));
CREATE POLICY tenant_iso_dsr_con  ON dsr_consent_record   USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF WAVE 5c — AP-01 Data Lifecycle + Unified Audit + DSR/GDPR
-- Tables: 9 (Data Lifecycle: 3, Audit: 2, DSR: 4)
-- Enums: 9
-- Indexes: 28
-- RLS Policies: 9
-- Partitioned: au_audit_event (monthly by occurred_at)
--
-- ============================================================================
-- FINAL PLATFORM TOTALS
-- ============================================================================
-- V001-V005 Seed agents (A01-A05, A27): 27 tables
-- V006-V009 Metering + Billing: 51 tables
-- V010 Foundation (MT-01/A31): 19 tables
-- V011 FK backfill: 75 constraints
-- V012-V014 Wave 2 (A06, A07, A08, A09, A20, A23, A24): 41 tables
-- V015-V017 Wave 3 (A11-A19, 9 Optimize agents): 40 tables
-- V018-V020 Wave 4 (A22, A25, A26, A28, A29, A30, A32): 37 tables
-- V021-V023 Wave 5 (AP-01 Unified Admin Portal): 33 tables
--
-- GRAND TOTAL: 248 tables across 23 migrations
-- =============================================================================
