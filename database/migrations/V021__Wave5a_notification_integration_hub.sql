-- =============================================================================
-- V021 — Wave 5a: AP-01 Notification Hub + Integration Hub
-- Source: FSD-AP-01 Unified Administration Portal §Notification, §Integrations
-- =============================================================================
-- Purpose: The FSD flags both as CRITICAL GAP — no central notification hub,
-- no central integration marketplace. Previously every agent had per-agent
-- notification/integration config. This batch consolidates.
--
-- Reuses: gov_severity, opt_priority_tier
-- Distinct from A26 id_discipline_integration which is for DATA SYNC with
-- practice domains (DevOps/SecOps/etc). AP-01 integration hub is for
-- ALERTING/ACTION webhooks, SSO providers, IdP federation, marketplace apps.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- Notification Hub
CREATE TYPE ntf_channel_type AS ENUM (
    'Email', 'SMS', 'Slack', 'Microsoft_Teams', 'Webhook',
    'In_App', 'Mobile_Push', 'PagerDuty', 'ServiceNow_Incident',
    'Voice_Call', 'Custom'
);

CREATE TYPE ntf_channel_status AS ENUM (
    'Active', 'Disabled', 'Paused', 'Failed_Validation', 'Rate_Limited'
);

CREATE TYPE ntf_delivery_status AS ENUM (
    'Queued', 'Sending', 'Delivered', 'Failed',
    'Bounced', 'Suppressed', 'Throttled', 'Expired'
);

CREATE TYPE ntf_template_category AS ENUM (
    'Alert', 'Digest', 'Approval_Request', 'Informational',
    'Confirmation', 'Report_Delivery', 'System_Event'
);

-- Integration Hub
CREATE TYPE ih_integration_category AS ENUM (
    'Identity_Provider', 'SSO_SAML', 'SSO_OIDC', 'Webhook_Outbound',
    'Webhook_Inbound', 'Marketplace_App', 'ITSM', 'Monitoring',
    'Communication', 'ERP', 'Procurement', 'Custom_API'
);

CREATE TYPE ih_integration_status AS ENUM (
    'Draft', 'Testing', 'Active', 'Disabled', 'Failed', 'Expired_Credential'
);

CREATE TYPE ih_webhook_delivery_status AS ENUM (
    'Pending', 'Success', 'Failed', 'Retry_Scheduled', 'Max_Retries_Exceeded', 'Cancelled'
);

-- ============================================================================
-- NOTIFICATION HUB
-- ============================================================================

-- Notification channel definitions (per tenant, per channel type)
CREATE TABLE ntf_channel (
    channel_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    channel_name            VARCHAR(200) NOT NULL,
    channel_type            ntf_channel_type NOT NULL,
    config_json             JSONB NOT NULL,
    credential_vault_path   VARCHAR(500),
    status                  ntf_channel_status NOT NULL DEFAULT 'Active',
    rate_limit_per_minute   INTEGER,
    rate_limit_per_hour     INTEGER,
    rate_limit_per_day      INTEGER,
    quiet_hours_json        JSONB,
    retry_policy_json       JSONB,
    last_validated_at       TIMESTAMPTZ,
    last_delivery_at        TIMESTAMPTZ,
    failure_count_24h       INTEGER NOT NULL DEFAULT 0,
    is_default_for_type     BOOLEAN NOT NULL DEFAULT FALSE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, channel_name)
);
CREATE INDEX idx_ntf_ch_tenant_type ON ntf_channel (tenant_id, channel_type) WHERE status = 'Active';
CREATE INDEX idx_ntf_ch_failing ON ntf_channel (tenant_id) WHERE status IN ('Failed_Validation', 'Rate_Limited');

-- Notification templates (what the message looks like per category/channel)
CREATE TABLE ntf_template (
    template_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    template_code           VARCHAR(200) NOT NULL,
    template_name           VARCHAR(500) NOT NULL,
    category                ntf_template_category NOT NULL,
    channel_type            ntf_channel_type NOT NULL,
    locale_code             VARCHAR(20) NOT NULL DEFAULT 'en-US',
    subject_template        VARCHAR(500),
    body_template           TEXT NOT NULL,
    variables_schema_json   JSONB,
    is_system_template      BOOLEAN NOT NULL DEFAULT FALSE,
    version                 VARCHAR(50) NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    UNIQUE (tenant_id, template_code, channel_type, locale_code, version)
);
CREATE INDEX idx_ntf_tmpl_category ON ntf_template (category, channel_type) WHERE is_active;
CREATE INDEX idx_ntf_tmpl_tenant ON ntf_template (tenant_id) WHERE tenant_id IS NOT NULL AND is_active;

-- Notification subscriptions (who gets what, on which channels)
CREATE TABLE ntf_subscription (
    subscription_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    subscriber_user_id      UUID REFERENCES auth_user(user_id),
    subscriber_role_id      UUID REFERENCES auth_role(role_id),
    event_type              VARCHAR(200) NOT NULL,
    event_filter_json       JSONB,
    severity_filter         gov_severity[],
    channel_ids             UUID[] NOT NULL,
    digest_frequency        VARCHAR(50),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    CONSTRAINT ck_subscriber CHECK (
        (subscriber_user_id IS NOT NULL AND subscriber_role_id IS NULL) OR
        (subscriber_user_id IS NULL AND subscriber_role_id IS NOT NULL)
    )
);
CREATE INDEX idx_ntf_sub_tenant_event ON ntf_subscription (tenant_id, event_type) WHERE is_active;
CREATE INDEX idx_ntf_sub_user ON ntf_subscription (subscriber_user_id) WHERE subscriber_user_id IS NOT NULL AND is_active;
CREATE INDEX idx_ntf_sub_role ON ntf_subscription (subscriber_role_id) WHERE subscriber_role_id IS NOT NULL AND is_active;

-- Delivery log (every notification send attempt)
CREATE TABLE ntf_delivery_log (
    delivery_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    channel_id              UUID NOT NULL,
    template_id             UUID,
    subscription_id         UUID,
    event_type              VARCHAR(200) NOT NULL,
    source_entity_type      VARCHAR(100),
    source_entity_id        UUID,
    recipient_user_id       UUID,
    recipient_address       VARCHAR(500),
    subject                 VARCHAR(500),
    body_hash               CHAR(64),
    payload_json            JSONB,
    status                  ntf_delivery_status NOT NULL DEFAULT 'Queued',
    attempt_count           INTEGER NOT NULL DEFAULT 0,
    last_attempt_at         TIMESTAMPTZ,
    delivered_at            TIMESTAMPTZ,
    opened_at               TIMESTAMPTZ,
    clicked_at              TIMESTAMPTZ,
    failure_reason          TEXT,
    provider_message_id     VARCHAR(500),
    correlation_id          UUID,
    queued_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (delivery_id, queued_at)
) PARTITION BY RANGE (queued_at);

CREATE TABLE ntf_delivery_log_y2026m07 PARTITION OF ntf_delivery_log
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE ntf_delivery_log_y2026m08 PARTITION OF ntf_delivery_log
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_ntf_log_tenant_time ON ntf_delivery_log (tenant_id, queued_at DESC);
CREATE INDEX idx_ntf_log_channel_status ON ntf_delivery_log (channel_id, status);
CREATE INDEX idx_ntf_log_correlation ON ntf_delivery_log (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_ntf_log_source ON ntf_delivery_log (source_entity_type, source_entity_id);
CREATE INDEX idx_ntf_log_failed ON ntf_delivery_log (status, queued_at DESC) WHERE status IN ('Failed', 'Bounced');

-- Suppression list (Do Not Contact, regulatory unsubscribes)
CREATE TABLE ntf_suppression (
    suppression_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID REFERENCES tenant(tenant_id),
    recipient_address       VARCHAR(500) NOT NULL,
    channel_type            ntf_channel_type NOT NULL,
    suppression_reason      VARCHAR(100) NOT NULL,
    suppression_scope       VARCHAR(50) NOT NULL,
    event_type_filter       TEXT[],
    suppressed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suppressed_by           UUID REFERENCES auth_user(user_id),
    expires_at              TIMESTAMPTZ,
    notes                   TEXT
);
CREATE INDEX idx_ntf_supp_lookup ON ntf_suppression (recipient_address, channel_type, expires_at);

-- ============================================================================
-- INTEGRATION HUB
-- ============================================================================

-- Integration catalog (marketplace-style reference data, platform-wide)
CREATE TABLE ih_integration_catalog (
    catalog_entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_code            VARCHAR(200) NOT NULL UNIQUE,
    display_name            VARCHAR(500) NOT NULL,
    vendor_name             VARCHAR(200) NOT NULL,
    category                ih_integration_category NOT NULL,
    description             TEXT,
    icon_uri                TEXT,
    documentation_url       TEXT,
    supported_auth_types    TEXT[],
    config_schema_json      JSONB NOT NULL,
    required_permissions    TEXT[],
    is_first_party          BOOLEAN NOT NULL DEFAULT FALSE,
    is_beta                 BOOLEAN NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    version                 VARCHAR(50) NOT NULL,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ih_cat_category ON ih_integration_catalog (category) WHERE is_active;

-- Tenant integration instances (configured connections to external systems)
CREATE TABLE ih_integration_connection (
    connection_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    catalog_entry_id        UUID REFERENCES ih_integration_catalog(catalog_entry_id),
    connection_name         VARCHAR(200) NOT NULL,
    category                ih_integration_category NOT NULL,
    config_json             JSONB NOT NULL,
    credential_vault_path   VARCHAR(500) NOT NULL,
    credential_expires_at   TIMESTAMPTZ,
    status                  ih_integration_status NOT NULL DEFAULT 'Draft',
    health_check_url        TEXT,
    last_health_check_at    TIMESTAMPTZ,
    last_health_status      VARCHAR(30),
    last_used_at            TIMESTAMPTZ,
    enabled_by_user_id      UUID REFERENCES auth_user(user_id),
    enabled_at              TIMESTAMPTZ,
    disabled_at             TIMESTAMPTZ,
    disabled_reason         TEXT,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    UNIQUE (tenant_id, connection_name)
);
CREATE INDEX idx_ih_conn_tenant_status ON ih_integration_connection (tenant_id, status);
CREATE INDEX idx_ih_conn_category ON ih_integration_connection (category, status);
CREATE INDEX idx_ih_conn_cred_expiring ON ih_integration_connection (credential_expires_at) WHERE status = 'Active' AND credential_expires_at IS NOT NULL;

-- Webhook endpoints (both inbound and outbound)
CREATE TABLE ih_webhook_endpoint (
    webhook_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    connection_id           UUID REFERENCES ih_integration_connection(connection_id),
    direction               VARCHAR(20) NOT NULL,
    endpoint_url            TEXT NOT NULL,
    signing_secret_vault_path VARCHAR(500),
    event_filter            TEXT[],
    payload_template_json   JSONB,
    headers_json            JSONB,
    retry_policy_json       JSONB,
    timeout_seconds         INTEGER NOT NULL DEFAULT 30,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id)
);
CREATE INDEX idx_ih_wh_tenant_active ON ih_webhook_endpoint (tenant_id) WHERE is_active;
CREATE INDEX idx_ih_wh_conn ON ih_webhook_endpoint (connection_id) WHERE connection_id IS NOT NULL;

-- Webhook delivery attempts (outbound webhooks)
CREATE TABLE ih_webhook_delivery (
    delivery_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    webhook_id              UUID NOT NULL,
    event_type              VARCHAR(200) NOT NULL,
    source_entity_type      VARCHAR(100),
    source_entity_id        UUID,
    request_payload_json    JSONB,
    request_headers_json    JSONB,
    response_status_code    INTEGER,
    response_body_excerpt   TEXT,
    response_time_ms        INTEGER,
    status                  ih_webhook_delivery_status NOT NULL DEFAULT 'Pending',
    attempt_number          INTEGER NOT NULL DEFAULT 1,
    next_retry_at           TIMESTAMPTZ,
    failure_reason          TEXT,
    correlation_id          UUID,
    queued_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    PRIMARY KEY (delivery_id, queued_at)
) PARTITION BY RANGE (queued_at);

CREATE TABLE ih_webhook_delivery_y2026m07 PARTITION OF ih_webhook_delivery
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE ih_webhook_delivery_y2026m08 PARTITION OF ih_webhook_delivery
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_ih_wd_webhook_time ON ih_webhook_delivery (webhook_id, queued_at DESC);
CREATE INDEX idx_ih_wd_retry ON ih_webhook_delivery (next_retry_at) WHERE status = 'Retry_Scheduled';
CREATE INDEX idx_ih_wd_tenant_status ON ih_webhook_delivery (tenant_id, status, queued_at DESC);

-- IdP federation config (SAML/OIDC specifics, extends ih_integration_connection)
CREATE TABLE ih_idp_federation (
    federation_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    connection_id           UUID NOT NULL REFERENCES ih_integration_connection(connection_id),
    protocol                VARCHAR(30) NOT NULL,
    issuer_url              TEXT NOT NULL,
    client_id_vault_path    VARCHAR(500),
    client_secret_vault_path VARCHAR(500),
    metadata_url            TEXT,
    scim_endpoint_url       TEXT,
    scim_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
    attribute_mappings_json JSONB,
    group_mappings_json     JSONB,
    default_role_id         UUID REFERENCES auth_role(role_id),
    is_primary              BOOLEAN NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at            TIMESTAMPTZ,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    UNIQUE (connection_id)
);
CREATE INDEX idx_ih_idp_tenant ON ih_idp_federation (tenant_id) WHERE is_active;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE ntf_channel                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ntf_template                ENABLE ROW LEVEL SECURITY;
ALTER TABLE ntf_subscription            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ntf_delivery_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ntf_suppression             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ih_integration_connection   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ih_webhook_endpoint         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ih_webhook_delivery         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ih_idp_federation           ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_ntf_ch    ON ntf_channel             USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ntf_tmpl  ON ntf_template            USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ntf_sub   ON ntf_subscription        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ntf_log   ON ntf_delivery_log        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ntf_supp  ON ntf_suppression         USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ih_conn   ON ih_integration_connection USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ih_wh     ON ih_webhook_endpoint     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ih_wd     ON ih_webhook_delivery     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ih_idp    ON ih_idp_federation       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ih_integration_catalog intentionally NOT tenant-scoped (marketplace is global)

-- =============================================================================
-- END OF WAVE 5a — AP-01 Notification Hub + Integration Hub
-- Tables: 11 (Notification: 5, Integration: 6)
-- Enums: 7
-- Indexes: 27
-- RLS Policies: 9
-- Partitioned: ntf_delivery_log, ih_webhook_delivery (monthly)
-- =============================================================================
