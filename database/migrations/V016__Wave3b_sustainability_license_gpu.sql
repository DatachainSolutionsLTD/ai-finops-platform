-- =============================================================================
-- V016 — Wave 3b: A14 Sustainability + A15 License/SaaS + A16 GPU Optimizer
-- Sources: A14-FSD-SU-01, A15-FSD-LS-15, A16-FSD-GO-16
-- =============================================================================
-- Reuses from Wave 3a (V015):
--   opt_recommendation_status, opt_confidence_level, opt_priority_tier,
--   opt_performance_impact
-- Reuses from Wave 2c (V014): gov_severity
-- All standard foundation FKs to tenant, auth_user, agent_identity, ref_currency
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- A14 Sustainability
CREATE TYPE su_carbon_scope AS ENUM (
    'Scope_1_Direct', 'Scope_2_Indirect_Energy', 'Scope_3_Value_Chain'
);

CREATE TYPE su_emission_source_type AS ENUM (
    'Cloud_Provider_API', 'Manual_Entry', 'Grid_Intensity_API',
    'Lifecycle_Assessment', 'Proxy_Calculation'
);

CREATE TYPE su_emission_unit AS ENUM (
    'kgCO2e', 'tCO2e', 'gCO2e_per_kWh'
);

-- A15 License/SaaS
CREATE TYPE ls_license_model AS ENUM (
    'Perpetual', 'Subscription', 'Consumption_Based', 'Per_Seat',
    'Per_Device', 'Per_Core', 'Per_Instance', 'Site_License', 'Free_Tier'
);

CREATE TYPE ls_entitlement_status AS ENUM (
    'Active', 'Expiring_Soon', 'Expired', 'Cancelled',
    'Over_Allocated', 'Under_Utilized', 'Shelfware'
);

CREATE TYPE ls_compliance_verdict AS ENUM (
    'Compliant', 'Under_Licensed', 'Over_Licensed', 'Audit_Risk', 'Unknown'
);

-- A16 GPU Optimizer
CREATE TYPE go_gpu_workload_type AS ENUM (
    'Training', 'Inference', 'Fine_Tuning', 'Data_Processing',
    'HPC_Simulation', 'Rendering', 'Development', 'Idle'
);

CREATE TYPE go_mig_profile AS ENUM (
    'Full_GPU', '1g_10gb', '2g_20gb', '3g_40gb', '4g_40gb', '7g_80gb', 'Custom'
);

-- ============================================================================
-- A14 — SUSTAINABILITY AGENT
-- ============================================================================

-- Grid carbon intensity reference data (data-driven per region)
CREATE TABLE su_grid_intensity (
    intensity_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider                VARCHAR(100) NOT NULL,
    region_code             VARCHAR(100) NOT NULL,
    region_display_name     VARCHAR(200),
    grid_intensity_gco2_kwh NUMERIC(10,4) NOT NULL,
    renewable_pct           NUMERIC(5,2),
    data_source             VARCHAR(200),
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    last_updated            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, region_code, effective_from)
);
CREATE INDEX idx_su_grid_region ON su_grid_intensity (provider, region_code, effective_from DESC);

-- Emissions measurements per resource per period
CREATE TABLE su_emission_measurement (
    measurement_id          UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    resource_identifier     VARCHAR(1000) NOT NULL,
    resource_type           VARCHAR(200),
    provider                VARCHAR(100) NOT NULL,
    region_code             VARCHAR(100) NOT NULL,
    business_unit_id        UUID,
    application_id          UUID,
    measurement_period_start DATE NOT NULL,
    measurement_period_end   DATE NOT NULL,
    scope                   su_carbon_scope NOT NULL,
    source_type             su_emission_source_type NOT NULL,
    energy_consumption_kwh  NUMERIC(18,6),
    emissions_amount        NUMERIC(18,6) NOT NULL,
    emissions_unit          su_emission_unit NOT NULL DEFAULT 'kgCO2e',
    grid_intensity_id       UUID REFERENCES su_grid_intensity(intensity_id),
    renewable_pct           NUMERIC(5,2),
    calculation_method      VARCHAR(200),
    confidence_score        NUMERIC(5,4),
    measured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (measurement_id, measurement_period_start)
) PARTITION BY RANGE (measurement_period_start);

CREATE TABLE su_emission_measurement_y2026m07 PARTITION OF su_emission_measurement
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE su_emission_measurement_y2026m08 PARTITION OF su_emission_measurement
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_su_emis_tenant_period ON su_emission_measurement (tenant_id, measurement_period_start DESC);
CREATE INDEX idx_su_emis_resource ON su_emission_measurement (resource_identifier);

-- Emissions allocation (rollup to BU/Application)
CREATE TABLE su_emission_allocation (
    allocation_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    allocation_period_start DATE NOT NULL,
    allocation_period_end   DATE NOT NULL,
    dimension_scope         VARCHAR(100) NOT NULL,
    dimension_key           VARCHAR(500) NOT NULL,
    total_emissions         NUMERIC(18,6) NOT NULL,
    emissions_unit          su_emission_unit NOT NULL,
    scope_1_emissions       NUMERIC(18,6) NOT NULL DEFAULT 0,
    scope_2_emissions       NUMERIC(18,6) NOT NULL DEFAULT 0,
    scope_3_emissions       NUMERIC(18,6) NOT NULL DEFAULT 0,
    carbon_intensity_score  NUMERIC(10,4),
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, allocation_period_start, dimension_scope, dimension_key)
);
CREATE INDEX idx_su_alloc_tenant_period ON su_emission_allocation (tenant_id, allocation_period_start DESC);

-- Sustainability targets
CREATE TABLE su_sustainability_target (
    target_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    target_name             VARCHAR(200) NOT NULL,
    scope                   su_carbon_scope NOT NULL,
    dimension_scope         VARCHAR(100),
    dimension_key           VARCHAR(500),
    baseline_period_end     DATE NOT NULL,
    baseline_emissions      NUMERIC(18,6) NOT NULL,
    target_reduction_pct    NUMERIC(5,2) NOT NULL,
    target_date             DATE NOT NULL,
    emissions_unit          su_emission_unit NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by             UUID REFERENCES auth_user(user_id),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES auth_user(user_id)
);
CREATE INDEX idx_su_target_tenant ON su_sustainability_target (tenant_id) WHERE is_active;

-- Green optimization recommendations
CREATE TABLE su_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    recommendation_category VARCHAR(100) NOT NULL,
    resource_identifier     VARCHAR(1000),
    current_emissions       NUMERIC(18,6) NOT NULL,
    projected_emissions     NUMERIC(18,6) NOT NULL,
    emissions_savings       NUMERIC(18,6) GENERATED ALWAYS AS (current_emissions - projected_emissions) STORED,
    emissions_unit          su_emission_unit NOT NULL,
    cost_impact_amount      NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    confidence              opt_confidence_level NOT NULL,
    priority                opt_priority_tier NOT NULL,
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    rationale               TEXT,
    approved_by             UUID REFERENCES auth_user(user_id),
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_su_rec_tenant_status ON su_recommendation (tenant_id, status);

-- ============================================================================
-- A15 — LICENSE & SaaS AGENT
-- ============================================================================

-- Vendor registry
CREATE TABLE ls_vendor (
    vendor_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    vendor_name             VARCHAR(300) NOT NULL,
    vendor_type             VARCHAR(100),
    vendor_contact_json     JSONB,
    contract_reference      VARCHAR(200),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, vendor_name)
);
CREATE INDEX idx_ls_vendor_tenant ON ls_vendor (tenant_id) WHERE is_active;

-- License/subscription entitlements (centralized inventory)
CREATE TABLE ls_entitlement (
    entitlement_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    vendor_id               UUID NOT NULL REFERENCES ls_vendor(vendor_id),
    product_name            VARCHAR(500) NOT NULL,
    product_sku             VARCHAR(200),
    license_model           ls_license_model NOT NULL,
    entitlement_quantity    NUMERIC(18,4) NOT NULL,
    quantity_unit           VARCHAR(50) NOT NULL,
    unit_price_amount       NUMERIC(18,4) NOT NULL,
    total_annual_cost       NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    contract_start_date     DATE NOT NULL,
    contract_end_date       DATE NOT NULL,
    auto_renew              BOOLEAN NOT NULL DEFAULT FALSE,
    notice_period_days      INTEGER,
    status                  ls_entitlement_status NOT NULL DEFAULT 'Active',
    procurement_reference   VARCHAR(200),
    ingested_from           VARCHAR(100),
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ls_ent_tenant_status ON ls_entitlement (tenant_id, status);
CREATE INDEX idx_ls_ent_expiring ON ls_entitlement (contract_end_date) WHERE status = 'Active';
CREATE INDEX idx_ls_ent_vendor ON ls_entitlement (vendor_id);

-- Actual license usage measurements
CREATE TABLE ls_usage_measurement (
    measurement_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    entitlement_id          UUID NOT NULL REFERENCES ls_entitlement(entitlement_id),
    measurement_date        DATE NOT NULL,
    active_quantity         NUMERIC(18,4) NOT NULL,
    peak_quantity           NUMERIC(18,4) NOT NULL,
    utilization_pct         NUMERIC(7,4) NOT NULL,
    shelfware_quantity      NUMERIC(18,4),
    data_source             VARCHAR(200),
    measured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entitlement_id, measurement_date)
);
CREATE INDEX idx_ls_usage_tenant_date ON ls_usage_measurement (tenant_id, measurement_date DESC);
CREATE INDEX idx_ls_usage_ent_date ON ls_usage_measurement (entitlement_id, measurement_date DESC);

-- Compliance assessment
CREATE TABLE ls_compliance_check (
    check_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    entitlement_id          UUID NOT NULL REFERENCES ls_entitlement(entitlement_id),
    check_date              DATE NOT NULL,
    verdict                 ls_compliance_verdict NOT NULL,
    entitled_quantity       NUMERIC(18,4) NOT NULL,
    consumed_quantity       NUMERIC(18,4) NOT NULL,
    variance_quantity       NUMERIC(18,4) GENERATED ALWAYS AS (consumed_quantity - entitled_quantity) STORED,
    financial_exposure      NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    evidence_json           JSONB,
    checked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ls_comp_tenant_verdict ON ls_compliance_check (tenant_id, verdict, check_date DESC);
CREATE INDEX idx_ls_comp_ent ON ls_compliance_check (entitlement_id, check_date DESC);

-- License optimization recommendations
CREATE TABLE ls_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    entitlement_id          UUID REFERENCES ls_entitlement(entitlement_id),
    recommendation_category VARCHAR(100) NOT NULL,
    current_quantity        NUMERIC(18,4),
    recommended_quantity    NUMERIC(18,4),
    estimated_annual_savings NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    confidence              opt_confidence_level NOT NULL,
    priority                opt_priority_tier NOT NULL,
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    rationale               TEXT,
    action_deadline_date    DATE,
    reviewed_by             UUID REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id),
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ls_rec_tenant_status ON ls_recommendation (tenant_id, status);
CREATE INDEX idx_ls_rec_deadline ON ls_recommendation (action_deadline_date) WHERE status = 'Pending_Review';

-- ============================================================================
-- A16 — GPU OPTIMIZER AGENT
-- ============================================================================

-- GPU node inventory
CREATE TABLE go_gpu_node (
    gpu_node_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    resource_identifier     VARCHAR(1000) NOT NULL,
    provider                VARCHAR(100) NOT NULL,
    region_code             VARCHAR(100),
    gpu_model               VARCHAR(200) NOT NULL,
    gpu_count               INTEGER NOT NULL DEFAULT 1,
    total_vram_gb           NUMERIC(10,2),
    instance_type           VARCHAR(200),
    hourly_cost_amount      NUMERIC(18,6) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    mig_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    current_mig_profile     go_mig_profile,
    cluster_identifier      VARCHAR(500),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, resource_identifier)
);
CREATE INDEX idx_go_node_tenant ON go_gpu_node (tenant_id) WHERE is_active;

-- GPU utilization metrics (DCGM-sourced)
CREATE TABLE go_utilization_metric (
    metric_id               UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    gpu_node_id             UUID NOT NULL,
    mig_slice_identifier    VARCHAR(200),
    measurement_timestamp   TIMESTAMPTZ NOT NULL,
    gpu_util_pct            NUMERIC(7,4),
    sm_activity_pct         NUMERIC(7,4),
    tensor_core_activity_pct NUMERIC(7,4),
    vram_utilization_pct    NUMERIC(7,4),
    vram_used_gb            NUMERIC(10,4),
    power_draw_watts        NUMERIC(10,2),
    temperature_celsius     NUMERIC(6,2),
    nvlink_throughput_gbps  NUMERIC(10,4),
    workload_identifier     VARCHAR(500),
    workload_type           go_gpu_workload_type,
    PRIMARY KEY (metric_id, measurement_timestamp)
) PARTITION BY RANGE (measurement_timestamp);

CREATE TABLE go_utilization_metric_y2026m07 PARTITION OF go_utilization_metric
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE go_utilization_metric_y2026m08 PARTITION OF go_utilization_metric
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_go_metric_node_time ON go_utilization_metric (gpu_node_id, measurement_timestamp DESC);
CREATE INDEX idx_go_metric_tenant_time ON go_utilization_metric (tenant_id, measurement_timestamp DESC);

-- GPU workload profiles (aggregated per workload)
CREATE TABLE go_workload_profile (
    profile_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    workload_identifier     VARCHAR(500) NOT NULL,
    workload_type           go_gpu_workload_type NOT NULL,
    profile_period_start    TIMESTAMPTZ NOT NULL,
    profile_period_end      TIMESTAMPTZ NOT NULL,
    avg_gpu_util_pct        NUMERIC(7,4),
    avg_tensor_util_pct     NUMERIC(7,4),
    avg_vram_util_pct       NUMERIC(7,4),
    peak_vram_used_gb       NUMERIC(10,4),
    batch_size_typical      INTEGER,
    estimated_efficiency_score NUMERIC(5,4),
    sample_count            BIGINT NOT NULL,
    profiled_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_go_prof_tenant_workload ON go_workload_profile (tenant_id, workload_identifier);

-- GPU optimization recommendations (MIG partitioning, rightsizing, consolidation)
CREATE TABLE go_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    gpu_node_id             UUID REFERENCES go_gpu_node(gpu_node_id),
    workload_identifier     VARCHAR(500),
    recommendation_category VARCHAR(100) NOT NULL,
    current_configuration_json JSONB NOT NULL,
    recommended_configuration_json JSONB NOT NULL,
    current_mig_profile     go_mig_profile,
    recommended_mig_profile go_mig_profile,
    estimated_monthly_savings NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    carbon_savings_kgco2e   NUMERIC(18,6),
    confidence              opt_confidence_level NOT NULL,
    performance_impact      opt_performance_impact NOT NULL,
    priority                opt_priority_tier NOT NULL,
    status                  opt_recommendation_status NOT NULL DEFAULT 'Draft',
    rationale               TEXT,
    reviewed_by             UUID REFERENCES auth_user(user_id),
    approved_by             UUID REFERENCES auth_user(user_id),
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_go_rec_tenant_status ON go_recommendation (tenant_id, status);
CREATE INDEX idx_go_rec_priority ON go_recommendation (priority, estimated_monthly_savings DESC) WHERE status = 'Pending_Review';

-- GPU capacity forecast
CREATE TABLE go_capacity_forecast (
    forecast_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(tenant_id),
    forecast_horizon_days   INTEGER NOT NULL,
    forecast_date           DATE NOT NULL,
    gpu_model               VARCHAR(200),
    region_code             VARCHAR(100),
    projected_gpu_demand    NUMERIC(18,4) NOT NULL,
    projected_utilization_pct NUMERIC(7,4),
    confidence              opt_confidence_level NOT NULL,
    capacity_gap_units      NUMERIC(18,4),
    narrative_summary       TEXT,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_go_forecast_tenant_date ON go_capacity_forecast (tenant_id, forecast_date DESC);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE su_emission_measurement   ENABLE ROW LEVEL SECURITY;
ALTER TABLE su_emission_allocation    ENABLE ROW LEVEL SECURITY;
ALTER TABLE su_sustainability_target  ENABLE ROW LEVEL SECURITY;
ALTER TABLE su_recommendation         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ls_vendor                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ls_entitlement            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ls_usage_measurement      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ls_compliance_check       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ls_recommendation         ENABLE ROW LEVEL SECURITY;
ALTER TABLE go_gpu_node               ENABLE ROW LEVEL SECURITY;
ALTER TABLE go_utilization_metric     ENABLE ROW LEVEL SECURITY;
ALTER TABLE go_workload_profile       ENABLE ROW LEVEL SECURITY;
ALTER TABLE go_recommendation         ENABLE ROW LEVEL SECURITY;
ALTER TABLE go_capacity_forecast      ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_su_emis   ON su_emission_measurement  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_su_alloc  ON su_emission_allocation   USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_su_tgt    ON su_sustainability_target USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_su_rec    ON su_recommendation        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ls_vend   ON ls_vendor                USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ls_ent    ON ls_entitlement           USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ls_use    ON ls_usage_measurement     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ls_comp   ON ls_compliance_check      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_ls_rec    ON ls_recommendation        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_go_node   ON go_gpu_node              USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_go_metric ON go_utilization_metric    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_go_prof   ON go_workload_profile      USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_go_rec    ON go_recommendation        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_go_fc     ON go_capacity_forecast     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF WAVE 3b — A14 Sustainability + A15 License/SaaS + A16 GPU Optimizer
-- Tables: 14 (A14: 5, A15: 5, A16: 5 - shared grid_intensity reference)
-- Actually: A14: 5 (1 ref + 4 tenant), A15: 5, A16: 5
-- Enums: 8 new
-- Indexes: 28
-- RLS Policies: 14
-- Partitioned: su_emission_measurement, go_utilization_metric
-- Reuses opt_* enums from V015 — no duplication
-- =============================================================================
