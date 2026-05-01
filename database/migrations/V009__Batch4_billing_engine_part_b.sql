-- =============================================================================
-- V009 — Batch 4: Billing Engine Part B (FSD-BE-01, B05-B07 + Tax/Dunning/RevRec)
-- Scope: B05 Plan Advisor, B06 Wallet Manager, B07 FUP Enforcement,
--        plus tax, dunning, and revenue recognition cross-cutting concerns
-- =============================================================================
-- DESIGN PRINCIPLES: unchanged from Batches 1-3
--   - All money composite: amount + currency_id FK to ref_currency
--   - Tenant-scoped RLS; no hardcoded org/customer/currency values
--   - Reuses: ref_currency, be_subscription, be_invoice, be_pricing_plan,
--             be_pulse_pack, mtr_agent_activity_record
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE be_wallet_status AS ENUM ('Active', 'Low_Balance', 'Depleted', 'Expired', 'Suspended', 'Frozen');
CREATE TYPE be_wallet_txn_type AS ENUM ('Top_Up', 'Debit', 'Refund', 'Adjustment', 'Expiry', 'Transfer');
CREATE TYPE be_fup_tier AS ENUM ('Unrestricted', 'Warning_80pct', 'Throttle_Tier_1', 'Throttle_Tier_2', 'Throttle_Tier_3', 'Hard_Stop');
CREATE TYPE be_recommendation_type AS ENUM ('Plan_Upgrade', 'Plan_Downgrade', 'Top_Up_Pack', 'Priority_Boost', 'Bundle_Addition', 'Feature_Activation');
CREATE TYPE be_recommendation_status AS ENUM ('Pending', 'Presented', 'Accepted', 'Rejected', 'Expired');
CREATE TYPE be_dunning_stage AS ENUM ('Current', 'Reminder_1', 'Reminder_2', 'Final_Notice', 'Collections', 'Write_Off');
CREATE TYPE be_tax_type AS ENUM ('VAT', 'GST', 'Sales_Tax', 'Withholding_Tax', 'Digital_Services_Tax', 'Exempt');
CREATE TYPE be_rev_rec_method AS ENUM ('Point_In_Time', 'Ratable', 'Usage_Based', 'Milestone');
CREATE TYPE be_rev_rec_status AS ENUM ('Deferred', 'Recognized', 'Reversed', 'Adjusted');

-- ---------------------------------------------------------------------------
-- B06 — WALLET MANAGER: Prepaid Pulse Wallets
-- ---------------------------------------------------------------------------
CREATE TABLE be_pulse_wallet (
    wallet_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    subscription_id         UUID NOT NULL,
    current_balance_pulses  NUMERIC(18,6) NOT NULL DEFAULT 0,
    reserved_pulses         NUMERIC(18,6) NOT NULL DEFAULT 0,
    available_pulses        NUMERIC(18,6) GENERATED ALWAYS AS (current_balance_pulses - reserved_pulses) STORED,
    lifetime_purchased      NUMERIC(18,6) NOT NULL DEFAULT 0,
    lifetime_consumed       NUMERIC(18,6) NOT NULL DEFAULT 0,
    low_balance_threshold   NUMERIC(18,6),
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    status                  be_wallet_status NOT NULL DEFAULT 'Active',
    last_top_up_at          TIMESTAMPTZ,
    last_debit_at           TIMESTAMPTZ,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id)
);
CREATE INDEX idx_be_wallet_tenant_status ON be_pulse_wallet (tenant_id, status);
CREATE INDEX idx_be_wallet_low_balance ON be_pulse_wallet (status) WHERE status IN ('Low_Balance', 'Depleted');

-- Top-up pack instances (purchased packs with stacking and expiry)
CREATE TABLE be_wallet_pack_instance (
    pack_instance_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id               UUID NOT NULL REFERENCES be_pulse_wallet(wallet_id),
    pack_id                 UUID NOT NULL REFERENCES be_pulse_pack(pack_id),
    purchased_pulses        NUMERIC(18,6) NOT NULL,
    remaining_pulses        NUMERIC(18,6) NOT NULL,
    price_paid_amount       NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    stacking_priority       INTEGER NOT NULL,
    activated_at            TIMESTAMPTZ NOT NULL,
    expires_at              TIMESTAMPTZ,
    depleted_at             TIMESTAMPTZ,
    invoice_id              UUID,
    payment_transaction_id  UUID,
    external_reference_id   VARCHAR(200),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_pack_inst_wallet ON be_wallet_pack_instance (wallet_id, stacking_priority);
CREATE INDEX idx_be_pack_inst_expiring ON be_wallet_pack_instance (expires_at) WHERE depleted_at IS NULL AND expires_at IS NOT NULL;

-- Wallet transaction ledger (double-entry for all wallet movements)
CREATE TABLE be_wallet_transaction (
    wallet_txn_id           UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    wallet_id               UUID NOT NULL,
    pack_instance_id        UUID,
    txn_type                be_wallet_txn_type NOT NULL,
    pulse_delta             NUMERIC(18,6) NOT NULL,
    balance_after           NUMERIC(18,6) NOT NULL,
    monetary_amount         NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    related_cdr_id          UUID,
    related_aar_id          UUID,
    related_invoice_id      UUID,
    description             VARCHAR(500),
    idempotency_key         VARCHAR(200) NOT NULL,
    posted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (wallet_txn_id, posted_at)
) PARTITION BY RANGE (posted_at);

CREATE TABLE be_wallet_transaction_y2026m07 PARTITION OF be_wallet_transaction
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE be_wallet_transaction_y2026m08 PARTITION OF be_wallet_transaction
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_be_wtxn_wallet_time ON be_wallet_transaction (wallet_id, posted_at DESC);
CREATE INDEX idx_be_wtxn_tenant_time ON be_wallet_transaction (tenant_id, posted_at DESC);
CREATE UNIQUE INDEX idx_be_wtxn_idempotency ON be_wallet_transaction (idempotency_key, posted_at);

-- ---------------------------------------------------------------------------
-- B07 — FUP ENFORCEMENT: Fair Usage Policy tier throttling
-- ---------------------------------------------------------------------------
CREATE TABLE be_fup_policy (
    fup_policy_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                 UUID NOT NULL REFERENCES be_pricing_plan(plan_id),
    threshold_pulses        NUMERIC(18,6) NOT NULL,
    warning_pct             NUMERIC(5,2) NOT NULL DEFAULT 80,
    tier_1_pct              NUMERIC(5,2) NOT NULL DEFAULT 100,
    tier_1_throttle_rate    NUMERIC(5,4) NOT NULL,
    tier_2_pct              NUMERIC(5,2) NOT NULL DEFAULT 150,
    tier_2_throttle_rate    NUMERIC(5,4) NOT NULL,
    tier_3_pct              NUMERIC(5,2) NOT NULL DEFAULT 200,
    tier_3_throttle_rate    NUMERIC(5,4) NOT NULL,
    hard_stop_pct           NUMERIC(5,2),
    reset_cycle             VARCHAR(30) NOT NULL,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, effective_from)
);
CREATE INDEX idx_be_fup_plan ON be_fup_policy (plan_id, effective_from DESC);

-- Current FUP state per subscription per cycle
CREATE TABLE be_fup_state (
    fup_state_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    subscription_id         UUID NOT NULL,
    fup_policy_id           UUID NOT NULL REFERENCES be_fup_policy(fup_policy_id),
    billing_cycle_start     DATE NOT NULL,
    billing_cycle_end       DATE NOT NULL,
    pulses_consumed         NUMERIC(18,6) NOT NULL DEFAULT 0,
    consumption_pct         NUMERIC(8,4) NOT NULL DEFAULT 0,
    current_tier            be_fup_tier NOT NULL DEFAULT 'Unrestricted',
    current_throttle_rate   NUMERIC(5,4) NOT NULL DEFAULT 1,
    warning_sent_at         TIMESTAMPTZ,
    tier_1_entered_at       TIMESTAMPTZ,
    tier_2_entered_at       TIMESTAMPTZ,
    tier_3_entered_at       TIMESTAMPTZ,
    last_evaluated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, billing_cycle_start)
);
CREATE INDEX idx_be_fup_state_tenant ON be_fup_state (tenant_id, current_tier);
CREATE INDEX idx_be_fup_state_throttled ON be_fup_state (current_tier) WHERE current_tier != 'Unrestricted';

-- ---------------------------------------------------------------------------
-- B05 — PLAN ADVISOR: ML-driven upsell/cross-sell recommendations
-- ---------------------------------------------------------------------------
CREATE TABLE be_plan_recommendation (
    recommendation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    subscription_id         UUID NOT NULL,
    recommendation_type     be_recommendation_type NOT NULL,
    current_plan_id         UUID REFERENCES be_pricing_plan(plan_id),
    recommended_plan_id     UUID REFERENCES be_pricing_plan(plan_id),
    recommended_pack_id     UUID REFERENCES be_pulse_pack(pack_id),
    rationale               TEXT NOT NULL,
    usage_pattern_json      JSONB,
    projected_savings       NUMERIC(18,4),
    projected_revenue_uplift NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    confidence_score        NUMERIC(5,4),
    status                  be_recommendation_status NOT NULL DEFAULT 'Pending',
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    presented_at            TIMESTAMPTZ,
    responded_at            TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,
    response_outcome        VARCHAR(200),
    external_reference_id   VARCHAR(200)
);
CREATE INDEX idx_be_reco_tenant_status ON be_plan_recommendation (tenant_id, status);
CREATE INDEX idx_be_reco_active ON be_plan_recommendation (expires_at) WHERE status = 'Pending';

-- ---------------------------------------------------------------------------
-- TAX ENGINE (cross-cutting — applied during invoicing)
-- ---------------------------------------------------------------------------
CREATE TABLE be_tax_jurisdiction (
    jurisdiction_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code            CHAR(2) NOT NULL,
    region_code             VARCHAR(10),
    jurisdiction_name       VARCHAR(200) NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (country_code, region_code)
);

CREATE TABLE be_tax_rule (
    tax_rule_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id         UUID NOT NULL REFERENCES be_tax_jurisdiction(jurisdiction_id),
    tax_type                be_tax_type NOT NULL,
    tax_name                VARCHAR(200) NOT NULL,
    rate_percentage         NUMERIC(7,4) NOT NULL,
    applies_to_charge_types TEXT[],
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_tax_rule_juris ON be_tax_rule (jurisdiction_id, effective_from DESC);

CREATE TABLE be_tenant_tax_profile (
    tax_profile_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    jurisdiction_id         UUID NOT NULL REFERENCES be_tax_jurisdiction(jurisdiction_id),
    tax_registration_number VARCHAR(100),
    is_tax_exempt           BOOLEAN NOT NULL DEFAULT FALSE,
    exemption_certificate   VARCHAR(500),
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, jurisdiction_id, effective_from)
);
CREATE INDEX idx_be_tax_profile_tenant ON be_tenant_tax_profile (tenant_id);

-- Tax calculations per invoice line (audit trail)
CREATE TABLE be_invoice_tax_calculation (
    tax_calc_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_item_id            UUID NOT NULL,
    invoice_id              UUID NOT NULL,
    tax_rule_id             UUID NOT NULL REFERENCES be_tax_rule(tax_rule_id),
    taxable_amount          NUMERIC(18,4) NOT NULL,
    tax_rate                NUMERIC(7,4) NOT NULL,
    tax_amount              NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_tax_calc_invoice ON be_invoice_tax_calculation (invoice_id);

-- ---------------------------------------------------------------------------
-- DUNNING & COLLECTIONS (cross-cutting — B03 invoice overdue handling)
-- ---------------------------------------------------------------------------
CREATE TABLE be_dunning_policy (
    dunning_policy_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name             VARCHAR(200) NOT NULL,
    reminder_1_days         INTEGER NOT NULL,
    reminder_2_days         INTEGER NOT NULL,
    final_notice_days       INTEGER NOT NULL,
    collections_days        INTEGER NOT NULL,
    write_off_days          INTEGER NOT NULL,
    late_fee_percentage     NUMERIC(5,4),
    late_fee_flat_amount    NUMERIC(18,4),
    currency_id             UUID REFERENCES ref_currency(currency_id),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE be_dunning_case (
    dunning_case_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    invoice_id              UUID NOT NULL,
    dunning_policy_id       UUID NOT NULL REFERENCES be_dunning_policy(dunning_policy_id),
    current_stage           be_dunning_stage NOT NULL DEFAULT 'Current',
    days_overdue            INTEGER NOT NULL DEFAULT 0,
    outstanding_amount      NUMERIC(18,4) NOT NULL,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    stage_entered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_action_at          TIMESTAMPTZ,
    last_action_type        VARCHAR(100),
    resolved_at             TIMESTAMPTZ,
    resolution_type         VARCHAR(50),
    assigned_to_user_id     UUID,
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_dunning_tenant_stage ON be_dunning_case (tenant_id, current_stage);
CREATE INDEX idx_be_dunning_overdue ON be_dunning_case (days_overdue DESC) WHERE resolved_at IS NULL;

-- Dunning actions log (reminders sent, escalations)
CREATE TABLE be_dunning_action_log (
    action_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dunning_case_id         UUID NOT NULL REFERENCES be_dunning_case(dunning_case_id),
    action_type             VARCHAR(100) NOT NULL,
    channel                 VARCHAR(50) NOT NULL,
    recipient_user_id       UUID,
    message_template        VARCHAR(200),
    sent_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_status         VARCHAR(30)
);
CREATE INDEX idx_be_dunning_action_case ON be_dunning_action_log (dunning_case_id, sent_at DESC);

-- ---------------------------------------------------------------------------
-- REVENUE RECOGNITION (cross-cutting — IFRS 15 / ASC 606 compliance)
-- ---------------------------------------------------------------------------
CREATE TABLE be_revenue_recognition_entry (
    rev_rec_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    subscription_id         UUID NOT NULL,
    invoice_id              UUID,
    line_item_id            UUID,
    recognition_method      be_rev_rec_method NOT NULL,
    total_contract_amount   NUMERIC(18,4) NOT NULL,
    recognized_amount       NUMERIC(18,4) NOT NULL DEFAULT 0,
    deferred_amount         NUMERIC(18,4) GENERATED ALWAYS AS (total_contract_amount - recognized_amount) STORED,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    recognition_period_start DATE NOT NULL,
    recognition_period_end  DATE NOT NULL,
    status                  be_rev_rec_status NOT NULL DEFAULT 'Deferred',
    accounting_period       VARCHAR(7),
    gl_account_code         VARCHAR(50),
    created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_modified_date      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_be_revrec_tenant ON be_revenue_recognition_entry (tenant_id, accounting_period);
CREATE INDEX idx_be_revrec_status ON be_revenue_recognition_entry (status, recognition_period_end);

CREATE TABLE be_revenue_recognition_schedule (
    schedule_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rev_rec_id              UUID NOT NULL REFERENCES be_revenue_recognition_entry(rev_rec_id) ON DELETE CASCADE,
    recognition_date        DATE NOT NULL,
    scheduled_amount        NUMERIC(18,4) NOT NULL,
    recognized_amount       NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency_id             UUID NOT NULL REFERENCES ref_currency(currency_id),
    is_recognized           BOOLEAN NOT NULL DEFAULT FALSE,
    recognized_at           TIMESTAMPTZ,
    accounting_period       VARCHAR(7) NOT NULL
);
CREATE INDEX idx_be_revrec_sched_date ON be_revenue_recognition_schedule (recognition_date) WHERE NOT is_recognized;
CREATE INDEX idx_be_revrec_sched_entry ON be_revenue_recognition_schedule (rev_rec_id);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE be_pulse_wallet                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_wallet_pack_instance            ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_wallet_transaction              ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_fup_state                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_plan_recommendation             ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_tenant_tax_profile              ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_dunning_case                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE be_revenue_recognition_entry       ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_be_wallet       ON be_pulse_wallet              USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_pack_inst    ON be_wallet_pack_instance      USING (EXISTS (SELECT 1 FROM be_pulse_wallet w WHERE w.wallet_id = be_wallet_pack_instance.wallet_id AND w.tenant_id = current_setting('app.current_tenant_id')::UUID));
CREATE POLICY tenant_iso_be_wtxn         ON be_wallet_transaction        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_fup_state    ON be_fup_state                 USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_reco         ON be_plan_recommendation       USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_tax_profile  ON be_tenant_tax_profile        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_dunning      ON be_dunning_case              USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_iso_be_revrec       ON be_revenue_recognition_entry USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- END OF BATCH 4 — Billing Engine Part B (B05-B07 + Tax/Dunning/RevRec)
-- Tables: 16 (B06:3, B07:2, B05:1, Tax:4, Dunning:3, RevRec:2, plus FUP policy)
-- Enums: 9 new
-- Indexes: 24
-- RLS Policies: 8
-- Partitioned: be_wallet_transaction (monthly by posted_at)
-- ZERO hardcoded currencies/orgs — all config-driven
-- =============================================================================
-- TOTAL ACROSS BATCHES 1-4:
--   Tables: 51  | Enums: 31  | Indexes: 101  | RLS Policies: 41
--   Partitioned: 3 tables (AAR, Pulse Ledger, Wallet Txn, CDR)
-- =============================================================================
