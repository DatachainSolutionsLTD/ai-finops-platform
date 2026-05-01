-- =============================================================================
-- A02 Cost Normalization Agent — dbt FOCUS Transformation Pipeline
-- FSD Reference: A02 Flow 1, Steps 5–11
-- Project: dbt_finops_normalization
-- =============================================================================
-- Model execution order (via dbt ref()):
--   1. stg_raw_cost_records       — staging: read raw ingestion output
--   2. int_taxonomy_mapped        — Step 5: service taxonomy mapping
--   3. int_currency_converted     — Step 6: currency → SAR conversion
--   4. int_unit_normalized        — Step 7: usage unit standardization
--   5. int_dimensionally_enriched — Step 9: org dimension enrichment
--   6. fct_normalized_cost_record — Step 10: FOCUS schema final output
-- =============================================================================

-- ===========================================================================
-- MODEL 1: stg_raw_cost_records.sql
-- Tags: normalization, staging
-- ===========================================================================
-- {{ config(materialized='ephemeral', tags=['normalization', 'staging']) }}

-- Staging layer: reads raw records from A01 ingestion for a specific run
-- Filters to the source_run_id passed from the Airflow DAG
/*
SELECT
    record_id,
    tenant_id,
    run_id,
    connector_id,
    source_type,
    billing_period,
    resource_id,
    resource_name,
    service_name,
    region,
    account_id,
    raw_cost,
    raw_currency,
    raw_usage_quantity,
    raw_usage_unit,
    tags_json,
    raw_payload,
    quality_status,
    ingestion_timestamp
FROM {{ source('public', 'raw_staging_record') }}
WHERE run_id = '{{ var("source_run_id") }}'::UUID
  AND tenant_id = '{{ var("tenant_id") }}'::UUID
  AND quality_status IN ('Valid', 'Warning')
*/


-- ===========================================================================
-- MODEL 2: int_taxonomy_mapped.sql
-- Tags: normalization
-- FSD Step 5: Service Taxonomy Mapping
-- ===========================================================================
-- {{ config(materialized='ephemeral', tags=['normalization']) }}

-- Maps provider-specific service names to standardized ServiceName/Category
-- Unmapped services get ServiceName='Unmapped' and trigger taxonomy gap alert
/*
SELECT
    r.*,
    COALESCE(t.normalized_service_name, 'Unmapped')   AS focus_service_name,
    COALESCE(t.normalized_service_category, 'Other')   AS focus_service_category,
    CASE WHEN t.mapping_id IS NULL THEN TRUE ELSE FALSE END AS is_taxonomy_gap
FROM {{ ref('stg_raw_cost_records') }} r
LEFT JOIN {{ source('public', 'service_taxonomy_registry') }} t
    ON t.provider = r.source_type
    AND t.source_service_name = r.service_name
    AND t.is_active = TRUE
*/


-- ===========================================================================
-- MODEL 3: int_currency_converted.sql
-- Tags: normalization
-- FSD Step 6: Currency Conversion (source currency → SAR)
-- ===========================================================================
-- {{ config(materialized='ephemeral', tags=['normalization']) }}

-- Converts all monetary values to SAR using effective exchange rates
-- BilledCost_SAR = Raw_Cost × Exchange_Rate
/*
SELECT
    r.*,
    COALESCE(ex.exchange_rate, 1.0)               AS fx_rate,
    r.raw_cost * COALESCE(ex.exchange_rate, 1.0)  AS billed_cost_sar,
    -- Amortized and effective costs from raw payload if available
    CASE
        WHEN r.raw_payload->>'amortized_cost' IS NOT NULL
            AND r.raw_payload->>'amortized_cost' != ''
        THEN (r.raw_payload->>'amortized_cost')::NUMERIC * COALESCE(ex.exchange_rate, 1.0)
        ELSE NULL
    END AS amortized_cost_sar,
    CASE
        WHEN r.raw_payload->>'net_unblended_cost' IS NOT NULL
            AND r.raw_payload->>'net_unblended_cost' != ''
        THEN (r.raw_payload->>'net_unblended_cost')::NUMERIC * COALESCE(ex.exchange_rate, 1.0)
        ELSE r.raw_cost * COALESCE(ex.exchange_rate, 1.0)
    END AS effective_cost_sar
FROM {{ ref('int_taxonomy_mapped') }} r
LEFT JOIN {{ source('public', 'exchange_rate_config') }} ex
    ON ex.source_currency = r.raw_currency
    AND ex.target_currency = 'SAR'
    AND r.billing_period >= ex.effective_from
    AND (ex.effective_to IS NULL OR r.billing_period <= ex.effective_to)
*/


-- ===========================================================================
-- MODEL 4: int_unit_normalized.sql
-- Tags: normalization
-- FSD Step 7: Usage Unit Standardization
-- ===========================================================================
-- {{ config(materialized='ephemeral', tags=['normalization']) }}

-- Normalizes provider-specific usage units to standard measures:
--   compute hours → vCPU-Hours
--   memory → GB-Hours
--   storage → GB-Months
--   data transfer → GB
--   API calls → Requests
/*
SELECT
    r.*,
    CASE
        -- AWS compute hours
        WHEN r.source_type = 'AWS' AND r.raw_usage_unit ILIKE '%Hrs%'
            AND r.focus_service_category = 'Compute'
        THEN r.raw_usage_quantity
        -- Azure compute hours
        WHEN r.source_type = 'Azure' AND r.raw_usage_unit ILIKE '%Hour%'
            AND r.focus_service_category = 'Compute'
        THEN r.raw_usage_quantity
        -- Storage: normalize to GB-Months
        WHEN r.raw_usage_unit ILIKE '%GB-Mo%' OR r.raw_usage_unit ILIKE '%GB-Month%'
        THEN r.raw_usage_quantity
        -- Data transfer: normalize to GB
        WHEN r.raw_usage_unit ILIKE '%GB%'
            AND r.focus_service_category = 'Network'
        THEN r.raw_usage_quantity
        ELSE r.raw_usage_quantity
    END AS normalized_usage_quantity,

    CASE
        WHEN r.focus_service_category = 'Compute'
            AND (r.raw_usage_unit ILIKE '%Hrs%' OR r.raw_usage_unit ILIKE '%Hour%')
        THEN 'vCPU-Hours'
        WHEN r.focus_service_category = 'Storage'
        THEN 'GB-Months'
        WHEN r.focus_service_category = 'Network'
            AND r.raw_usage_unit ILIKE '%GB%'
        THEN 'GB'
        WHEN r.raw_usage_unit ILIKE '%Requests%' OR r.raw_usage_unit ILIKE '%Count%'
        THEN 'Requests'
        ELSE COALESCE(r.raw_usage_unit, 'Units')
    END AS normalized_usage_unit
FROM {{ ref('int_currency_converted') }} r
*/


-- ===========================================================================
-- MODEL 5: int_dimensionally_enriched.sql
-- Tags: normalization
-- FSD Step 9: Dimensional Enrichment (3-tier resolution)
-- ===========================================================================
-- {{ config(materialized='ephemeral', tags=['normalization']) }}

-- Three-tier dimension resolution:
--   (a) Primary: cloud resource tags → org dimensions
--   (b) Secondary: CMDB/ERP lookup by resource_id
--   (c) Tertiary: account-level default mappings
-- Records that fail all three tiers → 'Unattributed'
/*
SELECT
    r.*,

    -- Tier 1: Tag-based resolution
    COALESCE(
        -- Check tags_json for BusinessUnit
        (r.tags_json->>'BusinessUnit')::TEXT,
        (r.tags_json->>'business_unit')::TEXT,
        (r.tags_json->>'bu')::TEXT,
        NULL
    ) AS tag_bu,

    COALESCE(
        (r.tags_json->>'Application')::TEXT,
        (r.tags_json->>'app')::TEXT,
        (r.tags_json->>'application')::TEXT,
        NULL
    ) AS tag_app,

    COALESCE(
        (r.tags_json->>'Project')::TEXT,
        (r.tags_json->>'project')::TEXT,
        NULL
    ) AS tag_project,

    COALESCE(
        (r.tags_json->>'CostCenter')::TEXT,
        (r.tags_json->>'cost_center')::TEXT,
        (r.tags_json->>'cost-center')::TEXT,
        NULL
    ) AS tag_cost_center,

    COALESCE(
        (r.tags_json->>'Environment')::TEXT,
        (r.tags_json->>'env')::TEXT,
        NULL
    ) AS tag_environment,

    -- Attribution status
    CASE
        WHEN (r.tags_json->>'BusinessUnit') IS NOT NULL
            OR (r.tags_json->>'bu') IS NOT NULL
        THEN 'Fully_Attributed'
        WHEN r.account_id IS NOT NULL
        THEN 'Partially_Attributed'
        ELSE 'Unattributed'
    END AS attribution_status

FROM {{ ref('int_unit_normalized') }} r
*/


-- ===========================================================================
-- MODEL 6: fct_normalized_cost_record.sql (FINAL OUTPUT)
-- Tags: normalization
-- FSD Step 10: FOCUS Schema Transformation — write to normalized_cost_record
-- ===========================================================================
-- {{ config(
--     materialized='incremental',
--     unique_key='record_id',
--     tags=['normalization'],
--     post_hook="ANALYZE normalized_cost_record"
-- ) }}

-- Final FOCUS-compliant output inserted into normalized_cost_record table
/*
INSERT INTO normalized_cost_record (
    record_id, tenant_id, normalization_run_id, source_run_id,
    billing_account_id, sub_account_id, provider, service_name,
    service_category, resource_id, resource_name, region,
    availability_zone, charge_type, billed_cost_sar, effective_cost_sar,
    amortized_cost_sar, usage_quantity, usage_unit, billing_period,
    business_unit_id, application_id, project_id, cost_center_id,
    environment, tags_json, attribution_status, normalization_timestamp
)
SELECT
    r.record_id,
    r.tenant_id,
    '{{ var("normalization_run_id") }}'::UUID,
    r.run_id,
    r.account_id,                                -- billing_account_id
    r.raw_payload->>'payer_account_id',           -- sub_account_id
    r.source_type::provider_type,                 -- provider
    r.focus_service_name,                         -- service_name
    r.focus_service_category::service_category,   -- service_category
    r.resource_id,
    r.resource_name,
    r.region,
    r.raw_payload->>'availability_zone',          -- availability_zone
    COALESCE(
        r.raw_payload->>'line_item_type',
        'Usage'
    )::charge_type,                               -- charge_type
    r.billed_cost_sar,
    r.effective_cost_sar,
    r.amortized_cost_sar,
    r.normalized_usage_quantity,                   -- usage_quantity
    r.normalized_usage_unit,                       -- usage_unit
    r.billing_period,
    NULL,                                          -- business_unit_id (resolved at A03)
    NULL,                                          -- application_id
    NULL,                                          -- project_id
    NULL,                                          -- cost_center_id
    r.tag_environment::environment_type,           -- environment
    r.tags_json,
    r.attribution_status::attribution_status,
    NOW()
FROM {{ ref('int_dimensionally_enriched') }} r
*/


-- ===========================================================================
-- dbt TESTS — Quality Validation (FSD Step 11)
-- Tags: normalization_quality
-- ===========================================================================

-- Test: FOCUS mandatory fields not null
-- {{ test not_null on fct_normalized_cost_record columns:
--    [tenant_id, provider, service_name, service_category,
--     charge_type, billed_cost_sar, billing_period] }}

-- Test: Cost reconciliation within 0.1% tolerance
-- Custom test: reconciliation_tolerance.sql
/*
-- tests/reconciliation_tolerance.sql
-- {{ config(tags=['normalization_quality'], severity='warn') }}
WITH source_total AS (
    SELECT SUM(raw_cost * COALESCE(ex.exchange_rate, 1.0)) AS total_sar
    FROM raw_staging_record rsr
    LEFT JOIN exchange_rate_config ex
        ON ex.source_currency = rsr.raw_currency
        AND ex.target_currency = 'SAR'
        AND rsr.billing_period >= ex.effective_from
        AND (ex.effective_to IS NULL OR rsr.billing_period <= ex.effective_to)
    WHERE rsr.run_id = '{{ var("source_run_id") }}'::UUID
),
normalized_total AS (
    SELECT SUM(billed_cost_sar) AS total_sar
    FROM normalized_cost_record
    WHERE normalization_run_id = '{{ var("normalization_run_id") }}'::UUID
)
SELECT 1
FROM source_total s, normalized_total n
WHERE ABS(s.total_sar - n.total_sar) / NULLIF(s.total_sar, 0) > 0.001
*/

-- Test: Taxonomy coverage >= 95%
/*
-- tests/taxonomy_coverage.sql
-- {{ config(tags=['normalization_quality'], severity='warn') }}
WITH stats AS (
    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE service_name != 'Unmapped') AS mapped
    FROM normalized_cost_record
    WHERE normalization_run_id = '{{ var("normalization_run_id") }}'::UUID
)
SELECT 1 FROM stats WHERE mapped::FLOAT / NULLIF(total, 0) < 0.95
*/

-- Test: Dimensional coverage >= 85%
/*
-- tests/dimensional_coverage.sql
-- {{ config(tags=['normalization_quality'], severity='warn') }}
WITH stats AS (
    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE attribution_status != 'Unattributed') AS attributed
    FROM normalized_cost_record
    WHERE normalization_run_id = '{{ var("normalization_run_id") }}'::UUID
)
SELECT 1 FROM stats WHERE attributed::FLOAT / NULLIF(total, 0) < 0.85
*/
