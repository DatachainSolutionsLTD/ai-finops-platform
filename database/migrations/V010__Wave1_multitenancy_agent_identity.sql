-- =============================================================================
-- V010 — Wave 1: Multi-Tenancy & Agent Identity Foundation (FSD-MT-01 / A31)
-- THIS IS THE FOUNDATIONAL DDL — every other table in the system should FK here
-- =============================================================================
-- DESIGN PRINCIPLES:
--   - NO hardcoded currency/tenant/customer/org names anywhere
--   - Tenant tier definitions are DATA (not schema enums) so deployments
--     can define their own tier names without code changes
--   - Roles separated into: built-in system roles (enum) + custom tenant roles (table)
--     Built-in role names referenced by OPA policies, custom roles compose them
--   - Agent identity is platform-wide; agent-tenant scope is many-to-many
--   - All credentials stored as Vault path references, NEVER as raw secrets
--   - Sessions, API keys, MFA enrollments support full lifecycle and rotation
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS (operation-level only, no organizational semantics)
-- ---------------------------------------------------------------------------
CREATE TYPE tenant_lifecycle_status AS ENUM (
    'Pending_Provisioning', 'Provisioning', 'Active', 'Suspended',
    'Throttled', 'Pending_Offboarding', 'Offboarded', 'Archived'
);

CREATE TYPE tenant_isolation_mode AS ENUM (
    'Shared_Database', 'Schema_Per_Tenant', 'Database_Per_Tenant', 'Cluster_Per_Tenant'
);

CREATE TYPE agent_autonomy_level AS ENUM (
    'L0_Observer', 'L1_Suggest', 'L2_Approve_To_Act',
    'L3_Act_With_Notify', 'L4_Fully_Autonomous'
);

CREATE TYPE agent_operational_status AS ENUM (
    'Provisioned', 'Active', 'Suspended', 'Quarantined', 'Decommissioned'
);

CREATE TYPE principal_type AS ENUM (
    'Human_User', 'Agent_Principal', 'Service_Account', 'API_Key'
);

CREATE TYPE auth_factor_type AS ENUM (
    'Password', 'TOTP', 'WebAuthn', 'SMS_OTP', 'Email_OTP', 'Hardware_Key'
);

CREATE TYPE session_status AS ENUM (
    'Active', 'Expired', 'Revoked', 'Terminated'
);

CREATE TYPE credential_grant_status AS ENUM (
    'Pending_Approval', 'Approved', 'Active', 'Revoked', 'Expired'
);

CREATE TYPE built_in_role AS ENUM (
    'Platform_Admin', 'Tenant_Admin', 'FinOps_Analyst',
    'Executive_Viewer', 'Engineering', 'Finance', 'Auditor', 'Read_Only'
);

CREATE TYPE permission_effect AS ENUM ('Allow', 'Deny');

-- ---------------------------------------------------------------------------
-- TENANT TIERS (data-driven — no hardcoded tier names in schema)
-- ---------------------------------------------------------------------------
CREATE TABLE tenant_tier (
    tier_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_code               VARCHAR(50) NOT NULL UNIQUE,
    display_name            VARCHAR(200) NOT NULL,
    description             TEXT,
    default_quota_json      JSONB NOT NULL,
    default_rate_limit_rpm  INTEGER NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE tenant_tier IS 'Tier definitions (Starter/Professional/Enterprise/Sovereign etc.) seeded per deployment, not hardcoded in schema.';

-- ---------------------------------------------------------------------------
-- TENANT REGISTRY (the FK target for every tenant_id in the platform)
-- ---------------------------------------------------------------------------
CREATE TABLE tenant (
    tenant_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code             VARCHAR(100) NOT NULL UNIQUE,
    legal_name              VARCHAR(500) NOT NULL,
    display_name            VARCHAR(200) NOT NULL,
    tier_id                 UUID NOT NULL REFERENCES tenant_tier(tier_id),
    isolation_mode          tenant_isolation_mode NOT NULL DEFAULT 'Shared_Database',
    k8s_namespace           VARCHAR(63) NOT NULL UNIQUE,
    storage_prefix          VARCHAR(200) NOT NULL UNIQUE,
    encryption_key_arn      VARCHAR(500),
    primary_currency_id     UUID NOT NULL REFERENCES ref_currency(currency_id),
    primary_country_code    CHAR(2) NOT NULL,
    primary_region          VARCHAR(100),
    primary_timezone        VARCHAR(50) NOT NULL,
    fiscal_year_start_month SMALLINT NOT NULL DEFAULT 1,
    lifecycle_status        tenant_lifecycle_status NOT NULL DEFAULT 'Pending_Provisioning',
    activation_date         DATE,
    suspension_date         DATE,
    offboarding_date        DATE,
    sla_definition_json     JSONB,
    organizational_hierarchy_json JSONB,
    parent_tenant_id        UUID REFERENCES tenant(tenant_id),
    contract_reference      VARCHAR(200),
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL,
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_by        UUID NOT NULL,
    CONSTRAINT ck_fy_start CHECK (fiscal_year_start_month BETWEEN 1 AND 12)
);
CREATE INDEX idx_tenant_status ON tenant (lifecycle_status);
CREATE INDEX idx_tenant_tier ON tenant (tier_id);
CREATE INDEX idx_tenant_parent ON tenant (parent_tenant_id) WHERE parent_tenant_id IS NOT NULL;

-- Tenant lifecycle audit (immutable history of all state transitions)
CREATE TABLE tenant_lifecycle_event (
    event_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    previous_status         tenant_lifecycle_status,
    new_status              tenant_lifecycle_status NOT NULL,
    triggered_by_user_id    UUID,
    triggered_by_agent_id   UUID,
    reason                  TEXT,
    metadata                JSONB,
    event_timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tenant_event_tenant_time ON tenant_lifecycle_event (tenant_id, event_timestamp DESC);

-- Tenant quotas (per-tenant overrides of tier defaults)
CREATE TABLE tenant_quota (
    quota_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    quota_dimension         VARCHAR(100) NOT NULL,
    quota_limit             NUMERIC(18,4) NOT NULL,
    quota_unit              VARCHAR(50) NOT NULL,
    soft_threshold_pct      NUMERIC(5,2) DEFAULT 80,
    hard_threshold_pct      NUMERIC(5,2) DEFAULT 100,
    current_usage           NUMERIC(18,4) NOT NULL DEFAULT 0,
    last_evaluated_at       TIMESTAMPTZ,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, quota_dimension, effective_from)
);
CREATE INDEX idx_tenant_quota_tenant ON tenant_quota (tenant_id, quota_dimension);

-- Noisy neighbor detection log
CREATE TABLE tenant_noisy_neighbor_event (
    event_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offending_tenant_id     UUID NOT NULL REFERENCES tenant(tenant_id),
    affected_tenant_ids     UUID[] NOT NULL,
    resource_type           VARCHAR(50) NOT NULL,
    current_usage_pct       NUMERIC(5,2) NOT NULL,
    quota_limit             NUMERIC(18,4),
    performance_degradation_pct NUMERIC(5,2),
    auto_remediation_taken  BOOLEAN NOT NULL DEFAULT FALSE,
    remediation_action      VARCHAR(200),
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ
);
CREATE INDEX idx_noisy_offender_time ON tenant_noisy_neighbor_event (offending_tenant_id, detected_at DESC);

-- ---------------------------------------------------------------------------
-- HUMAN USER REGISTRY
-- ---------------------------------------------------------------------------
CREATE TABLE auth_user (
    user_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_idp_subject    VARCHAR(500) UNIQUE,
    email                   VARCHAR(320) NOT NULL UNIQUE,
    display_name            VARCHAR(200) NOT NULL,
    given_name              VARCHAR(100),
    family_name             VARCHAR(100),
    primary_tenant_id       UUID REFERENCES tenant(tenant_id),
    persona                 VARCHAR(100),
    locale                  VARCHAR(20) NOT NULL DEFAULT 'en-US',
    preferred_timezone      VARCHAR(50),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    is_platform_admin       BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at           TIMESTAMPTZ,
    password_credential_ref VARCHAR(500),
    mfa_required            BOOLEAN NOT NULL DEFAULT TRUE,
    account_locked_until    TIMESTAMPTZ,
    failed_login_count      INTEGER NOT NULL DEFAULT 0,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID,
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_primary_tenant ON auth_user (primary_tenant_id) WHERE primary_tenant_id IS NOT NULL;
CREATE INDEX idx_user_active ON auth_user (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_admin ON auth_user (is_platform_admin) WHERE is_platform_admin = TRUE;

-- User-tenant access (a user can have access to multiple tenants)
CREATE TABLE auth_user_tenant_access (
    access_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES auth_user(user_id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    granted_by              UUID NOT NULL REFERENCES auth_user(user_id),
    granted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at              TIMESTAMPTZ,
    revoked_by              UUID REFERENCES auth_user(user_id),
    UNIQUE (user_id, tenant_id)
);
CREATE INDEX idx_user_tenant_access ON auth_user_tenant_access (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_tenant_users ON auth_user_tenant_access (tenant_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- ROLES & PERMISSIONS (built-in roles enum + custom roles table)
-- ---------------------------------------------------------------------------
CREATE TABLE auth_role (
    role_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code               VARCHAR(100) NOT NULL,
    display_name            VARCHAR(200) NOT NULL,
    description             TEXT,
    tenant_id               UUID REFERENCES tenant(tenant_id),
    is_built_in             BOOLEAN NOT NULL DEFAULT FALSE,
    built_in_role           built_in_role,
    composes_role_ids       UUID[],
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL,
    UNIQUE (tenant_id, role_code),
    CONSTRAINT ck_built_in_consistency CHECK (
        (is_built_in = TRUE AND built_in_role IS NOT NULL AND tenant_id IS NULL) OR
        (is_built_in = FALSE AND tenant_id IS NOT NULL)
    )
);
CREATE INDEX idx_role_tenant ON auth_role (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_role_built_in ON auth_role (built_in_role) WHERE is_built_in;

-- Permission catalog (data-driven — new permissions added via seed data)
CREATE TABLE auth_permission (
    permission_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_code         VARCHAR(200) NOT NULL UNIQUE,
    resource_type           VARCHAR(100) NOT NULL,
    action                  VARCHAR(50) NOT NULL,
    description             TEXT,
    is_platform_scope       BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_perm_resource ON auth_permission (resource_type);

-- Role-permission grants
CREATE TABLE auth_role_permission (
    grant_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id                 UUID NOT NULL REFERENCES auth_role(role_id) ON DELETE CASCADE,
    permission_id           UUID NOT NULL REFERENCES auth_permission(permission_id),
    effect                  permission_effect NOT NULL DEFAULT 'Allow',
    resource_filter         JSONB,
    granted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by              UUID NOT NULL,
    UNIQUE (role_id, permission_id)
);

-- User-role bindings (scoped to a tenant)
CREATE TABLE auth_user_role_binding (
    binding_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES auth_user(user_id) ON DELETE CASCADE,
    role_id                 UUID NOT NULL REFERENCES auth_role(role_id),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    granted_by              UUID NOT NULL REFERENCES auth_user(user_id),
    granted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ,
    revoked_at              TIMESTAMPTZ,
    UNIQUE (user_id, role_id, tenant_id)
);
CREATE INDEX idx_binding_user ON auth_user_role_binding (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_binding_tenant ON auth_user_role_binding (tenant_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- AUTHENTICATION ARTIFACTS (sessions, MFA, API keys, service accounts)
-- ---------------------------------------------------------------------------
CREATE TABLE auth_session (
    session_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES auth_user(user_id) ON DELETE CASCADE,
    active_tenant_id        UUID REFERENCES tenant(tenant_id),
    refresh_token_hash      CHAR(64) NOT NULL UNIQUE,
    issued_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ NOT NULL,
    last_used_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status                  session_status NOT NULL DEFAULT 'Active',
    revoked_at              TIMESTAMPTZ,
    client_ip               INET,
    user_agent              VARCHAR(500),
    idp_session_ref         VARCHAR(500)
);
CREATE INDEX idx_session_user ON auth_session (user_id) WHERE status = 'Active';
CREATE INDEX idx_session_expires ON auth_session (expires_at) WHERE status = 'Active';

CREATE TABLE auth_mfa_enrollment (
    enrollment_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES auth_user(user_id) ON DELETE CASCADE,
    factor_type             auth_factor_type NOT NULL,
    factor_credential_ref   VARCHAR(500) NOT NULL,
    display_label           VARCHAR(200),
    is_primary              BOOLEAN NOT NULL DEFAULT FALSE,
    enrolled_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at            TIMESTAMPTZ,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (user_id, factor_type, factor_credential_ref)
);
CREATE INDEX idx_mfa_user ON auth_mfa_enrollment (user_id) WHERE is_active;

CREATE TABLE auth_api_key (
    api_key_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_prefix              VARCHAR(20) NOT NULL UNIQUE,
    key_hash                CHAR(64) NOT NULL UNIQUE,
    display_name            VARCHAR(200) NOT NULL,
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    owner_user_id           UUID REFERENCES auth_user(user_id),
    role_id                 UUID NOT NULL REFERENCES auth_role(role_id),
    scopes                  TEXT[],
    rate_limit_rpm          INTEGER,
    issued_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ,
    last_used_at            TIMESTAMPTZ,
    revoked_at              TIMESTAMPTZ,
    revoked_by              UUID REFERENCES auth_user(user_id),
    revocation_reason       TEXT
);
CREATE INDEX idx_apikey_tenant ON auth_api_key (tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_apikey_owner ON auth_api_key (owner_user_id) WHERE revoked_at IS NULL;

CREATE TABLE auth_service_account (
    service_account_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sa_code                 VARCHAR(100) NOT NULL,
    display_name            VARCHAR(200) NOT NULL,
    tenant_id               UUID REFERENCES tenant(tenant_id),
    role_id                 UUID NOT NULL REFERENCES auth_role(role_id),
    k8s_namespace           VARCHAR(63),
    k8s_sa_name             VARCHAR(253),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL,
    UNIQUE (tenant_id, sa_code)
);

-- ---------------------------------------------------------------------------
-- AGENT IDENTITY REGISTRY (Agent_ID is the FK target for agent_id columns)
-- ---------------------------------------------------------------------------
CREATE TABLE agent_identity (
    agent_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type_code         VARCHAR(50) NOT NULL,
    agent_version           VARCHAR(50) NOT NULL,
    autonomy_level          agent_autonomy_level NOT NULL DEFAULT 'L0_Observer',
    operational_status      agent_operational_status NOT NULL DEFAULT 'Provisioned',
    signing_key_vault_path  VARCHAR(500) NOT NULL,
    public_key_pem          TEXT NOT NULL,
    k8s_namespace           VARCHAR(63),
    k8s_sa_name             VARCHAR(253),
    provisioned_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    provisioned_by          UUID NOT NULL REFERENCES auth_user(user_id),
    last_active_at          TIMESTAMPTZ,
    decommissioned_at       TIMESTAMPTZ,
    metadata                JSONB,
    UNIQUE (agent_type_code, agent_version, k8s_namespace)
);
CREATE INDEX idx_agent_type ON agent_identity (agent_type_code) WHERE operational_status = 'Active';

-- Agent tenant scope (which tenants this agent instance serves)
CREATE TABLE agent_tenant_scope (
    scope_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id                UUID NOT NULL REFERENCES agent_identity(agent_id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id) ON DELETE CASCADE,
    autonomy_override       agent_autonomy_level,
    granted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by              UUID NOT NULL REFERENCES auth_user(user_id),
    revoked_at              TIMESTAMPTZ,
    UNIQUE (agent_id, tenant_id)
);
CREATE INDEX idx_agent_scope_tenant ON agent_tenant_scope (tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_agent_scope_agent ON agent_tenant_scope (agent_id) WHERE revoked_at IS NULL;

-- Credential broker grants (Vault paths agents can access)
CREATE TABLE agent_credential_grant (
    grant_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id                UUID NOT NULL REFERENCES agent_identity(agent_id),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    credential_type         VARCHAR(100) NOT NULL,
    vault_path              VARCHAR(500) NOT NULL,
    permitted_operations    TEXT[] NOT NULL,
    status                  credential_grant_status NOT NULL DEFAULT 'Pending_Approval',
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    requested_by_user_id    UUID NOT NULL REFERENCES auth_user(user_id),
    approved_at             TIMESTAMPTZ,
    approved_by_user_id     UUID REFERENCES auth_user(user_id),
    revoked_at              TIMESTAMPTZ,
    revoked_by_user_id      UUID REFERENCES auth_user(user_id),
    last_accessed_at        TIMESTAMPTZ,
    access_count            BIGINT NOT NULL DEFAULT 0,
    expires_at              TIMESTAMPTZ
);
CREATE INDEX idx_cred_grant_agent ON agent_credential_grant (agent_id) WHERE status = 'Active';
CREATE INDEX idx_cred_grant_tenant ON agent_credential_grant (tenant_id) WHERE status = 'Active';
CREATE INDEX idx_cred_grant_pending ON agent_credential_grant (status) WHERE status = 'Pending_Approval';

-- Agent action signing audit (every L2+ action is signed and logged)
CREATE TABLE agent_action_signature (
    signature_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id                UUID NOT NULL REFERENCES agent_identity(agent_id),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    action_type             VARCHAR(100) NOT NULL,
    action_payload_hash     CHAR(64) NOT NULL,
    signature               TEXT NOT NULL,
    signed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlation_id          UUID
);
CREATE INDEX idx_sig_agent_time ON agent_action_signature (agent_id, signed_at DESC);
CREATE INDEX idx_sig_tenant_time ON agent_action_signature (tenant_id, signed_at DESC);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_quota               ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_user_tenant_access    ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_user_role_binding     ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_api_key               ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tenant_scope         ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_credential_grant     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_action_signature     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_quota      ON tenant_quota            USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_user_acc   ON auth_user_tenant_access USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_binding    ON auth_user_role_binding  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_apikey     ON auth_api_key            USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_agent_sc   ON agent_tenant_scope      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_cred_gr    ON agent_credential_grant  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_sig        ON agent_action_signature  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Tenant table: platform admins see all, tenant users see only their tenant
CREATE POLICY tenant_self_visibility ON tenant FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID
        OR current_setting('app.is_platform_admin', true)::BOOLEAN);

-- =============================================================================
-- END OF WAVE 1 — Multi-Tenancy & Agent Identity Foundation
-- Tables: 19
-- Enums: 10
-- Indexes: 30
-- RLS Policies: 8
-- Critical: tenant.tenant_id, auth_user.user_id, agent_identity.agent_id
--   are now the canonical FK targets that all other platform tables should
--   reference. Follow-up migration V011 should add FK constraints from
--   existing 51 tables back to these foundation tables.
-- =============================================================================
