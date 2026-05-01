-- =============================================================================
-- V022 — Wave 5b: AP-01 Feature Flags + Support Cases + Platform Settings
-- Source: FSD-AP-01 §Feature Flags, §Support, §Settings (AP-SETTINGS)
-- =============================================================================
-- Purpose: Operational administration layer.
-- - Feature Flags: gradual rollout, kill switches, A/B experiments
-- - Support Cases: unified ticket hub (AP-01 flags as CRITICAL GAP)
-- - Platform Settings: hierarchical config (Platform Defaults -> Tenant Overrides)
--   replacing hardcoded agent config and deployment-script-implicit settings
--
-- Reuses: gov_severity, opt_priority_tier
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- Feature Flags
CREATE TYPE ff_flag_type AS ENUM (
    'Boolean_Toggle', 'Percentage_Rollout', 'Tenant_Allowlist',
    'User_Allowlist', 'Environment_Scoped', 'Multi_Variant', 'Kill_Switch'
);

CREATE TYPE ff_flag_status AS ENUM (
    'Draft', 'Active', 'Paused', 'Archived', 'Deprecated'
);

CREATE TYPE ff_targeting_rule_operator AS ENUM (
    'Equals', 'Not_Equals', 'In', 'Not_In',
    'Contains', 'Greater_Than', 'Less_Than', 'Regex_Match', 'Percentage_Hash'
);

-- Support Cases
CREATE TYPE sc_case_category AS ENUM (
    'Technical_Issue', 'Billing_Question', 'Feature_Request',
    'Bug_Report', 'Access_Request', 'Documentation_Issue',
    'Performance_Concern', 'Data_Correction', 'Integration_Help', 'Other'
);

CREATE TYPE sc_case_status AS ENUM (
    'Open', 'Pending_Customer', 'In_Progress', 'Waiting_On_Engineering',
    'Resolved', 'Closed', 'Reopened', 'Cancelled'
);

CREATE TYPE sc_resolution_type AS ENUM (
    'Fixed', 'Workaround_Provided', 'Not_A_Bug', 'Duplicate',
    'Won_T_Fix', 'Feature_Request_Accepted', 'Cannot_Reproduce',
    'Withdrawn', 'Escalated_External'
);

-- Platform Settings
CREATE TYPE ps_setting_scope AS ENUM (
    'Platform_Default', 'Tenant_Override', 'User_Override', 'Environment_Override'
);

CREATE TYPE ps_setting_data_type AS ENUM (
    'String', 'Integer', 'Decimal', 'Boolean',
    'JSON_Object', 'Array', 'Duration', 'Date', 'Timestamp', 'UUID_Reference'
);

CREATE TYPE ps_setting_category AS ENUM (
    'Authentication', 'Authorization', 'Notification_Defaults',
    'Data_Retention', 'Backup_Schedule', 'Currency_Conversion',
    'SLA_Definition', 'Rate_Limiting', 'Security', 'UI_Customization',
    'Integration_Defaults', 'Workflow_Defaults', 'Feature_Gating', 'Other'
);

-- ============================================================================
-- FEATURE FLAGS
-- ============================================================================

-- Flag definitions
CREATE TABLE ff_flag (
    flag_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key                VARCHAR(200) NOT NULL UNIQUE,
    display_name            VARCHAR(500) NOT NULL,
    description             TEXT,
    flag_type               ff_flag_type NOT NULL,
    default_value           JSONB NOT NULL,
    possible_values         JSONB,
    owner_user_id           UUID REFERENCES auth_user(user_id),
    owning_team             VARCHAR(200),
    tags                    TEXT[],
    is_permanent            BOOLEAN NOT NULL DEFAULT FALSE,
    is_kill_switch          BOOLEAN NOT NULL DEFAULT FALSE,
    status                  ff_flag_status NOT NULL DEFAULT 'Draft',
    deprecation_date        DATE,
    jira_reference          VARCHAR(100),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_by        UUID NOT NULL REFERENCES auth_user(user_id)
);
CREATE INDEX idx_ff_flag_status ON ff_flag (status) WHERE status = 'Active';
CREATE INDEX idx_ff_flag_owner ON ff_flag (owner_user_id) WHERE owner_user_id IS NOT NULL;

-- Targeting rules (who gets which variant)
CREATE TABLE ff_targeting_rule (
    rule_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id                 UUID NOT NULL REFERENCES ff_flag(flag_id) ON DELETE CASCADE,
    rule_sequence           INTEGER NOT NULL,
    description             VARCHAR(500),
    target_attribute        VARCHAR(100) NOT NULL,
    operator                ff_targeting_rule_operator NOT NULL,
    target_values           JSONB NOT NULL,
    variant_value           JSONB NOT NULL,
    rollout_percentage      NUMERIC(5,2),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (flag_id, rule_sequence),
    CONSTRAINT ck_ff_rollout_range CHECK (rollout_percentage IS NULL OR rollout_percentage BETWEEN 0 AND 100)
);
CREATE INDEX idx_ff_rule_flag ON ff_targeting_rule (flag_id, rule_sequence) WHERE is_active;

-- Per-tenant flag assignments (evaluated/cached state for fast lookup)
CREATE TABLE ff_tenant_assignment (
    assignment_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id                 UUID NOT NULL REFERENCES ff_flag(flag_id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    resolved_value          JSONB NOT NULL,
    resolved_via_rule_id    UUID REFERENCES ff_targeting_rule(rule_id),
    is_override             BOOLEAN NOT NULL DEFAULT FALSE,
    override_reason         TEXT,
    override_by             UUID REFERENCES auth_user(user_id),
    resolved_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ,
    UNIQUE (flag_id, tenant_id)
);
CREATE INDEX idx_ff_assign_tenant ON ff_tenant_assignment (tenant_id);
CREATE INDEX idx_ff_assign_expiring ON ff_tenant_assignment (expires_at) WHERE expires_at IS NOT NULL;

-- Evaluation audit log (every flag check by agents — sampled, not exhaustive)
CREATE TABLE ff_evaluation_log (
    evaluation_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id                 UUID NOT NULL,
    flag_key                VARCHAR(200) NOT NULL,
    tenant_id               UUID,
    user_id                 UUID,
    agent_id                UUID,
    evaluated_value         JSONB NOT NULL,
    evaluation_context_json JSONB,
    matched_rule_id         UUID,
    evaluated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ff_eval_flag_time ON ff_evaluation_log (flag_id, evaluated_at DESC);
CREATE INDEX idx_ff_eval_tenant ON ff_evaluation_log (tenant_id, evaluated_at DESC) WHERE tenant_id IS NOT NULL;

-- Flag change history (audit of flag definition and rule changes)
CREATE TABLE ff_change_history (
    change_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id                 UUID NOT NULL REFERENCES ff_flag(flag_id),
    change_type             VARCHAR(50) NOT NULL,
    previous_state_json     JSONB,
    new_state_json          JSONB,
    change_reason           TEXT,
    changed_by              UUID NOT NULL REFERENCES auth_user(user_id),
    changed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ff_hist_flag_time ON ff_change_history (flag_id, changed_at DESC);

-- ============================================================================
-- SUPPORT CASES
-- ============================================================================

CREATE TABLE sc_case (
    case_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number             VARCHAR(30) NOT NULL UNIQUE,
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    submitted_by            UUID NOT NULL REFERENCES auth_user(user_id),
    on_behalf_of_user_id    UUID REFERENCES auth_user(user_id),
    category                sc_case_category NOT NULL,
    severity                gov_severity NOT NULL,
    priority                opt_priority_tier NOT NULL,
    subject                 VARCHAR(500) NOT NULL,
    description             TEXT NOT NULL,
    affected_agent_ids      UUID[],
    affected_entity_refs    JSONB,
    environment             VARCHAR(50),
    reproduction_steps      TEXT,
    expected_behavior       TEXT,
    actual_behavior         TEXT,
    status                  sc_case_status NOT NULL DEFAULT 'Open',
    assigned_to_user_id     UUID REFERENCES auth_user(user_id),
    assigned_team           VARCHAR(200),
    sla_deadline            TIMESTAMPTZ,
    first_response_at       TIMESTAMPTZ,
    resolved_at             TIMESTAMPTZ,
    resolution_type         sc_resolution_type,
    resolution_notes        TEXT,
    closed_at               TIMESTAMPTZ,
    customer_satisfaction_rating SMALLINT,
    external_ticket_ref     VARCHAR(500),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_csat CHECK (customer_satisfaction_rating IS NULL OR customer_satisfaction_rating BETWEEN 1 AND 5)
);
CREATE INDEX idx_sc_case_tenant_status ON sc_case (tenant_id, status);
CREATE INDEX idx_sc_case_assigned ON sc_case (assigned_to_user_id) WHERE status NOT IN ('Resolved', 'Closed', 'Cancelled');
CREATE INDEX idx_sc_case_sla ON sc_case (sla_deadline) WHERE status NOT IN ('Resolved', 'Closed', 'Cancelled');
CREATE INDEX idx_sc_case_priority ON sc_case (priority, created_date) WHERE status = 'Open';
CREATE INDEX idx_sc_case_submitter ON sc_case (submitted_by);

-- Case messages (conversation thread)
CREATE TABLE sc_case_message (
    message_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id                 UUID NOT NULL REFERENCES sc_case(case_id) ON DELETE CASCADE,
    sender_user_id          UUID REFERENCES auth_user(user_id),
    sender_type             VARCHAR(30) NOT NULL,
    message_body            TEXT NOT NULL,
    is_internal_note        BOOLEAN NOT NULL DEFAULT FALSE,
    attachments_json        JSONB,
    sent_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sc_msg_case_time ON sc_case_message (case_id, sent_at);
CREATE INDEX idx_sc_msg_case_public ON sc_case_message (case_id, sent_at) WHERE NOT is_internal_note;

-- Case status history (every state transition)
CREATE TABLE sc_case_status_history (
    history_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id                 UUID NOT NULL REFERENCES sc_case(case_id) ON DELETE CASCADE,
    previous_status         sc_case_status,
    new_status              sc_case_status NOT NULL,
    changed_by              UUID REFERENCES auth_user(user_id),
    change_reason           TEXT,
    changed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sc_hist_case_time ON sc_case_status_history (case_id, changed_at);

-- ============================================================================
-- PLATFORM SETTINGS (hierarchical: Platform Default -> Tenant Override)
-- ============================================================================

-- Setting definitions (the catalog of what can be configured)
CREATE TABLE ps_setting_definition (
    definition_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key             VARCHAR(200) NOT NULL UNIQUE,
    display_name            VARCHAR(500) NOT NULL,
    description             TEXT,
    category                ps_setting_category NOT NULL,
    data_type               ps_setting_data_type NOT NULL,
    default_value           JSONB,
    allowed_values_json     JSONB,
    validation_rules_json   JSONB,
    is_tenant_overridable   BOOLEAN NOT NULL DEFAULT TRUE,
    is_user_overridable     BOOLEAN NOT NULL DEFAULT FALSE,
    requires_restart        BOOLEAN NOT NULL DEFAULT FALSE,
    requires_approval       BOOLEAN NOT NULL DEFAULT FALSE,
    is_sensitive            BOOLEAN NOT NULL DEFAULT FALSE,
    documentation_url       TEXT,
    ui_component_hint       VARCHAR(100),
    display_order           INTEGER,
    is_deprecated           BOOLEAN NOT NULL DEFAULT FALSE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ps_def_category ON ps_setting_definition (category, display_order) WHERE NOT is_deprecated;

-- Setting values at each scope level
CREATE TABLE ps_setting_value (
    value_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id           UUID NOT NULL REFERENCES ps_setting_definition(definition_id),
    scope                   ps_setting_scope NOT NULL,
    tenant_id               UUID REFERENCES tenant(tenant_id),
    user_id                 UUID REFERENCES auth_user(user_id),
    environment             VARCHAR(50),
    setting_value           JSONB NOT NULL,
    version                 INTEGER NOT NULL DEFAULT 1,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to            TIMESTAMPTZ,
    approval_status         VARCHAR(30) NOT NULL DEFAULT 'Active',
    approved_by             UUID REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    CONSTRAINT ck_ps_scope_target CHECK (
        (scope = 'Platform_Default' AND tenant_id IS NULL AND user_id IS NULL) OR
        (scope = 'Tenant_Override' AND tenant_id IS NOT NULL AND user_id IS NULL) OR
        (scope = 'User_Override' AND user_id IS NOT NULL) OR
        (scope = 'Environment_Override' AND environment IS NOT NULL)
    )
);
CREATE INDEX idx_ps_val_def_scope ON ps_setting_value (definition_id, scope) WHERE is_active;
CREATE INDEX idx_ps_val_tenant ON ps_setting_value (tenant_id, definition_id) WHERE tenant_id IS NOT NULL AND is_active;
CREATE INDEX idx_ps_val_user ON ps_setting_value (user_id, definition_id) WHERE user_id IS NOT NULL AND is_active;

-- Setting change history (full version audit — FSD AP-SET-020)
CREATE TABLE ps_setting_change_history (
    change_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id           UUID NOT NULL REFERENCES ps_setting_definition(definition_id),
    scope                   ps_setting_scope NOT NULL,
    tenant_id               UUID,
    user_id                 UUID,
    environment             VARCHAR(50),
    previous_value          JSONB,
    new_value               JSONB NOT NULL,
    change_reason           TEXT,
    changed_by              UUID NOT NULL REFERENCES auth_user(user_id),
    changed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ps_hist_def_time ON ps_setting_change_history (definition_id, changed_at DESC);
CREATE INDEX idx_ps_hist_tenant_time ON ps_setting_change_history (tenant_id, changed_at DESC) WHERE tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE ff_tenant_assignment        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ff_evaluation_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_case                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_case_message             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_case_status_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ps_setting_value            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ps_setting_change_history   ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_ff_assign  ON ff_tenant_assignment       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ff_eval    ON ff_evaluation_log          USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_sc_case    ON sc_case                    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_sc_msg     ON sc_case_message            USING (EXISTS (SELECT 1 FROM sc_case c WHERE c.case_id = sc_case_message.case_id AND c.tenant_id = current_setting('app.current_tenant_id')::UUID));
CREATE POLICY tenant_iso_sc_hist    ON sc_case_status_history     USING (EXISTS (SELECT 1 FROM sc_case c WHERE c.case_id = sc_case_status_history.case_id AND c.tenant_id = current_setting('app.current_tenant_id')::UUID));
CREATE POLICY tenant_iso_ps_val     ON ps_setting_value           USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ps_hist    ON ps_setting_change_history  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ff_flag, ff_targeting_rule, ff_change_history, ps_setting_definition intentionally
-- platform-wide (shared across tenants, write access gated by Platform_Admin role)

-- =============================================================================
-- END OF WAVE 5b — AP-01 Feature Flags + Support Cases + Platform Settings
-- Tables: 13 (Feature Flags: 5, Support: 3, Platform Settings: 3, plus 2 supporting)
-- Enums: 9
-- Indexes: 27
-- RLS Policies: 7
-- =============================================================================
