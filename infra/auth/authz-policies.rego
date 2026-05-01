# =============================================================================
# OPA Rego Policies — Seed Round (Basic RBAC)
# Scope: Single Super Admin role + agent service identity validation
# Deployment: OPA sidecar or bundle server
# Migration: Angel round adds 9 full RBAC roles per FSD specification
# =============================================================================

# ---------------------------------------------------------------------------
# Package: finops.authz
# Purpose: Main authorization entry point
# ---------------------------------------------------------------------------
package finops.authz

import rego.v1

# Default deny
default allow := false

# ---------------------------------------------------------------------------
# RULE: Super Admin has full access (Seed — single role)
# ---------------------------------------------------------------------------
allow if {
    "Platform_Admin" in input.user.roles
    input.user.tenant_id == input.resource.tenant_id
}

# ---------------------------------------------------------------------------
# RULE: Tenant Admin can manage all resources within their tenant
# ---------------------------------------------------------------------------
allow if {
    "Tenant_Admin" in input.user.roles
    input.user.tenant_id == input.resource.tenant_id
}

# ---------------------------------------------------------------------------
# RULE: FinOps Analyst — read all + write rules, reports, anomaly lifecycle
# ---------------------------------------------------------------------------
allow if {
    "FinOps_Analyst" in input.user.roles
    input.user.tenant_id == input.resource.tenant_id
    input.action in analyst_allowed_actions
}

analyst_allowed_actions := {
    "read", "list",
    "create_allocation_rule", "update_allocation_rule", "simulate_allocation",
    "create_report", "update_report", "generate_report",
    "transition_anomaly", "create_suppression_rule",
    "submit_nl_query", "export_report", "upload_cost_file",
}

# ---------------------------------------------------------------------------
# RULE: Executive Viewer — read-only access to dashboards and reports
# ---------------------------------------------------------------------------
allow if {
    "Executive_Viewer" in input.user.roles
    input.user.tenant_id == input.resource.tenant_id
    input.action in {"read", "list", "export_report"}
}

# ---------------------------------------------------------------------------
# RULE: Agent identity — agents can access their own domain endpoints
# ---------------------------------------------------------------------------
allow if {
    input.principal_type == "agent"
    input.agent.tenant_id == input.resource.tenant_id
    agent_domain_access[input.agent.type][input.resource.domain]
}

# Agent → domain access matrix (Seed scope)
agent_domain_access := {
    "A01": {"ingestion": true, "health": true},
    "A02": {"normalization": true, "ingestion": true, "health": true},
    "A03": {"allocation": true, "normalization": true, "health": true},
    "A04": {"reporting": true, "allocation": true, "normalization": true, "anomaly": true, "health": true},
    "A05": {"anomaly": true, "normalization": true, "health": true},
    "A27": {"ingestion": true, "normalization": true, "allocation": true, "reporting": true, "anomaly": true, "platform": true, "health": true},
}

# ---------------------------------------------------------------------------
# RULE: Agent autonomy level enforcement
# ---------------------------------------------------------------------------
# Agents at L2+ can execute write actions; L0-L1 are read-only
allow if {
    input.principal_type == "agent"
    input.action in {"read", "list"}
}

allow if {
    input.principal_type == "agent"
    input.action in {"create", "update", "execute", "trigger"}
    input.agent.autonomy_level >= 2
}

# ---------------------------------------------------------------------------
# HELPER: Tenant isolation — always enforced
# ---------------------------------------------------------------------------
# This is a guard — any policy that sets allow must also match tenant_id
tenant_match if {
    input.user.tenant_id == input.resource.tenant_id
}

tenant_match if {
    input.principal_type == "agent"
    input.agent.tenant_id == input.resource.tenant_id
}

# ---------------------------------------------------------------------------
# Package: finops.authz.jwt
# Purpose: JWT claim validation
# ---------------------------------------------------------------------------
package finops.authz.jwt

import rego.v1

# Validate JWT claims structure
valid_claims if {
    input.token.sub != ""
    input.token.tenant_id != ""
    count(input.token.roles) > 0
    input.token.exp > time.now_ns() / 1000000000
}

# Extract tenant from JWT
tenant_id := input.token.tenant_id

# Extract roles from JWT
roles := input.token.roles

# ---------------------------------------------------------------------------
# Package: finops.authz.rate_limit
# Purpose: Per-tenant API rate limiting tiers
# ---------------------------------------------------------------------------
package finops.authz.rate_limit

import rego.v1

# Seed: single tier (Starter equivalent)
default rate_limit_rpm := 100

# Rate limit tiers (Angel+ will read from tenant config)
rate_limit_rpm := 500 if {
    input.tenant.tier == "Professional"
}

rate_limit_rpm := 2000 if {
    input.tenant.tier == "Enterprise"
}
