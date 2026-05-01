-- =============================================================================
-- V018 — Wave 4a: A22 Chargeback + A25 Education
-- Sources: A22-FSD-CB-01, A25-FSD-EE-25
-- =============================================================================
-- DESIGN PRINCIPLES (unchanged):
--   - NO hardcoded currency/tenant/org references
--   - All monetary columns composite (amount + currency_id FK)
--   - All tenant_id FK to tenant(tenant_id); all user_id FK to auth_user(user_id)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- A22 Chargeback
CREATE TYPE cb_statement_type AS ENUM (
    'Chargeback_Binding', 'Showback_Advisory', 'Hybrid_Display'
);

CREATE TYPE cb_billing_cycle AS ENUM (
    'Monthly', 'Bi_Monthly', 'Quarterly', 'Semi_Annual', 'Annual'
);

CREATE TYPE cb_statement_status AS ENUM (
    'Draft', 'Pending_Review', 'Approved', 'Distributed',
    'Viewed', 'Disputed', 'Adjusted', 'Finalized', 'Voided'
);

CREATE TYPE cb_format_type AS ENUM (
    'PDF', 'CSV', 'XLSX', 'ERP_Journal_Entry', 'API_Webhook', 'Email_HTML'
);

CREATE TYPE cb_dispute_status AS ENUM (
    'Submitted', 'Under_Investigation', 'Evidence_Requested',
    'Resolved_Upheld', 'Resolved_Adjusted', 'Withdrawn', 'Escalated'
);

CREATE TYPE cb_adjustment_type AS ENUM (
    'Credit', 'Debit', 'Reclassification', 'Write_Off', 'True_Up', 'True_Down'
);

-- A25 Education
CREATE TYPE ee_content_type AS ENUM (
    'Video', 'Article', 'Interactive_Tutorial', 'Walkthrough',
    'Workflow_Guide', 'Certification_Module', 'Reference_Doc', 'Quick_Tip'
);

CREATE TYPE ee_content_status AS ENUM (
    'Draft', 'Under_Review', 'Published', 'Deprecated', 'Archived'
);

CREATE TYPE ee_enrollment_status AS ENUM (
    'Not_Started', 'In_Progress', 'Completed', 'Abandoned', 'Expired'
);

CREATE TYPE ee_proficiency_level AS ENUM (
    'Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert'
);

-- ============================================================================
-- A22 — CHARGEBACK AGENT
-- ============================================================================

-- Chargeback policies (per tenant, define distribution rules)
CREATE TABLE cb_chargeback_policy (
    policy_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    policy_name             VARCHAR(200) NOT NULL,
    statement_type          cb_statement_type NOT NULL,
    billing_cycle           cb_billing_cycle NOT NULL,
    scope_filter_json       JSONB,
    distribution_channels   cb_format_type[] NOT NULL,
    auto_approval_threshold NUMERIC(18,4),
    requires_approval_above NUMERIC(18,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    erp_integration_json    JSONB,
    dispute_window_days     INTEGER NOT NULL DEFAULT 30,
    statement_template_uri  TEXT,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id)
);
CREATE INDEX idx_cb_policy_tenant_active ON cb_chargeback_policy (tenant_id) WHERE is_active;

-- Chargeback statements (per BU/project/cost center per billing period)
CREATE TABLE cb_statement (
    statement_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_number        VARCHAR(50) NOT NULL UNIQUE,
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    policy_id               UUID NOT NULL REFERENCES cb_chargeback_policy(policy_id),
    statement_type          cb_statement_type NOT NULL,
    target_dimension        VARCHAR(100) NOT NULL,
    target_dimension_key    VARCHAR(500) NOT NULL,
    target_display_name     VARCHAR(500),
    owner_user_id           UUID REFERENCES auth_user(user_id),
    billing_period_start    DATE NOT NULL,
    billing_period_end      DATE NOT NULL,
    subtotal_amount         NUMERIC(18,4) NOT NULL,
    adjustment_amount       NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_amount            NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    status                  cb_statement_status NOT NULL DEFAULT 'Draft',
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at             TIMESTAMPTZ,
    approved_by             UUID REFERENCES auth_user(user_id),
    distributed_at          TIMESTAMPTZ,
    first_viewed_at         TIMESTAMPTZ,
    finalized_at            TIMESTAMPTZ,
    pdf_storage_uri         TEXT,
    erp_journal_reference   VARCHAR(200),
    external_reference_id   VARCHAR(200)
);
CREATE INDEX idx_cb_stmt_tenant_period ON cb_statement (tenant_id, billing_period_start DESC);
CREATE INDEX idx_cb_stmt_target ON cb_statement (tenant_id, target_dimension, target_dimension_key);
CREATE INDEX idx_cb_stmt_status ON cb_statement (status) WHERE status IN ('Draft', 'Pending_Review', 'Disputed');
CREATE INDEX idx_cb_stmt_owner ON cb_statement (owner_user_id) WHERE owner_user_id IS NOT NULL;

-- Statement line items
CREATE TABLE cb_statement_line_item (
    line_item_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id            UUID NOT NULL REFERENCES cb_statement(statement_id) ON DELETE CASCADE,
    line_sequence           INTEGER NOT NULL,
    cost_category           VARCHAR(200) NOT NULL,
    description             VARCHAR(1000),
    quantity                NUMERIC(18,6),
    unit_of_measure         VARCHAR(50),
    unit_rate_amount        NUMERIC(18,6),
    gross_amount            NUMERIC(18,4) NOT NULL,
    discount_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_amount              NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    source_allocation_ids   UUID[],
    source_cdr_ids          UUID[],
    UNIQUE (statement_id, line_sequence)
);
CREATE INDEX idx_cb_line_statement ON cb_statement_line_item (statement_id);

-- Distribution log (who got the statement, via what channel)
CREATE TABLE cb_distribution_log (
    distribution_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id            UUID NOT NULL REFERENCES cb_statement(statement_id),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    channel                 cb_format_type NOT NULL,
    recipient_user_id       UUID REFERENCES auth_user(user_id),
    recipient_email         VARCHAR(320),
    recipient_system        VARCHAR(200),
    delivery_status         VARCHAR(30) NOT NULL,
    delivered_at            TIMESTAMPTZ,
    opened_at               TIMESTAMPTZ,
    error_detail            TEXT,
    attempted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cb_dist_statement ON cb_distribution_log (statement_id);
CREATE INDEX idx_cb_dist_tenant_time ON cb_distribution_log (tenant_id, attempted_at DESC);

-- Dispute tracking
CREATE TABLE cb_dispute (
    dispute_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id            UUID NOT NULL REFERENCES cb_statement(statement_id),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    disputed_amount         NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    dispute_reason          TEXT NOT NULL,
    dispute_category        VARCHAR(100),
    status                  cb_dispute_status NOT NULL DEFAULT 'Submitted',
    submitted_by            UUID NOT NULL REFERENCES auth_user(user_id),
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_to_user_id     UUID REFERENCES auth_user(user_id),
    evidence_json           JSONB,
    resolution_notes        TEXT,
    resolved_by             UUID REFERENCES auth_user(user_id),
    resolved_at             TIMESTAMPTZ,
    resulting_adjustment_id UUID
);
CREATE INDEX idx_cb_disp_statement ON cb_dispute (statement_id);
CREATE INDEX idx_cb_disp_tenant_status ON cb_dispute (tenant_id, status);
CREATE INDEX idx_cb_disp_assigned ON cb_dispute (assigned_to_user_id) WHERE status != 'Withdrawn' AND resolved_at IS NULL;

-- Adjustments (credits, debits, reclassifications)
CREATE TABLE cb_adjustment (
    adjustment_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    statement_id            UUID NOT NULL REFERENCES cb_statement(statement_id),
    dispute_id              UUID REFERENCES cb_dispute(dispute_id),
    adjustment_type         cb_adjustment_type NOT NULL,
    adjustment_amount       NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    justification           TEXT NOT NULL,
    requires_approval       BOOLEAN NOT NULL DEFAULT TRUE,
    requested_by            UUID NOT NULL REFERENCES auth_user(user_id),
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    applied_at              TIMESTAMPTZ,
    resulting_statement_id  UUID REFERENCES cb_statement(statement_id)
);
CREATE INDEX idx_cb_adj_statement ON cb_adjustment (statement_id);
CREATE INDEX idx_cb_adj_tenant_time ON cb_adjustment (tenant_id, requested_at DESC);

-- ============================================================================
-- A25 — EDUCATION AGENT
-- ============================================================================

-- Content library (platform-wide catalog, tenant may override priorities)
CREATE TABLE ee_content (
    content_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_code            VARCHAR(200) NOT NULL UNIQUE,
    title                   VARCHAR(500) NOT NULL,
    description             TEXT,
    content_type            ee_content_type NOT NULL,
    target_personas         TEXT[],
    required_proficiency    ee_proficiency_level,
    category                VARCHAR(100),
    tags                    TEXT[],
    storage_uri             TEXT,
    duration_minutes        INTEGER,
    locale_code             VARCHAR(20) NOT NULL DEFAULT 'en-US',
    version                 VARCHAR(50) NOT NULL,
    status                  ee_content_status NOT NULL DEFAULT 'Draft',
    published_at            TIMESTAMPTZ,
    deprecated_at           TIMESTAMPTZ,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id)
);
CREATE INDEX idx_ee_content_status ON ee_content (status) WHERE status = 'Published';
CREATE INDEX idx_ee_content_type ON ee_content (content_type, status);
CREATE INDEX idx_ee_content_personas ON ee_content USING GIN (target_personas);

-- Learning paths (ordered curricula)
CREATE TABLE ee_learning_path (
    path_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_code               VARCHAR(200) NOT NULL UNIQUE,
    path_name               VARCHAR(500) NOT NULL,
    description             TEXT,
    target_personas         TEXT[],
    target_proficiency      ee_proficiency_level,
    estimated_duration_hrs  NUMERIC(6,2),
    content_sequence        UUID[] NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id)
);
CREATE INDEX idx_ee_path_active ON ee_learning_path (is_active);

-- User proficiency assessment (per user per capability area)
CREATE TABLE ee_user_proficiency (
    proficiency_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    user_id                 UUID NOT NULL REFERENCES auth_user(user_id),
    capability_area         VARCHAR(200) NOT NULL,
    current_level           ee_proficiency_level NOT NULL,
    assessment_score        NUMERIC(5,4),
    last_assessed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_assessment_due     DATE,
    UNIQUE (tenant_id, user_id, capability_area)
);
CREATE INDEX idx_ee_prof_user ON ee_user_proficiency (user_id);

-- User enrollments (content or learning path)
CREATE TABLE ee_enrollment (
    enrollment_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    user_id                 UUID NOT NULL REFERENCES auth_user(user_id),
    content_id              UUID REFERENCES ee_content(content_id),
    path_id                 UUID REFERENCES ee_learning_path(path_id),
    enrollment_source       VARCHAR(50) NOT NULL,
    assigned_by             UUID REFERENCES auth_user(user_id),
    status                  ee_enrollment_status NOT NULL DEFAULT 'Not_Started',
    progress_pct            NUMERIC(5,2) NOT NULL DEFAULT 0,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    last_activity_at        TIMESTAMPTZ,
    due_date                DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_enrollment_target CHECK (
        (content_id IS NOT NULL AND path_id IS NULL) OR
        (content_id IS NULL AND path_id IS NOT NULL)
    )
);
CREATE INDEX idx_ee_enr_user_status ON ee_enrollment (user_id, status);
CREATE INDEX idx_ee_enr_tenant_due ON ee_enrollment (tenant_id, due_date) WHERE status IN ('Not_Started', 'In_Progress');

-- Activity events (views, completions, feedback)
CREATE TABLE ee_activity_event (
    event_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    user_id                 UUID NOT NULL REFERENCES auth_user(user_id),
    enrollment_id           UUID REFERENCES ee_enrollment(enrollment_id),
    content_id              UUID REFERENCES ee_content(content_id),
    event_type              VARCHAR(100) NOT NULL,
    event_payload_json      JSONB,
    rating                  SMALLINT,
    feedback_text           TEXT,
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_ee_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
);
CREATE INDEX idx_ee_act_user_time ON ee_activity_event (user_id, occurred_at DESC);
CREATE INDEX idx_ee_act_tenant_type ON ee_activity_event (tenant_id, event_type, occurred_at DESC);

-- Knowledge gap detection (what users need but don't know)
CREATE TABLE ee_knowledge_gap (
    gap_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    user_id                 UUID NOT NULL REFERENCES auth_user(user_id),
    capability_area         VARCHAR(200) NOT NULL,
    gap_description         TEXT,
    detected_from           VARCHAR(100),
    recommended_content_ids UUID[],
    priority                opt_priority_tier NOT NULL,
    is_addressed            BOOLEAN NOT NULL DEFAULT FALSE,
    addressed_at            TIMESTAMPTZ,
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ee_gap_user_unaddr ON ee_knowledge_gap (user_id) WHERE NOT is_addressed;
CREATE INDEX idx_ee_gap_tenant_priority ON ee_knowledge_gap (tenant_id, priority) WHERE NOT is_addressed;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE cb_chargeback_policy   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_statement           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_distribution_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_dispute             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_adjustment          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ee_user_proficiency    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ee_enrollment          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ee_activity_event      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ee_knowledge_gap       ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_cb_pol  ON cb_chargeback_policy   USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cb_stmt ON cb_statement           USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cb_dist ON cb_distribution_log    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cb_disp ON cb_dispute             USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cb_adj  ON cb_adjustment          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ee_prof ON ee_user_proficiency    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ee_enr  ON ee_enrollment          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ee_act  ON ee_activity_event      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ee_gap  ON ee_knowledge_gap       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Content library and learning paths are platform-wide (readable to all, writes restricted by app role)

-- =============================================================================
-- END OF WAVE 4a — A22 Chargeback + A25 Education
-- Tables: 13 (A22: 6, A25: 7)
-- Enums: 10 (6 chargeback, 4 education — reuses opt_priority_tier)
-- Indexes: 25
-- RLS Policies: 9
-- =============================================================================
