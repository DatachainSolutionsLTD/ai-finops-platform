-- =============================================================================
-- V017 — Wave 3c: A17 Container/Serverless + A18 Data Transfer/Network + A19 Storage
-- Sources: A17-FSD-CO-17, A18-FSD-NT-18, A19-FSD-SO-19
-- =============================================================================
-- Reuses shared Optimize pattern from V015:
--   opt_recommendation_status, opt_confidence_level, opt_priority_tier,
--   opt_performance_impact, gov_severity
-- Completes Wave 3 — all 9 Optimize agents (A11–A19) now have DDL
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- A17 Container / Serverless
CREATE TYPE co_orchestrator_type AS ENUM (
    'Kubernetes', 'OpenShift', 'ECS_Fargate', 'ACI', 'Cloud_Run',
    'Lambda', 'Azure_Functions', 'GCP_Functions', 'Nomad', 'Docker_Swarm'
);

CREATE TYPE co_finding_type AS ENUM (
    'Oversized_Request', 'Undersized_Request', 'Missing_Requests',
    'Missing_Limits', 'Zombie_Pod', 'Idle_Namespace',
    'Inefficient_Autoscaling', 'Cold_Start_Waste', 'Over_Provisioned_Lambda'
);

CREATE TYPE co_workload_kind AS ENUM (
    'Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob',
    'Lambda_Function', 'Fargate_Task', 'Azure_Function', 'Cloud_Run_Service'
);

-- A18 Network / Data Transfer
CREATE TYPE nt_transfer_type AS ENUM (
    'Inter_Region', 'Inter_AZ', 'Internet_Egress', 'VPN_ExpressRoute',
    'Cloud_Interconnect', 'CDN_Origin', 'VPC_Peering',
    'Private_Link', 'NAT_Gateway', 'Transit_Gateway'
);

CREATE TYPE nt_finding_type AS ENUM (
    'Expensive_Egress', 'Chatty_Cross_Region', 'NAT_Gateway_Overuse',
    'Missing_CDN', 'Suboptimal_Peering', 'Underutilized_Interconnect',
    'Data_Transfer_Spike'
);

-- A19 Storage
CREATE TYPE so_storage_type AS ENUM (
    'Object_Storage', 'Block_Storage', 'File_Storage',
    'Snapshot', 'Backup', 'Archive', 'Ephemeral'
);

CREATE TYPE so_storage_tier AS ENUM (
    'Standard_Hot', 'Infrequent_Access', 'Archive', 'Deep_Archive',
    'Cold', 'Nearline', 'Coldline', 'Intelligent_Tiering'
);

CREATE TYPE so_finding_type AS ENUM (
    'Wrong_Tier', 'Orphan_Snapshot', 'Orphan_Volume',
    'Unattached_Disk', 'Stale_Backup', 'Duplicate_Data',
    'Over_Provisioned_Volume', 'Missing_Lifecycle_Policy',
    'Expired_Retention', 'Redundant_Replication'
);

-- ============================================================================
-- A17 — CONTAINER & SERVERLESS OPTIMIZER
-- ============================================================================

CREATE TABLE co_cluster_registry (
    cluster_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    orchestrator_type       co_orchestrator_type NOT NULL,
    provider                VARCHAR(100) NOT NULL,
    cluster_identifier      VARCHAR(500) NOT NULL,
    region_code             VARCHAR(100),
    node_count              INTEGER,
    total_vcpu              NUMERIC(10,2),
    total_memory_gb         NUMERIC(10,2),
    control_plane_cost_monthly NUMERIC(18,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider, cluster_identifier)
);
CREATE INDEX idx_co_cluster_tenant ON co_cluster_registry (tenant_id) WHERE is_active;

CREATE TABLE co_workload_profile (
    workload_profile_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    cluster_id              UUID REFERENCES co_cluster_registry(cluster_id),
    workload_kind           co_workload_kind NOT NULL,
    workload_namespace      VARCHAR(200),
    workload_name           VARCHAR(500) NOT NULL,
    observation_window_start DATE NOT NULL,
    observation_window_end   DATE NOT NULL,
    cpu_request_cores       NUMERIC(10,4),
    cpu_limit_cores         NUMERIC(10,4),
    cpu_actual_p95_cores    NUMERIC(10,4),
    memory_request_mib      NUMERIC(12,2),
    memory_limit_mib        NUMERIC(12,2),
    memory_actual_p95_mib   NUMERIC(12,2),
    invocation_count        BIGINT,
    avg_duration_ms         NUMERIC(12,2),
    cold_start_count        BIGINT,
    restart_count           BIGINT,
    current_monthly_cost    NUMERIC(18,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    sample_count            BIGINT NOT NULL,
    profiled_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cluster_id, workload_kind, workload_namespace, workload_name, observation_window_start)
);
CREATE INDEX idx_co_profile_tenant_workload ON co_workload_profile (tenant_id, workload_name);

CREATE TABLE co_finding (
    finding_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    workload_profile_id     UUID REFERENCES co_workload_profile(workload_profile_id),
    cluster_id              UUID REFERENCES co_cluster_registry(cluster_id),
    finding_type            co_finding_type NOT NULL,
    current_monthly_cost    NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    severity                gov_severity NOT NULL,
    evidence_json           JSONB,
    owner_user_id           UUID REFERENCES auth_user(user_id),
    status                  VARCHAR(30) NOT NULL DEFAULT 'Open',
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ
);
CREATE INDEX idx_co_find_tenant_open ON co_finding (tenant_id, status) WHERE status = 'Open';
CREATE INDEX idx_co_find_type ON co_finding (tenant_id, finding_type);

CREATE TABLE co_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    finding_id              UUID NOT NULL REFERENCES co_finding(finding_id),
    recommendation_category VARCHAR(100) NOT NULL,
    current_spec_json       JSONB NOT NULL,
    recommended_spec_json   JSONB NOT NULL,
    estimated_monthly_savings NUMERIC(18,4) NOT NULL,
    estimated_annual_savings  NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    confidence              opt_confidence_level NOT NULL,
    performance_impact      opt_performance_impact NOT NULL,
    priority                opt_priority_tier NOT NULL,
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    rationale               TEXT,
    reviewed_by             UUID REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id),
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_co_rec_tenant_status ON co_recommendation (tenant_id, status);
CREATE INDEX idx_co_rec_priority ON co_recommendation (priority, estimated_monthly_savings DESC) WHERE status = 'Pending_Review';

-- ============================================================================
-- A18 — DATA TRANSFER & NETWORK OPTIMIZER
-- ============================================================================

CREATE TABLE nt_transfer_measurement (
    measurement_id          UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    provider                VARCHAR(100) NOT NULL,
    transfer_type           nt_transfer_type NOT NULL,
    source_region           VARCHAR(100),
    destination_region      VARCHAR(100),
    source_service          VARCHAR(200),
    destination_service     VARCHAR(200),
    measurement_period_start DATE NOT NULL,
    measurement_period_end   DATE NOT NULL,
    bytes_transferred       NUMERIC(20,0) NOT NULL,
    cost_amount             NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    business_unit_id        UUID,
    application_id          UUID,
    measured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (measurement_id, measurement_period_start)
) PARTITION BY RANGE (measurement_period_start);

CREATE TABLE nt_transfer_measurement_y2026m07 PARTITION OF nt_transfer_measurement
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE nt_transfer_measurement_y2026m08 PARTITION OF nt_transfer_measurement
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_nt_meas_tenant_type ON nt_transfer_measurement (tenant_id, transfer_type, measurement_period_start DESC);
CREATE INDEX idx_nt_meas_route ON nt_transfer_measurement (source_region, destination_region, measurement_period_start DESC);

CREATE TABLE nt_traffic_pattern (
    pattern_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    pattern_signature       VARCHAR(500) NOT NULL,
    transfer_type           nt_transfer_type NOT NULL,
    source_service          VARCHAR(200),
    destination_service     VARCHAR(200),
    source_region           VARCHAR(100),
    destination_region      VARCHAR(100),
    avg_daily_gb            NUMERIC(18,6) NOT NULL,
    avg_daily_cost          NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    pattern_frequency       VARCHAR(50),
    first_observed_at       TIMESTAMPTZ NOT NULL,
    last_observed_at        TIMESTAMPTZ NOT NULL,
    is_recurring            BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (tenant_id, pattern_signature)
);
CREATE INDEX idx_nt_pattern_tenant_cost ON nt_traffic_pattern (tenant_id, avg_daily_cost DESC);

CREATE TABLE nt_finding (
    finding_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    pattern_id              UUID REFERENCES nt_traffic_pattern(pattern_id),
    finding_type            nt_finding_type NOT NULL,
    current_monthly_cost    NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    severity                gov_severity NOT NULL,
    evidence_json           JSONB,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Open',
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ
);
CREATE INDEX idx_nt_find_tenant_open ON nt_finding (tenant_id, status) WHERE status = 'Open';

CREATE TABLE nt_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    finding_id              UUID REFERENCES nt_finding(finding_id),
    recommendation_category VARCHAR(100) NOT NULL,
    current_architecture_json JSONB,
    recommended_architecture_json JSONB NOT NULL,
    estimated_monthly_savings NUMERIC(18,4) NOT NULL,
    estimated_annual_savings  NUMERIC(18,4) NOT NULL,
    implementation_cost     NUMERIC(18,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    confidence              opt_confidence_level NOT NULL,
    performance_impact      opt_performance_impact NOT NULL,
    priority                opt_priority_tier NOT NULL,
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    rationale               TEXT,
    approved_by             UUID REFERENCES auth_user(user_id),
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_nt_rec_tenant_status ON nt_recommendation (tenant_id, status);

-- ============================================================================
-- A19 — STORAGE OPTIMIZER
-- ============================================================================

CREATE TABLE so_storage_asset (
    asset_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    provider                VARCHAR(100) NOT NULL,
    storage_type            so_storage_type NOT NULL,
    asset_identifier        VARCHAR(1000) NOT NULL,
    asset_name              VARCHAR(500),
    region_code             VARCHAR(100),
    current_tier            so_storage_tier,
    size_gb                 NUMERIC(18,4) NOT NULL,
    provisioned_iops        NUMERIC(18,4),
    monthly_cost_amount     NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    attached_to_resource    VARCHAR(1000),
    business_unit_id        UUID,
    application_id          UUID,
    last_access_timestamp   TIMESTAMPTZ,
    access_frequency        VARCHAR(50),
    retention_policy        VARCHAR(200),
    created_at_provider     TIMESTAMPTZ,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider, asset_identifier)
);
CREATE INDEX idx_so_asset_tenant_type ON so_storage_asset (tenant_id, storage_type) WHERE is_active;
CREATE INDEX idx_so_asset_cost ON so_storage_asset (tenant_id, monthly_cost_amount DESC) WHERE is_active;
CREATE INDEX idx_so_asset_stale ON so_storage_asset (last_access_timestamp) WHERE is_active AND last_access_timestamp IS NOT NULL;

CREATE TABLE so_access_pattern (
    pattern_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    asset_id                UUID NOT NULL REFERENCES so_storage_asset(asset_id),
    observation_window_start DATE NOT NULL,
    observation_window_end   DATE NOT NULL,
    read_ops_count          BIGINT NOT NULL DEFAULT 0,
    write_ops_count         BIGINT NOT NULL DEFAULT 0,
    bytes_read              NUMERIC(20,0) NOT NULL DEFAULT 0,
    bytes_written           NUMERIC(20,0) NOT NULL DEFAULT 0,
    avg_daily_access_count  NUMERIC(18,4),
    days_since_last_access  INTEGER,
    recommended_tier        so_storage_tier,
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (asset_id, observation_window_start)
);
CREATE INDEX idx_so_access_tenant_asset ON so_access_pattern (tenant_id, asset_id, observation_window_start DESC);

CREATE TABLE so_finding (
    finding_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    asset_id                UUID NOT NULL REFERENCES so_storage_asset(asset_id),
    finding_type            so_finding_type NOT NULL,
    current_monthly_cost    NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    severity                gov_severity NOT NULL,
    days_detected           INTEGER,
    evidence_json           JSONB,
    owner_user_id           UUID REFERENCES auth_user(user_id),
    status                  VARCHAR(30) NOT NULL DEFAULT 'Open',
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ
);
CREATE INDEX idx_so_find_tenant_open ON so_finding (tenant_id, status) WHERE status = 'Open';
CREATE INDEX idx_so_find_type ON so_finding (tenant_id, finding_type);
CREATE INDEX idx_so_find_cost ON so_finding (current_monthly_cost DESC) WHERE status = 'Open';

CREATE TABLE so_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    finding_id              UUID REFERENCES so_finding(finding_id),
    asset_id                UUID NOT NULL REFERENCES so_storage_asset(asset_id),
    recommendation_category VARCHAR(100) NOT NULL,
    current_tier            so_storage_tier,
    recommended_tier        so_storage_tier,
    current_spec_json       JSONB,
    recommended_spec_json   JSONB NOT NULL,
    estimated_monthly_savings NUMERIC(18,4) NOT NULL,
    estimated_annual_savings  NUMERIC(18,4) NOT NULL,
    retrieval_cost_amount   NUMERIC(18,4),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    confidence              opt_confidence_level NOT NULL,
    performance_impact      opt_performance_impact NOT NULL,
    priority                opt_priority_tier NOT NULL,
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    rationale               TEXT,
    reviewed_by             UUID REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id),
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_so_rec_tenant_status ON so_recommendation (tenant_id, status);
CREATE INDEX idx_so_rec_priority ON so_recommendation (priority, estimated_monthly_savings DESC) WHERE status = 'Pending_Review';

CREATE TABLE so_lifecycle_policy (
    lifecycle_policy_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    policy_name             VARCHAR(200) NOT NULL,
    storage_type            so_storage_type NOT NULL,
    scope_filter_json       JSONB NOT NULL,
    transition_rules_json   JSONB NOT NULL,
    expiration_days         INTEGER,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id)
);
CREATE INDEX idx_so_lifecycle_tenant ON so_lifecycle_policy (tenant_id) WHERE is_active;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE co_cluster_registry      ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_workload_profile      ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_finding               ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_recommendation        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nt_transfer_measurement  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nt_traffic_pattern       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nt_finding               ENABLE ROW LEVEL SECURITY;
ALTER TABLE nt_recommendation        ENABLE ROW LEVEL SECURITY;
ALTER TABLE so_storage_asset         ENABLE ROW LEVEL SECURITY;
ALTER TABLE so_access_pattern        ENABLE ROW LEVEL SECURITY;
ALTER TABLE so_finding               ENABLE ROW LEVEL SECURITY;
ALTER TABLE so_recommendation        ENABLE ROW LEVEL SECURITY;
ALTER TABLE so_lifecycle_policy      ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_co_cl  ON co_cluster_registry     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_co_wp  ON co_workload_profile     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_co_f   ON co_finding              USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_co_r   ON co_recommendation       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_nt_m   ON nt_transfer_measurement USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_nt_p   ON nt_traffic_pattern      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_nt_f   ON nt_finding              USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_nt_r   ON nt_recommendation       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_so_a   ON so_storage_asset        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_so_ap  ON so_access_pattern       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_so_f   ON so_finding              USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_so_r   ON so_recommendation       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_so_lc  ON so_lifecycle_policy     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF WAVE 3c — A17 Container/Serverless + A18 Network + A19 Storage
-- Tables: 13 (A17: 4, A18: 4, A19: 5)
-- Enums: 8 new (3 A17 + 2 A18 + 3 A19)
-- Indexes: 27
-- RLS Policies: 13
-- Partitioned: nt_transfer_measurement (monthly)
-- Reuses opt_* enums from V015, gov_severity from V014 — no duplication
-- =============================================================================
-- WAVE 3 COMPLETE: A11–A19 (9 Optimize agents) total:
--   V015 (3a): 13 tables (A11/A12/A13)
--   V016 (3b): 14 tables (A14/A15/A16)
--   V017 (3c): 13 tables (A17/A18/A19)
--   TOTAL WAVE 3: 40 tables, 27 enums, 81 indexes, 39 RLS policies
-- =============================================================================
