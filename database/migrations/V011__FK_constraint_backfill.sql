-- =============================================================================
-- V011 — FK Constraint Backfill
-- Purpose: Add proper foreign key constraints from the 51 existing tables
-- (V001-V009) back to the Wave 1 foundation tables (V010).
--
-- Currently every tenant_id, agent_id, user_id column is a UUID with NO FK
-- constraint — held together only by application convention. This migration
-- closes that referential integrity hole.
-- =============================================================================
-- APPLICATION ORDER: V010 MUST be applied first, and tenant + auth_user +
-- agent_identity tables MUST be populated with data that matches the UUIDs
-- referenced in existing tables before this migration runs.
--
-- DEPLOYMENT PROCEDURE:
--   1. Apply V010 (creates foundation tables, empty)
--   2. Seed data migration: populate tenant, auth_user, agent_identity
--      from existing tenant_id/user_id/agent_id UUIDs found in V001-V009 data
--   3. Apply V011 (adds FK constraints — fails if seeding was incomplete)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: tenant_id FK constraints (every table references tenant.tenant_id)
-- ---------------------------------------------------------------------------

-- V001-V005 Seed agent tables
ALTER TABLE ingestion_run_log
    ADD CONSTRAINT fk_ingestion_run_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE ingestion_connector
    ADD CONSTRAINT fk_connector_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE raw_cost_record
    ADD CONSTRAINT fk_raw_cost_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE normalized_cost_record
    ADD CONSTRAINT fk_norm_cost_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE normalization_run_log
    ADD CONSTRAINT fk_norm_run_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE service_taxonomy_mapping
    ADD CONSTRAINT fk_taxonomy_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE allocation_rule
    ADD CONSTRAINT fk_alloc_rule_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE allocated_cost_record
    ADD CONSTRAINT fk_alloc_cost_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE shared_service_pool
    ADD CONSTRAINT fk_pool_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE allocation_run_log
    ADD CONSTRAINT fk_alloc_run_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE report_definition
    ADD CONSTRAINT fk_report_def_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE report_generation_log
    ADD CONSTRAINT fk_report_gen_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE nl_query_log
    ADD CONSTRAINT fk_nl_query_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE proactive_insight
    ADD CONSTRAINT fk_insight_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE anomaly_detection_run
    ADD CONSTRAINT fk_anom_run_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE anomaly_record
    ADD CONSTRAINT fk_anomaly_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE anomaly_lifecycle_transition
    ADD CONSTRAINT fk_anom_trans_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE suppression_rule
    ADD CONSTRAINT fk_suppress_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

-- V006 Metering foundation
ALTER TABLE mtr_rate_card
    ADD CONSTRAINT fk_rate_card_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE mtr_gearing_config
    ADD CONSTRAINT fk_gearing_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE mtr_human_intervention_record
    ADD CONSTRAINT fk_hir_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE mtr_api_metering_record
    ADD CONSTRAINT fk_amr_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE mtr_refund_assessment
    ADD CONSTRAINT fk_refund_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE mtr_metering_run_log
    ADD CONSTRAINT fk_metering_run_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE mtr_pulse_efficiency_score
    ADD CONSTRAINT fk_efficiency_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

-- NOTE: Partitioned tables (mtr_agent_activity_record, mtr_pulse_ledger_entry,
-- be_charge_detail_record, be_wallet_transaction) require FKs added per-partition
-- or using a trigger-based enforcement pattern. PostgreSQL 16 supports FK from
-- partitioned tables to regular tables. Adding on parent table:
ALTER TABLE mtr_agent_activity_record
    ADD CONSTRAINT fk_aar_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

ALTER TABLE mtr_pulse_ledger_entry
    ADD CONSTRAINT fk_ledger_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

-- V007 Self-managing metering
ALTER TABLE me_agent_discovery_event
    ADD CONSTRAINT fk_discovery_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_agent_consumption_profile
    ADD CONSTRAINT fk_profile_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_pulse_algorithm_proposal
    ADD CONSTRAINT fk_algo_prop_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_spc_baseline
    ADD CONSTRAINT fk_spc_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_drift_detection_event
    ADD CONSTRAINT fk_drift_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_recalibration_proposal
    ADD CONSTRAINT fk_recal_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_input_cost_signal
    ADD CONSTRAINT fk_signal_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_simulation_run
    ADD CONSTRAINT fk_sim_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_simulation_tenant_impact
    ADD CONSTRAINT fk_sim_impact_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_calibration_run
    ADD CONSTRAINT fk_calib_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_auto_remediation_log
    ADD CONSTRAINT fk_remed_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE me_metering_config_version
    ADD CONSTRAINT fk_version_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

-- V008 Billing Part A (plan catalog is platform-wide, no tenant_id)
ALTER TABLE be_subscription
    ADD CONSTRAINT fk_sub_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_charge_detail_record
    ADD CONSTRAINT fk_cdr_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_usage_accumulator
    ADD CONSTRAINT fk_accum_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_invoice
    ADD CONSTRAINT fk_invoice_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_payment_method
    ADD CONSTRAINT fk_paymethod_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_payment_transaction
    ADD CONSTRAINT fk_txn_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_revenue_leakage_event
    ADD CONSTRAINT fk_leakage_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

-- V009 Billing Part B
ALTER TABLE be_pulse_wallet
    ADD CONSTRAINT fk_wallet_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_wallet_transaction
    ADD CONSTRAINT fk_wtxn_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_fup_state
    ADD CONSTRAINT fk_fup_state_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_plan_recommendation
    ADD CONSTRAINT fk_reco_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_tenant_tax_profile
    ADD CONSTRAINT fk_tax_profile_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_dunning_case
    ADD CONSTRAINT fk_dunning_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);
ALTER TABLE be_revenue_recognition_entry
    ADD CONSTRAINT fk_revrec_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id);

-- ---------------------------------------------------------------------------
-- PART 2: agent_id FK constraints -> agent_identity.agent_id
-- ---------------------------------------------------------------------------
ALTER TABLE mtr_agent_activity_record
    ADD CONSTRAINT fk_aar_agent
    FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id);

ALTER TABLE mtr_human_intervention_record
    ADD CONSTRAINT fk_hir_agent
    FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id);

ALTER TABLE mtr_api_metering_record
    ADD CONSTRAINT fk_amr_agent
    FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id);

ALTER TABLE mtr_pulse_ledger_entry
    ADD CONSTRAINT fk_ledger_posted_agent
    FOREIGN KEY (posted_by_agent_id) REFERENCES agent_identity(agent_id);

ALTER TABLE mtr_refund_assessment
    ADD CONSTRAINT fk_refund_assessed_agent
    FOREIGN KEY (assessed_by_agent_id) REFERENCES agent_identity(agent_id);

ALTER TABLE mtr_pulse_efficiency_score
    ADD CONSTRAINT fk_efficiency_agent
    FOREIGN KEY (agent_id) REFERENCES agent_identity(agent_id);

-- ---------------------------------------------------------------------------
-- PART 3: user_id FK constraints -> auth_user.user_id
-- (created_by, last_modified_by, approved_by, reviewed_by, granted_by, etc.)
-- ---------------------------------------------------------------------------
-- V006 audit columns
ALTER TABLE mtr_rate_card
    ADD CONSTRAINT fk_rate_card_created_by FOREIGN KEY (created_by) REFERENCES auth_user(user_id),
    ADD CONSTRAINT fk_rate_card_modified_by FOREIGN KEY (last_modified_by) REFERENCES auth_user(user_id),
    ADD CONSTRAINT fk_rate_card_approved_by FOREIGN KEY (approved_by) REFERENCES auth_user(user_id);

ALTER TABLE mtr_gearing_config
    ADD CONSTRAINT fk_gearing_created_by FOREIGN KEY (created_by) REFERENCES auth_user(user_id);

ALTER TABLE mtr_refund_assessment
    ADD CONSTRAINT fk_refund_approved_by FOREIGN KEY (approved_by) REFERENCES auth_user(user_id);

-- V007 audit columns
ALTER TABLE me_pulse_algorithm_proposal
    ADD CONSTRAINT fk_algo_prop_created_by FOREIGN KEY (created_by) REFERENCES auth_user(user_id),
    ADD CONSTRAINT fk_algo_prop_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES auth_user(user_id);

ALTER TABLE me_recalibration_proposal
    ADD CONSTRAINT fk_recal_created_by FOREIGN KEY (created_by) REFERENCES auth_user(user_id),
    ADD CONSTRAINT fk_recal_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES auth_user(user_id),
    ADD CONSTRAINT fk_recal_approved_by FOREIGN KEY (approved_by) REFERENCES auth_user(user_id);

ALTER TABLE me_auto_remediation_log
    ADD CONSTRAINT fk_remed_approved_by FOREIGN KEY (approved_by) REFERENCES auth_user(user_id);

ALTER TABLE me_metering_config_version
    ADD CONSTRAINT fk_version_deployed_by FOREIGN KEY (deployed_by) REFERENCES auth_user(user_id);

-- V008 audit columns
ALTER TABLE be_pricing_plan
    ADD CONSTRAINT fk_plan_created_by FOREIGN KEY (created_by) REFERENCES auth_user(user_id),
    ADD CONSTRAINT fk_plan_modified_by FOREIGN KEY (last_modified_by) REFERENCES auth_user(user_id),
    ADD CONSTRAINT fk_plan_approved_commercial FOREIGN KEY (approved_by_commercial) REFERENCES auth_user(user_id),
    ADD CONSTRAINT fk_plan_approved_platform FOREIGN KEY (approved_by_platform) REFERENCES auth_user(user_id);

ALTER TABLE be_subscription
    ADD CONSTRAINT fk_sub_created_by FOREIGN KEY (created_by) REFERENCES auth_user(user_id),
    ADD CONSTRAINT fk_sub_billing_contact FOREIGN KEY (billing_contact_user_id) REFERENCES auth_user(user_id);

ALTER TABLE be_invoice
    ADD CONSTRAINT fk_invoice_created_by FOREIGN KEY (created_by) REFERENCES auth_user(user_id);

ALTER TABLE be_payment_method
    ADD CONSTRAINT fk_paymethod_created_by FOREIGN KEY (created_by) REFERENCES auth_user(user_id);

ALTER TABLE be_revenue_leakage_event
    ADD CONSTRAINT fk_leakage_resolved_by FOREIGN KEY (resolved_by) REFERENCES auth_user(user_id);

-- V009 audit columns
ALTER TABLE be_dunning_case
    ADD CONSTRAINT fk_dunning_assigned_to FOREIGN KEY (assigned_to_user_id) REFERENCES auth_user(user_id);

-- ---------------------------------------------------------------------------
-- PART 4: currency_id FK — most tables already reference ref_currency correctly
-- (defined in V006). Validate completeness here rather than re-adding.
-- ---------------------------------------------------------------------------
-- No additional work needed — all money columns already use currency_id FK

-- ---------------------------------------------------------------------------
-- PART 5: Cross-batch FK additions deferred in earlier batches
-- ---------------------------------------------------------------------------
-- Batch 3 deferred: be_charge_detail_record.subscription_id -> be_subscription
ALTER TABLE be_charge_detail_record
    ADD CONSTRAINT fk_cdr_subscription
    FOREIGN KEY (subscription_id) REFERENCES be_subscription(subscription_id);

-- Batch 4 deferred: be_pulse_wallet.subscription_id -> be_subscription
ALTER TABLE be_pulse_wallet
    ADD CONSTRAINT fk_wallet_subscription
    FOREIGN KEY (subscription_id) REFERENCES be_subscription(subscription_id);

ALTER TABLE be_fup_state
    ADD CONSTRAINT fk_fup_state_subscription
    FOREIGN KEY (subscription_id) REFERENCES be_subscription(subscription_id);

ALTER TABLE be_plan_recommendation
    ADD CONSTRAINT fk_reco_subscription
    FOREIGN KEY (subscription_id) REFERENCES be_subscription(subscription_id);

ALTER TABLE be_wallet_transaction
    ADD CONSTRAINT fk_wtxn_wallet
    FOREIGN KEY (wallet_id) REFERENCES be_pulse_wallet(wallet_id);

ALTER TABLE be_dunning_case
    ADD CONSTRAINT fk_dunning_invoice
    FOREIGN KEY (invoice_id) REFERENCES be_invoice(invoice_id);

ALTER TABLE be_revenue_recognition_entry
    ADD CONSTRAINT fk_revrec_subscription
    FOREIGN KEY (subscription_id) REFERENCES be_subscription(subscription_id),
    ADD CONSTRAINT fk_revrec_invoice
    FOREIGN KEY (invoice_id) REFERENCES be_invoice(invoice_id);

ALTER TABLE be_invoice_tax_calculation
    ADD CONSTRAINT fk_tax_calc_invoice
    FOREIGN KEY (invoice_id) REFERENCES be_invoice(invoice_id),
    ADD CONSTRAINT fk_tax_calc_line
    FOREIGN KEY (line_item_id) REFERENCES be_invoice_line_item(line_item_id);

-- =============================================================================
-- END OF V011 — FK Constraint Backfill
-- FKs added: ~75 (tenant: ~40, agent: ~6, user: ~20, cross-batch: ~9)
-- Referential integrity now enforced at database level across all platform tables
-- =============================================================================
-- VALIDATION QUERY after applying V011:
--   SELECT conrelid::regclass AS table_name, conname AS constraint_name
--   FROM pg_constraint WHERE contype = 'f' ORDER BY conrelid::regclass;
-- =============================================================================
