-- =============================================================================
-- V008 — Batch 3: Billing Engine Part A (FSD-BE-01, B01-B04)
-- Scope: B01 Plan Catalog, B02 Rating Engine, B03 Invoice Agent, B04 Revenue Guardian
-- =============================================================================
-- DESIGN PRINCIPLES (continued — see V006 Batch 1 for full list):
--   - All money composite: amount + currency_id FK to ref_currency
--   - Tenant-scoped RLS; no hardcoded org/customer names
--   - Reuses ref_currency, platform_config from Batch 1
--   - BSS-style model: Plans -> Subscriptions -> CDRs -> Invoices -> Payments
--   - Supports prepaid + postpaid, FUP, credit limits, dispute lifecycle
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE be_billing_mode AS ENUM ('Prepaid', 'Postpaid', 'Hybrid');
CREATE TYPE be_billing_cycle AS ENUM ('Monthly', 'Bi_Monthly', 'Quarterly', 'Annual', 'On_Demand');
CREATE TYPE be_plan_status AS ENUM ('Draft', 'Active', 'Deprecated', 'Retired');
CREATE TYPE be_subscription_status AS ENUM ('Pending', 'Active', 'Suspended', 'Cancelled', 'Expired');
CREATE TYPE be_charge_type AS ENUM ('Committed_Bundle', 'Overage', 'Burst', 'HIU', 'API_Metered', 'Adjustment', 'Refund', 'Tax');
CREATE TYPE be_cdr_status AS ENUM ('Rated', 'Pending_Rerate', 'Disputed', 'Voided');
CREATE TYPE be_invoice_status AS ENUM ('Draft', 'Issued', 'Paid', 'Partial', 'Overdue', 'Disputed', 'Void', 'Refunded');
CREATE TYPE be_payment_status AS ENUM ('Pending', 'Authorized', 'Captured', 'Failed', 'Refunded', 'Partially_Refunded');
CREATE TYPE be_revenue_leakage_type AS ENUM ('Unbilled_Usage', 'Rating_Error', 'Missing_AAR', 'Duplicate_Charge', 'Price_Mismatch', 'FX_Discrepancy');

-- ---------------------------------------------------------------------------
-- B01 — PLAN CATALOG
-- ---------------------------------------------------------------------------
CREATE TABLE be_pricing_plan (
    plan_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code               VARCHAR(100) NOT NULL UNIQUE,
    plan_name               VARCHAR(200) NOT NULL,
    description             TEXT,
    billing_mode            be_billing_mode NOT NULL,
    billing_cycle           be_billing_cycle NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    base_fee_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    committed_pulse_bundle  NUMERIC(18,6),
    committed_bundle_price  NUMERIC(18,4),
    overage_rate_amount     NUMERIC(18,6) NOT NULL,
    burst_multiplier        NUMERIC(6,4) NOT NULL DEFAULT 1,
    fup_threshold_pulses    NUMERIC(18,6),
    fup_overage_rate        NUMERIC(18,6),
    hiu_rate_amount         NUMERIC(18,4),
    credit_limit_amount     NUMERIC(18,4),
    payment_terms_days      INTEGER,
    status                  be_plan_status NOT NULL DEFAULT 'Draft',
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    approved_by_commercial  UUID,
    approved_by_platform    UUID,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL,
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_by        UUID NOT NULL,
    CONSTRAINT ck_plan_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX idx_be_plan_status ON be_pricing_plan (status, effective_from DESC);
CREATE INDEX idx_be_plan_currency ON be_pricing_plan (currency_id);

-- Pricing tiers (volume discounts within a plan)
CREATE TABLE be_pricing_tier (
    tier_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                 UUID NOT NULL REFERENCES be_pricing_plan(plan_id) ON DELETE CASCADE,
    tier_sequence           INTEGER NOT NULL,
    pulse_from              NUMERIC(18,6) NOT NULL,
    pulse_to                NUMERIC(18,6),
    unit_rate_amount        NUMERIC(18,6) NOT NULL,
    discount_pct            NUMERIC(5,4) DEFAULT 0,
    UNIQUE (plan_id, tier_sequence)
);
CREATE INDEX idx_be_tier_plan ON be_pricing_tier (plan_id, tier_sequence);

-- Top-up / pulse pack catalog (prepaid)
CREATE TABLE be_pulse_pack (
    pack_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                 UUID REFERENCES be_pricing_plan(plan_id),
    pack_code               VARCHAR(100) NOT NULL UNIQUE,
    pack_name               VARCHAR(200) NOT NULL,
    pulse_quantity          NUMERIC(18,6) NOT NULL,
    price_amount            NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    validity_days           INTEGER,
    stacking_priority       INTEGER NOT NULL DEFAULT 100,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_pack_active ON be_pulse_pack (is_active, stacking_priority);

-- Subscriptions link tenants to plans
CREATE TABLE be_subscription (
    subscription_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    plan_id                 UUID NOT NULL REFERENCES be_pricing_plan(plan_id),
    status                  be_subscription_status NOT NULL DEFAULT 'Pending',
    activation_date         DATE,
    cancellation_date       DATE,
    next_billing_date       DATE,
    current_credit_balance  NUMERIC(18,4) NOT NULL DEFAULT 0,
    current_pulse_balance   NUMERIC(18,6) NOT NULL DEFAULT 0,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    credit_limit_used       NUMERIC(18,4) NOT NULL DEFAULT 0,
    billing_contact_user_id UUID,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL,
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_sub_tenant ON be_subscription (tenant_id) WHERE status = 'Active';
CREATE INDEX idx_be_sub_next_billing ON be_subscription (next_billing_date) WHERE status = 'Active';

-- ---------------------------------------------------------------------------
-- B02 — RATING ENGINE: Charge Detail Records (CDRs)
-- Partitioned by rated_at for high-volume time-series
-- ---------------------------------------------------------------------------
CREATE TABLE be_charge_detail_record (
    cdr_id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    subscription_id         UUID NOT NULL,
    aar_id                  UUID,
    aar_operation_end_ts    TIMESTAMPTZ,
    charge_type             be_charge_type NOT NULL,
    pulse_quantity          NUMERIC(18,6) NOT NULL,
    unit_rate_amount        NUMERIC(18,6) NOT NULL,
    gross_charge_amount     NUMERIC(18,4) NOT NULL,
    discount_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_charge_amount       NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    applied_plan_id         UUID NOT NULL REFERENCES be_pricing_plan(plan_id),
    applied_tier_id         UUID REFERENCES be_pricing_tier(tier_id),
    applied_pack_id         UUID REFERENCES be_pulse_pack(pack_id),
    rating_method           VARCHAR(50) NOT NULL,
    status                  be_cdr_status NOT NULL DEFAULT 'Rated',
    billing_period          DATE NOT NULL,
    invoice_id              UUID,
    rated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rating_version          VARCHAR(50),
    external_reference_id   VARCHAR(200),
    PRIMARY KEY (cdr_id, rated_at)
) PARTITION BY RANGE (rated_at);

CREATE TABLE be_charge_detail_record_y2026m07 PARTITION OF be_charge_detail_record
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE be_charge_detail_record_y2026m08 PARTITION OF be_charge_detail_record
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_be_cdr_tenant_period ON be_charge_detail_record (tenant_id, billing_period);
CREATE INDEX idx_be_cdr_sub_period ON be_charge_detail_record (subscription_id, billing_period);
CREATE INDEX idx_be_cdr_invoice ON be_charge_detail_record (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_be_cdr_aar ON be_charge_detail_record (aar_id) WHERE aar_id IS NOT NULL;
CREATE INDEX idx_be_cdr_status ON be_charge_detail_record (status) WHERE status != 'Rated';

-- Usage accumulator (running pulse counters per tenant per period)
CREATE TABLE be_usage_accumulator (
    accumulator_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    subscription_id         UUID NOT NULL,
    billing_period          DATE NOT NULL,
    committed_pulses_used   NUMERIC(18,6) NOT NULL DEFAULT 0,
    overage_pulses          NUMERIC(18,6) NOT NULL DEFAULT 0,
    burst_pulses            NUMERIC(18,6) NOT NULL DEFAULT 0,
    hiu_total               NUMERIC(18,6) NOT NULL DEFAULT 0,
    gross_charge_accrued    NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    last_updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, billing_period)
);
CREATE INDEX idx_be_accum_tenant_period ON be_usage_accumulator (tenant_id, billing_period);

-- ---------------------------------------------------------------------------
-- B03 — INVOICE AGENT
-- ---------------------------------------------------------------------------
CREATE TABLE be_invoice (
    invoice_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number          VARCHAR(50) NOT NULL UNIQUE,
    tenant_id               UUID NOT NULL,
    subscription_id         UUID NOT NULL REFERENCES be_subscription(subscription_id),
    billing_period_start    DATE NOT NULL,
    billing_period_end      DATE NOT NULL,
    issue_date              DATE NOT NULL,
    due_date                DATE NOT NULL,
    subtotal_amount         NUMERIC(18,4) NOT NULL,
    tax_amount              NUMERIC(18,4) NOT NULL DEFAULT 0,
    discount_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_amount            NUMERIC(18,4) NOT NULL,
    amount_paid             NUMERIC(18,4) NOT NULL DEFAULT 0,
    amount_outstanding      NUMERIC(18,4) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    status                  be_invoice_status NOT NULL DEFAULT 'Draft',
    pdf_storage_url         TEXT,
    distribution_channels   TEXT[],
    distributed_at          TIMESTAMPTZ,
    viewed_at               TIMESTAMPTZ,
    dispute_reason          TEXT,
    dispute_opened_at       TIMESTAMPTZ,
    dispute_resolved_at     TIMESTAMPTZ,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL
);
CREATE INDEX idx_be_invoice_tenant_status ON be_invoice (tenant_id, status);
CREATE INDEX idx_be_invoice_due ON be_invoice (due_date) WHERE status IN ('Issued', 'Partial', 'Overdue');
CREATE INDEX idx_be_invoice_period ON be_invoice (tenant_id, billing_period_start DESC);

CREATE TABLE be_invoice_line_item (
    line_item_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id              UUID NOT NULL REFERENCES be_invoice(invoice_id) ON DELETE CASCADE,
    line_sequence           INTEGER NOT NULL,
    charge_type             be_charge_type NOT NULL,
    description             VARCHAR(500) NOT NULL,
    quantity                NUMERIC(18,6) NOT NULL,
    unit_rate_amount        NUMERIC(18,6) NOT NULL,
    gross_amount            NUMERIC(18,4) NOT NULL,
    discount_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_amount              NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_amount              NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    source_cdr_ids          UUID[],
    UNIQUE (invoice_id, line_sequence)
);
CREATE INDEX idx_be_line_invoice ON be_invoice_line_item (invoice_id);

-- Payment methods (tokenized, no raw PAN)
CREATE TABLE be_payment_method (
    payment_method_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    method_type             VARCHAR(50) NOT NULL,
    provider_name           VARCHAR(100) NOT NULL,
    provider_token          VARCHAR(500) NOT NULL,
    display_label           VARCHAR(200),
    is_default              BOOLEAN NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    expiry_month            SMALLINT,
    expiry_year             SMALLINT,
    currency_id             UUID REFERENCES ref_currency(currency_id),
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL
);
CREATE INDEX idx_be_paymethod_tenant ON be_payment_method (tenant_id) WHERE is_active;

-- Payment transactions
CREATE TABLE be_payment_transaction (
    transaction_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    invoice_id              UUID REFERENCES be_invoice(invoice_id),
    payment_method_id       UUID REFERENCES be_payment_method(payment_method_id),
    amount                  NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    status                  be_payment_status NOT NULL DEFAULT 'Pending',
    provider_transaction_id VARCHAR(500),
    provider_response       JSONB,
    authorized_at           TIMESTAMPTZ,
    captured_at             TIMESTAMPTZ,
    failed_at               TIMESTAMPTZ,
    failure_reason          VARCHAR(500),
    refund_of_transaction   UUID REFERENCES be_payment_transaction(transaction_id),
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_txn_tenant_time ON be_payment_transaction (tenant_id, created_date DESC);
CREATE INDEX idx_be_txn_invoice ON be_payment_transaction (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_be_txn_status ON be_payment_transaction (status) WHERE status IN ('Pending', 'Authorized');

-- ---------------------------------------------------------------------------
-- B04 — REVENUE GUARDIAN: leakage detection + reconciliation
-- ---------------------------------------------------------------------------
CREATE TABLE be_revenue_leakage_event (
    leakage_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    leakage_type            be_revenue_leakage_type NOT NULL,
    severity                VARCHAR(20) NOT NULL,
    detected_amount         NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    related_aar_id          UUID,
    related_cdr_id          UUID,
    related_invoice_id      UUID,
    description             TEXT NOT NULL,
    evidence                JSONB,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Open',
    resolution_action       VARCHAR(200),
    resolved_by             UUID,
    resolved_at             TIMESTAMPTZ,
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_leakage_tenant_status ON be_revenue_leakage_event (tenant_id, status);
CREATE INDEX idx_be_leakage_severity ON be_revenue_leakage_event (severity, detected_at DESC);

CREATE TABLE be_reconciliation_run (
    reconciliation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID,
    run_scope               VARCHAR(50) NOT NULL,
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    aars_compared           BIGINT NOT NULL,
    cdrs_compared           BIGINT NOT NULL,
    invoices_compared       BIGINT NOT NULL,
    aar_to_cdr_variance     NUMERIC(18,4) NOT NULL DEFAULT 0,
    cdr_to_invoice_variance NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_variance_amount   NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency_id             UUID REFERENCES ref_currency(currency_id),
    leakage_events_raised   INTEGER NOT NULL DEFAULT 0,
    run_started_at          TIMESTAMPTZ NOT NULL,
    run_completed_at        TIMESTAMPTZ,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Running',
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_recon_time ON be_reconciliation_run (run_started_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE be_pricing_plan           ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_pricing_tier           ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_pulse_pack             ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_subscription           ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_charge_detail_record   ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_usage_accumulator      ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_invoice                ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_invoice_line_item      ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_payment_method         ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_payment_transaction    ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_revenue_leakage_event  ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_reconciliation_run     ENABLE ROW LEVEL SECURITY;

-- Plan catalog is platform-wide (not tenant-scoped) — only subscription data needs RLS
CREATE POLICY tenant_iso_be_sub        ON be_subscription          USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_cdr        ON be_charge_detail_record  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_accum      ON be_usage_accumulator     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_invoice    ON be_invoice               USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_line       ON be_invoice_line_item     USING (EXISTS (SELECT 1 FROM be_invoice i WHERE i.invoice_id = be_invoice_line_item.invoice_id AND i.tenant_id = current_setting('app.current_tenant_id')::UUID));
CREATE POLICY tenant_iso_be_paymethod  ON be_payment_method        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_txn        ON be_payment_transaction   USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_leakage    ON be_revenue_leakage_event USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Plan catalog, tier, pack: globally readable (no tenant filter) but write-restricted via application role
CREATE POLICY platform_read_plans ON be_pricing_plan FOR SELECT USING (TRUE);
CREATE POLICY platform_read_tiers ON be_pricing_tier FOR SELECT USING (TRUE);
CREATE POLICY platform_read_packs ON be_pulse_pack    FOR SELECT USING (TRUE);
CREATE POLICY platform_read_recon ON be_reconciliation_run FOR SELECT USING (TRUE);

-- =============================================================================
-- END OF BATCH 3 — Billing Engine Part A (B01-B04)
-- Tables: 12 (B01:4, B02:2, B03:4, B04:2)
-- Enums: 9
-- Indexes: 24
-- RLS Policies: 12
-- Partitioned: be_charge_detail_record (monthly by rated_at)
-- ZERO hardcoded currencies or org references; all monetary via currency_id FK
-- =============================================================================
