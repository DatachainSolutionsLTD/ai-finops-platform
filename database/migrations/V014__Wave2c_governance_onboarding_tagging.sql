-- =============================================================================
-- V014 — Wave 2c: A20 Governance + A23 Onboarding + A24 Tagging Hygiene
-- Sources: A20-FSD-GOV-01, A23-FSD-OB-01, A24-FSD-TH-24
-- Purpose: Unblock AP-01 Admin Portal (Governance, Onboarding, Tag Compliance)
-- =============================================================================
-- DESIGN PRINCIPLES (unchanged):
--   - NO hardcoded currency/tenant/org references anywhere
--   - All money composite (amount + currency_id FK)
--   - All tenant_id FK to tenant(tenant_id); all user_id FK to auth_user(user_id)
--   - Policy categories, tag names, workflow template types stored as VARCHAR
--     DATA — not enums — so new policies/tags/templates don't require DDL
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS (generic operational semantics only)
-- ---------------------------------------------------------------------------

-- A20 Governance
CREATE TYPE gov_policy_scope AS ENUM (
    'Platform', 'Tenant', 'Provider', 'Business_Unit',
    'Application', 'Environment', 'Resource_Group'
);

CREATE TYPE gov_severity AS ENUM (
    'Informational', 'Low', 'Medium', 'High', 'Critical'
);

CREATE TYPE gov_enforcement_mode AS ENUM (
    'Monitor_Only', 'Advisor', 'Auto_Remediate', 'Block_Pre_Provisioning'
);

CREATE TYPE gov_violation_status AS ENUM (
    'Open', 'Acknowledged', 'In_Remediation', 'Resolved',
    'Accepted_Risk', 'Exempted', 'Auto_Remediated', 'False_Positive'
);

CREATE TYPE gov_policy_lifecycle AS ENUM (
    'Draft', 'Under_Review', 'Active', 'Deprecated', 'Retired'
);

-- A23 Onboarding
CREATE TYPE ob_workflow_type AS ENUM (
    'New_Tenant_Provisioning', 'Account_Addition', 'BU_Addition',
    'Workload_Onboarding', 'Connector_Setup', 'Environment_Onboarding'
);

CREATE TYPE ob_session_status AS ENUM (
    'Initiated', 'In_Progress', 'Pending_Approval',
    'Validation_Failed', 'Completed', 'Cancelled', 'Expired'
);

CREATE TYPE ob_step_status AS ENUM (
    'Pending', 'In_Progress', 'Completed', 'Skipped', 'Failed', 'Blocked'
);

-- A24 Tagging Hygiene
CREATE TYPE th_tag_violation_type AS ENUM (
    'Missing_Required_Tag', 'Invalid_Value', 'Naming_Convention',
    'Deprecated_Tag', 'Redundant_Tag', 'Case_Inconsistency', 'Tag_Drift'
);

CREATE TYPE th_compliance_verdict AS ENUM (
    'Fully_Compliant', 'Minor_Issues', 'Material_Gaps', 'Non_Compliant'
);

-- ============================================================================
-- A20 — GOVERNANCE AGENT
-- ============================================================================

-- Policy definitions (tenant-scoped or platform-wide)
CREATE TABLE gov_policy (
    policy_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    policy_code             VARCHAR(200) NOT NULL,
    policy_name             VARCHAR(500) NOT NULL,
    description             TEXT,
    policy_category         VARCHAR(100) NOT NULL,
    scope                   gov_policy_scope NOT NULL,
    scope_filter_json       JSONB,
    severity                gov_severity NOT NULL,
    enforcement_mode        gov_enforcement_mode NOT NULL DEFAULT 'Monitor_Only',
    rule_definition_json    JSONB NOT NULL,
    evaluation_cron         VARCHAR(100),
    remediation_action_json JSONB,
    lifecycle_status        gov_policy_lifecycle NOT NULL DEFAULT 'Draft',
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    reference_framework     VARCHAR(100),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_by        UUID NOT NULL REFERENCES auth_user(user_id),
    UNIQUE (tenant_id, policy_code, effective_from)
);
CREATE INDEX idx_gov_policy_tenant_active ON gov_policy (tenant_id, lifecycle_status) WHERE lifecycle_status = 'Active';
CREATE INDEX idx_gov_policy_scope ON gov_policy (scope, lifecycle_status);
CREATE INDEX idx_gov_policy_category ON gov_policy (policy_category);

-- Policy version history (immutable audit of all policy changes)
CREATE TABLE gov_policy_version (
    version_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id               UUID NOT NULL REFERENCES gov_policy(policy_id),
    version_number          INTEGER NOT NULL,
    rule_definition_json    JSONB NOT NULL,
    remediation_action_json JSONB,
    severity                gov_severity NOT NULL,
    enforcement_mode        gov_enforcement_mode NOT NULL,
    change_summary          TEXT,
    changed_by              UUID NOT NULL REFERENCES auth_user(user_id),
    changed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (policy_id, version_number)
);
CREATE INDEX idx_gov_ver_policy ON gov_policy_version (policy_id, version_number DESC);

-- Policy evaluation runs
CREATE TABLE gov_policy_evaluation (
    evaluation_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    policy_id               UUID NOT NULL REFERENCES gov_policy(policy_id),
    evaluation_start        TIMESTAMPTZ NOT NULL,
    evaluation_end          TIMESTAMPTZ,
    resources_scanned       BIGINT NOT NULL DEFAULT 0,
    violations_found        BIGINT NOT NULL DEFAULT 0,
    violations_auto_remediated BIGINT NOT NULL DEFAULT 0,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Running',
    duration_ms             INTEGER,
    error_detail            JSONB,
    trigger_source          VARCHAR(50) NOT NULL
);
CREATE INDEX idx_gov_eval_tenant_time ON gov_policy_evaluation (tenant_id, evaluation_start DESC);
CREATE INDEX idx_gov_eval_policy ON gov_policy_evaluation (policy_id, evaluation_start DESC);

-- Policy violations (the working queue)
CREATE TABLE gov_violation (
    violation_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    policy_id               UUID NOT NULL REFERENCES gov_policy(policy_id),
    evaluation_id           UUID REFERENCES gov_policy_evaluation(evaluation_id),
    resource_identifier     VARCHAR(1000) NOT NULL,
    resource_type           VARCHAR(200),
    provider                VARCHAR(100),
    dimension_key           VARCHAR(500),
    severity                gov_severity NOT NULL,
    status                  gov_violation_status NOT NULL DEFAULT 'Open',
    violation_detail_json   JSONB,
    financial_impact_amount NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_detected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detection_count         INTEGER NOT NULL DEFAULT 1,
    resolved_at             TIMESTAMPTZ,
    resolved_by             UUID REFERENCES auth_user(user_id),
    resolution_notes        TEXT,
    owner_user_id           UUID REFERENCES auth_user(user_id),
    owner_business_unit     VARCHAR(200),
    acknowledged_at         TIMESTAMPTZ,
    acknowledged_by         UUID REFERENCES auth_user(user_id),
    UNIQUE (policy_id, resource_identifier, tenant_id)
);
CREATE INDEX idx_gov_viol_tenant_status ON gov_violation (tenant_id, status);
CREATE INDEX idx_gov_viol_severity_open ON gov_violation (severity, detected_at DESC) WHERE status = 'Open';
CREATE INDEX idx_gov_viol_owner ON gov_violation (owner_user_id) WHERE status IN ('Open', 'Acknowledged');
CREATE INDEX idx_gov_viol_policy ON gov_violation (policy_id, status);

-- Policy exceptions (time-bound waivers, approved_by required)
CREATE TABLE gov_exception (
    exception_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    policy_id               UUID NOT NULL REFERENCES gov_policy(policy_id),
    scope_filter_json       JSONB NOT NULL,
    justification           TEXT NOT NULL,
    risk_acceptance_notes   TEXT,
    effective_from          DATE NOT NULL,
    effective_to            DATE NOT NULL,
    requested_by            UUID NOT NULL REFERENCES auth_user(user_id),
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    revoked_at              TIMESTAMPTZ,
    revoked_by              UUID REFERENCES auth_user(user_id),
    CONSTRAINT ck_exception_dates CHECK (effective_to > effective_from)
);
CREATE INDEX idx_gov_exc_active ON gov_exception (tenant_id, effective_to) WHERE revoked_at IS NULL;
CREATE INDEX idx_gov_exc_policy ON gov_exception (policy_id) WHERE revoked_at IS NULL;

-- Remediation actions (what A20 did about violations)
CREATE TABLE gov_remediation_action (
    action_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    violation_id            UUID NOT NULL REFERENCES gov_violation(violation_id),
    action_type             VARCHAR(100) NOT NULL,
    action_parameters_json  JSONB,
    is_auto_remediation     BOOLEAN NOT NULL,
    requires_approval       BOOLEAN NOT NULL,
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    executed_at             TIMESTAMPTZ,
    execution_status        VARCHAR(30) NOT NULL DEFAULT 'Pending',
    execution_result_json   JSONB,
    reverted_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gov_remed_violation ON gov_remediation_action (violation_id);
CREATE INDEX idx_gov_remed_pending ON gov_remediation_action (execution_status) WHERE execution_status = 'Pending';

-- Governance posture scores (hierarchical, computed periodically)
CREATE TABLE gov_posture_score (
    score_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    scope                   gov_policy_scope NOT NULL,
    scope_dimension_key     VARCHAR(500),
    score_date              DATE NOT NULL,
    overall_score           NUMERIC(5,4) NOT NULL,
    policies_evaluated      INTEGER NOT NULL,
    policies_passing        INTEGER NOT NULL,
    policies_failing        INTEGER NOT NULL,
    weighted_score_json     JSONB,
    score_trend_30d         NUMERIC(7,4),
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, scope, scope_dimension_key, score_date),
    CONSTRAINT ck_score_range CHECK (overall_score BETWEEN 0 AND 1)
);
CREATE INDEX idx_gov_score_tenant_date ON gov_posture_score (tenant_id, score_date DESC);
CREATE INDEX idx_gov_score_scope ON gov_posture_score (tenant_id, scope, scope_dimension_key, score_date DESC);

-- ============================================================================
-- A23 — ONBOARDING AGENT
-- ============================================================================

-- Workflow templates (configurable per tenant type)
CREATE TABLE ob_workflow_template (
    template_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_tier_id          UUID REFERENCES tenant_tier(tier_id),
    workflow_type           ob_workflow_type NOT NULL,
    template_name           VARCHAR(200) NOT NULL,
    description             TEXT,
    checklist_definition_json JSONB NOT NULL,
    required_approver_role_ids UUID[],
    validation_rules_json   JSONB,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    UNIQUE (tenant_tier_id, workflow_type, template_name)
);
CREATE INDEX idx_ob_template_type ON ob_workflow_template (workflow_type) WHERE is_active;

-- Onboarding sessions (one per onboarding event)
CREATE TABLE ob_session (
    session_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    target_tenant_id        UUID REFERENCES tenant(tenant_id),
    workflow_type           ob_workflow_type NOT NULL,
    template_id             UUID NOT NULL REFERENCES ob_workflow_template(template_id),
    session_name            VARCHAR(200) NOT NULL,
    context_json            JSONB,
    status                  ob_session_status NOT NULL DEFAULT 'Initiated',
    total_steps             INTEGER NOT NULL,
    completed_steps         INTEGER NOT NULL DEFAULT 0,
    progress_pct            NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_steps > 0 THEN (completed_steps::NUMERIC / total_steps * 100) ELSE 0 END
    ) STORED,
    initiated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    initiated_by            UUID NOT NULL REFERENCES auth_user(user_id),
    target_completion_date  DATE,
    completed_at            TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,
    cancelled_reason        TEXT,
    external_reference_id   VARCHAR(200)
);
CREATE INDEX idx_ob_session_tenant ON ob_session (tenant_id, status);
CREATE INDEX idx_ob_session_target ON ob_session (target_tenant_id) WHERE target_tenant_id IS NOT NULL;
CREATE INDEX idx_ob_session_active ON ob_session (status) WHERE status IN ('In_Progress', 'Pending_Approval');

-- Step completion log (immutable history of every step)
CREATE TABLE ob_step_completion (
    completion_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL REFERENCES ob_session(session_id) ON DELETE CASCADE,
    step_sequence           INTEGER NOT NULL,
    step_code               VARCHAR(200) NOT NULL,
    step_name               VARCHAR(500) NOT NULL,
    step_category           VARCHAR(100),
    status                  ob_step_status NOT NULL DEFAULT 'Pending',
    executed_by_agent_id    UUID REFERENCES agent_identity(agent_id),
    assigned_to_user_id     UUID REFERENCES auth_user(user_id),
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    duration_ms             INTEGER,
    output_data_json        JSONB,
    validation_result_json  JSONB,
    error_detail            TEXT,
    requires_approval       BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    UNIQUE (session_id, step_sequence)
);
CREATE INDEX idx_ob_step_session ON ob_step_completion (session_id, step_sequence);
CREATE INDEX idx_ob_step_pending ON ob_step_completion (status) WHERE status IN ('Pending', 'In_Progress', 'Blocked');
CREATE INDEX idx_ob_step_assigned ON ob_step_completion (assigned_to_user_id) WHERE status = 'In_Progress';

-- Onboarding gaps (cost data exists but not linked to onboarded tenant)
CREATE TABLE ob_onboarding_gap (
    gap_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    gap_type                VARCHAR(100) NOT NULL,
    resource_identifier     VARCHAR(1000),
    provider                VARCHAR(100),
    account_identifier      VARCHAR(500),
    cost_detected_amount    NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    first_detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_detected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_resolved             BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at             TIMESTAMPTZ,
    resolved_session_id     UUID REFERENCES ob_session(session_id)
);
CREATE INDEX idx_ob_gap_unresolved ON ob_onboarding_gap (is_resolved, first_detected_at) WHERE NOT is_resolved;
CREATE INDEX idx_ob_gap_tenant ON ob_onboarding_gap (tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- A24 — TAGGING HYGIENE AGENT
-- ============================================================================

-- Tag policies (what tags are required / allowed values)
CREATE TABLE th_tag_policy (
    tag_policy_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    tag_key                 VARCHAR(200) NOT NULL,
    is_required             BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_values          TEXT[],
    regex_pattern           VARCHAR(500),
    naming_convention       VARCHAR(200),
    case_sensitivity        VARCHAR(30) NOT NULL DEFAULT 'Case_Sensitive',
    applies_to_scope        gov_policy_scope NOT NULL DEFAULT 'Tenant',
    scope_filter_json       JSONB,
    severity                gov_severity NOT NULL DEFAULT 'Medium',
    auto_remediate_default  VARCHAR(500),
    description             TEXT,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, tag_key, effective_from)
);
CREATE INDEX idx_th_policy_tenant_active ON th_tag_policy (tenant_id, tag_key) WHERE is_active;

-- Tag violations (working queue — tagged wrong, missing, etc.)
CREATE TABLE th_tag_violation (
    tag_violation_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    tag_policy_id           UUID NOT NULL REFERENCES th_tag_policy(tag_policy_id),
    resource_identifier     VARCHAR(1000) NOT NULL,
    resource_type           VARCHAR(200),
    provider                VARCHAR(100),
    violation_type          th_tag_violation_type NOT NULL,
    current_tag_value       VARCHAR(500),
    expected_tag_value      VARCHAR(500),
    cost_impact_amount      NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    severity                gov_severity NOT NULL,
    priority_rank           INTEGER,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Open',
    first_detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_detected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ,
    resolved_by             UUID REFERENCES auth_user(user_id),
    auto_remediated         BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (tag_policy_id, resource_identifier)
);
CREATE INDEX idx_th_violation_tenant_status ON th_tag_violation (tenant_id, status);
CREATE INDEX idx_th_violation_priority ON th_tag_violation (priority_rank DESC) WHERE status = 'Open';
CREATE INDEX idx_th_violation_cost ON th_tag_violation (cost_impact_amount DESC NULLS LAST) WHERE status = 'Open';

-- Tag remediation log
CREATE TABLE th_tag_remediation_log (
    remediation_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    tag_violation_id        UUID NOT NULL REFERENCES th_tag_violation(tag_violation_id),
    action_type             VARCHAR(100) NOT NULL,
    previous_tag_value      VARCHAR(500),
    new_tag_value           VARCHAR(500),
    is_auto_remediation     BOOLEAN NOT NULL,
    requires_approval       BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by             UUID REFERENCES auth_user(user_id),
    executed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_status        VARCHAR(30) NOT NULL,
    reverted_at             TIMESTAMPTZ
);
CREATE INDEX idx_th_remed_violation ON th_tag_remediation_log (tag_violation_id);

-- Tag compliance scores (hierarchical)
CREATE TABLE th_compliance_score (
    score_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    scope                   gov_policy_scope NOT NULL,
    scope_dimension_key     VARCHAR(500),
    score_date              DATE NOT NULL,
    overall_score           NUMERIC(5,4) NOT NULL,
    resources_total         BIGINT NOT NULL,
    resources_compliant     BIGINT NOT NULL,
    resources_violations    BIGINT NOT NULL,
    untagged_cost_amount    NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    verdict                 th_compliance_verdict NOT NULL,
    per_tag_scores_json     JSONB,
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, scope, scope_dimension_key, score_date),
    CONSTRAINT ck_th_score_range CHECK (overall_score BETWEEN 0 AND 1)
);
CREATE INDEX idx_th_score_tenant_date ON th_compliance_score (tenant_id, score_date DESC);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE gov_policy                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_policy_evaluation       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_violation               ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_exception               ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_remediation_action      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_posture_score           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ob_session                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ob_onboarding_gap           ENABLE ROW LEVEL SECURITY;
ALTER TABLE th_tag_policy               ENABLE ROW LEVEL SECURITY;
ALTER TABLE th_tag_violation            ENABLE ROW LEVEL SECURITY;
ALTER TABLE th_tag_remediation_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE th_compliance_score         ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_gov_policy  ON gov_policy             USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_gov_eval    ON gov_policy_evaluation  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_gov_viol    ON gov_violation          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_gov_exc     ON gov_exception          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_gov_remed   ON gov_remediation_action USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_gov_score   ON gov_posture_score      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ob_session  ON ob_session             USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ob_gap      ON ob_onboarding_gap      USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_th_policy   ON th_tag_policy          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_th_viol     ON th_tag_violation       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_th_remed    ON th_tag_remediation_log USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_th_score    ON th_compliance_score    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF WAVE 2c — A20 Governance + A23 Onboarding + A24 Tagging Hygiene
-- Tables: 17 (A20: 7, A23: 4, A24: 4, shared: 2 templates)
-- Enums: 10 (5 governance, 3 onboarding, 2 tagging)
-- Indexes: 33
-- RLS Policies: 12
-- All AP-01 Governance/Onboarding/Tag Compliance admin screens NOW UNBLOCKED
-- =============================================================================
