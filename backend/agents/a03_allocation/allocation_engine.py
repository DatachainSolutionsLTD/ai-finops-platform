"""
A03 Allocation Agent — Cost Allocation Engine
FSD Reference: A03 Flow 1 (Fixed), Flow 2 (Proportional), Flow 3 (Dynamic)
Steps: 1–7 (Fixed), 8–22 (Proportional), 23+ (Dynamic)
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

logger = logging.getLogger("agent.a03.engine")


class AllocationModel(str, Enum):
    FIXED = "Fixed"
    PROPORTIONAL = "Proportional"
    DYNAMIC = "Dynamic"


class CostCategory(str, Enum):
    DIRECT = "Direct"
    SHARED = "Shared"
    IDLE_CAPACITY_TAX = "IdleCapacityTax"
    UNATTRIBUTED = "Unattributed"


@dataclass
class AllocationResult:
    """Result of allocating a single normalized cost record."""
    allocation_record_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_cost_record_id: str = ""
    rule_id: str = ""
    allocation_model: str = ""
    owner_bu_id: Optional[str] = None
    owner_application_id: Optional[str] = None
    owner_project_id: Optional[str] = None
    owner_cost_center_id: Optional[str] = None
    owner_environment: Optional[str] = None
    allocated_amount_sar: Decimal = Decimal("0")
    allocation_percentage: Decimal = Decimal("100")
    cost_category: str = "Direct"
    shared_pool_id: Optional[str] = None
    provider: str = ""
    service_category: str = ""
    billing_period: str = ""


class AllocationEngine:
    """
    Core allocation engine implementing three allocation models:
    - Fixed: 100% of matched costs to a single designated owner
    - Proportional: Shared costs distributed by utilization/headcount keys
    - Dynamic: Real-time telemetry-based allocation (Seed: simplified)

    FSD Business Rules:
    - BR-AL-01: Rules execute in priority order (1 = highest)
    - BR-AL-02: Each cost record allocated exactly once (no double-counting)
    - BR-AL-03: Sum of allocated costs == sum of input costs (zero-variance)
    - BR-AL-04: Idle capacity tax distributes unused capacity proportionally
    - BR-AL-05: Unattributed costs tracked separately (not silently dropped)
    """

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self._allocated_record_ids: set[str] = set()  # Track already-allocated records

    async def execute_allocation_run(
        self,
        tenant_id: str,
        billing_period: str,
        normalization_run_id: Optional[str] = None,
    ) -> dict:
        """
        Execute full allocation run for a tenant and billing period.

        FSD Steps 1-7:
        1. Load active rules ordered by priority
        2. For each rule, match normalized cost records by resource scope
        3. Apply allocation model (Fixed/Proportional/Dynamic)
        4. Write allocated_cost_record entries
        5. Track unattributed remainder
        6. Reconcile: total_allocated == total_input
        7. Return run summary
        """
        run_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)

        logger.info(
            "Starting allocation run",
            extra={
                "run_id": run_id,
                "tenant_id": tenant_id,
                "billing_period": billing_period,
            },
        )

        # Step 1: Load active rules ordered by priority
        rules = await self._load_active_rules(tenant_id)
        logger.info(f"Loaded {len(rules)} active allocation rules")

        # Step 2-5: Process each rule in priority order
        total_input = await self._get_total_input_cost(tenant_id, billing_period)
        all_results: list[AllocationResult] = []
        self._allocated_record_ids.clear()

        for rule in rules:
            rule_results = await self._execute_rule(
                rule, tenant_id, billing_period
            )
            all_results.extend(rule_results)

        # Step 5: Handle unattributed costs
        unattributed_results = await self._handle_unattributed(
            tenant_id, billing_period, run_id
        )
        all_results.extend(unattributed_results)

        # Step 4: Bulk write allocated cost records
        records_written = await self._write_allocated_records(all_results, run_id, tenant_id)

        # Step 6: Reconciliation
        total_allocated = sum(r.allocated_amount_sar for r in all_results)
        variance_pct = Decimal("0")
        if total_input > 0:
            variance_pct = abs((total_allocated - total_input) / total_input * 100)

        coverage_pct = Decimal("0")
        if all_results:
            attributed = sum(
                1 for r in all_results if r.cost_category != CostCategory.UNATTRIBUTED
            )
            coverage_pct = Decimal(attributed) / Decimal(len(all_results)) * 100

        duration = (datetime.now(timezone.utc) - start_time).total_seconds()

        summary = {
            "run_id": run_id,
            "tenant_id": tenant_id,
            "billing_period": billing_period,
            "status": "Completed" if variance_pct <= Decimal("0.1") else "Partial",
            "records_input": await self._count_input_records(tenant_id, billing_period),
            "records_allocated": records_written,
            "records_unattributed": len(unattributed_results),
            "total_cost_input_sar": float(total_input),
            "total_cost_allocated_sar": float(total_allocated),
            "reconciliation_variance_pct": float(variance_pct),
            "coverage_rate_pct": float(coverage_pct),
            "duration_seconds": int(duration),
            "rules_evaluated": len(rules),
        }

        logger.info("Allocation run completed", extra=summary)
        return summary

    async def _load_active_rules(self, tenant_id: str) -> list[dict]:
        """FSD Step 3: Query Allocation_Rule_Registry, ordered by priority."""
        result = await self.db.execute(
            select("*")
            .select_from("allocation_rule")
            .where(
                and_(
                    "tenant_id" == tenant_id,
                    "is_active" == True,
                    "approval_status" == "Approved",
                )
            )
            .order_by("priority")
        )
        return [dict(row) for row in result.fetchall()]

    async def _execute_rule(
        self, rule: dict, tenant_id: str, billing_period: str
    ) -> list[AllocationResult]:
        """
        Execute a single allocation rule against matching cost records.
        Routes to the appropriate allocation model handler.
        """
        model = AllocationModel(rule["allocation_model"])

        # Find matching normalized cost records
        matching_records = await self._match_records_by_scope(
            tenant_id, billing_period, rule["resource_scope"]
        )

        # Exclude already-allocated records (BR-AL-02: no double-counting)
        unallocated = [
            r for r in matching_records
            if r["record_id"] not in self._allocated_record_ids
        ]

        if not unallocated:
            return []

        if model == AllocationModel.FIXED:
            results = self._allocate_fixed(unallocated, rule)
        elif model == AllocationModel.PROPORTIONAL:
            results = await self._allocate_proportional(unallocated, rule)
        elif model == AllocationModel.DYNAMIC:
            results = await self._allocate_dynamic(unallocated, rule)
        else:
            logger.warning(f"Unknown allocation model: {model}")
            return []

        # Mark records as allocated
        for r in unallocated:
            self._allocated_record_ids.add(r["record_id"])

        return results

    def _allocate_fixed(
        self, records: list[dict], rule: dict
    ) -> list[AllocationResult]:
        """
        FSD Flow 1, Steps 4-5: Fixed allocation.
        Each matched record's full cost attributed 100% to designated owner.
        """
        results = []
        for record in records:
            result = AllocationResult(
                source_cost_record_id=record["record_id"],
                rule_id=rule["rule_id"],
                allocation_model=AllocationModel.FIXED,
                owner_bu_id=rule.get("owner_id") if rule["owner_type"] == "BU" else None,
                owner_application_id=rule.get("owner_id") if rule["owner_type"] == "Application" else None,
                owner_project_id=rule.get("owner_id") if rule["owner_type"] == "Project" else None,
                owner_cost_center_id=rule.get("owner_id") if rule["owner_type"] == "CostCenter" else None,
                allocated_amount_sar=Decimal(str(record["billed_cost_sar"])),
                allocation_percentage=Decimal("100"),
                cost_category=CostCategory.DIRECT,
                provider=record["provider"],
                service_category=record["service_category"],
                billing_period=record["billing_period"],
            )
            results.append(result)

        return results

    async def _allocate_proportional(
        self, records: list[dict], rule: dict
    ) -> list[AllocationResult]:
        """
        FSD Flow 2, Steps 8-22: Proportional allocation.
        Shared costs distributed to consumers based on distribution key
        (Utilization, Headcount, Reservation, Custom).
        """
        pool_id = rule.get("shared_pool_id")
        distribution_key = rule.get("distribution_key", "Equal_Split")

        # Calculate total shared cost
        total_shared_cost = sum(Decimal(str(r["billed_cost_sar"])) for r in records)

        # Get distribution weights (simplified for Seed)
        weights = await self._get_distribution_weights(
            rule["tenant_id"], pool_id, distribution_key
        )

        if not weights:
            # Fallback: equal split across all known BUs
            weights = await self._get_equal_split_weights(rule["tenant_id"])

        results = []
        total_weight = sum(w["weight"] for w in weights)

        for record in records:
            record_cost = Decimal(str(record["billed_cost_sar"]))

            for weight_entry in weights:
                if total_weight == 0:
                    proportion = Decimal("0")
                else:
                    proportion = Decimal(str(weight_entry["weight"])) / Decimal(str(total_weight))

                allocated_amount = record_cost * proportion
                pct = proportion * 100

                result = AllocationResult(
                    source_cost_record_id=record["record_id"],
                    rule_id=rule["rule_id"],
                    allocation_model=AllocationModel.PROPORTIONAL,
                    owner_bu_id=weight_entry.get("bu_id"),
                    owner_application_id=weight_entry.get("application_id"),
                    allocated_amount_sar=allocated_amount,
                    allocation_percentage=pct,
                    cost_category=CostCategory.SHARED,
                    shared_pool_id=pool_id,
                    provider=record["provider"],
                    service_category=record["service_category"],
                    billing_period=record["billing_period"],
                )
                results.append(result)

        # Idle capacity tax (if enabled)
        if rule.get("idle_tax_enabled") and rule.get("idle_tax_rate_pct", 0) > 0:
            idle_results = await self._calculate_idle_tax(
                records, rule, weights, total_weight
            )
            results.extend(idle_results)

        return results

    async def _allocate_dynamic(
        self, records: list[dict], rule: dict
    ) -> list[AllocationResult]:
        """
        FSD Flow 3: Dynamic allocation based on real-time telemetry.
        Seed: simplified to utilization-weighted proportional.
        Full dynamic with Kubecost/Prometheus at Angel.
        """
        # Seed: delegate to proportional with utilization key
        rule_copy = dict(rule)
        rule_copy["distribution_key"] = "Utilization"
        return await self._allocate_proportional(records, rule_copy)

    async def _calculate_idle_tax(
        self, records: list[dict], rule: dict, weights: list[dict], total_weight: float
    ) -> list[AllocationResult]:
        """
        FSD: Idle capacity tax distributes unused capacity costs.
        Idle cost = total_cost × (1 - utilization_rate) × idle_tax_rate_pct
        """
        idle_rate = Decimal(str(rule.get("idle_tax_rate_pct", 100))) / 100
        results = []

        for record in records:
            record_cost = Decimal(str(record["billed_cost_sar"]))
            # Simplified: assume 30% idle (Seed placeholder; real telemetry at Angel)
            idle_portion = record_cost * Decimal("0.30") * idle_rate

            for weight_entry in weights:
                proportion = Decimal(str(weight_entry["weight"])) / Decimal(str(max(total_weight, 1)))
                idle_allocated = idle_portion * proportion

                result = AllocationResult(
                    source_cost_record_id=record["record_id"],
                    rule_id=rule["rule_id"],
                    allocation_model=AllocationModel.PROPORTIONAL,
                    owner_bu_id=weight_entry.get("bu_id"),
                    allocated_amount_sar=idle_allocated,
                    allocation_percentage=proportion * 100,
                    cost_category=CostCategory.IDLE_CAPACITY_TAX,
                    shared_pool_id=rule.get("shared_pool_id"),
                    provider=record["provider"],
                    service_category=record["service_category"],
                    billing_period=record["billing_period"],
                )
                results.append(result)

        return results

    async def _handle_unattributed(
        self, tenant_id: str, billing_period: str, run_id: str
    ) -> list[AllocationResult]:
        """
        FSD BR-AL-05: Track unattributed costs explicitly.
        Records not matched by any rule get Unattributed category.
        """
        all_record_ids = await self._get_all_record_ids(tenant_id, billing_period)
        unattributed_ids = all_record_ids - self._allocated_record_ids

        if not unattributed_ids:
            return []

        records = await self._get_records_by_ids(list(unattributed_ids))
        results = []

        for record in records:
            result = AllocationResult(
                source_cost_record_id=record["record_id"],
                rule_id="00000000-0000-0000-0000-000000000000",  # System rule
                allocation_model="Unattributed",
                allocated_amount_sar=Decimal(str(record["billed_cost_sar"])),
                allocation_percentage=Decimal("100"),
                cost_category=CostCategory.UNATTRIBUTED,
                provider=record["provider"],
                service_category=record["service_category"],
                billing_period=record["billing_period"],
            )
            results.append(result)
            self._allocated_record_ids.add(record["record_id"])

        logger.info(f"Unattributed records: {len(results)}")
        return results

    # -----------------------------------------------------------------------
    # SIMULATION — What-If Analysis (FSD: Allocation Simulation Screen)
    # -----------------------------------------------------------------------

    async def simulate_rule(
        self, rule: dict, tenant_id: str, billing_period: str
    ) -> dict:
        """
        Run allocation simulation without persisting results.
        Returns projected impact comparison (current vs. proposed).
        """
        # Get current allocation state
        current_coverage = await self._get_current_coverage(tenant_id, billing_period)

        # Run proposed allocation in-memory
        matching = await self._match_records_by_scope(
            tenant_id, billing_period, rule["resource_scope"]
        )
        proposed_cost = sum(Decimal(str(r["billed_cost_sar"])) for r in matching)

        return {
            "current_coverage_pct": float(current_coverage),
            "records_affected": len(matching),
            "cost_affected_sar": float(proposed_cost),
            "proposed_owner": rule.get("owner_id"),
            "proposed_model": rule.get("allocation_model"),
        }

    # -----------------------------------------------------------------------
    # Private helpers (DB queries — simplified for scaffold)
    # -----------------------------------------------------------------------

    async def _match_records_by_scope(
        self, tenant_id: str, billing_period: str, scope: dict
    ) -> list[dict]:
        """Match normalized cost records by rule's resource scope JSON filter."""
        # Build dynamic WHERE clause from scope JSON
        # scope = {"provider": ["AWS"], "service_category": ["Compute"], "region": ["me-south-1"]}
        # Actual implementation uses SQLAlchemy dynamic filter builder
        return []  # Placeholder — real impl queries normalized_cost_record

    async def _get_distribution_weights(
        self, tenant_id: str, pool_id: str, key: str
    ) -> list[dict]:
        """Get distribution weights for proportional allocation."""
        return []  # Placeholder — queries utilization/headcount data

    async def _get_equal_split_weights(self, tenant_id: str) -> list[dict]:
        """Fallback: equal split across all known BUs."""
        return []  # Placeholder

    async def _get_total_input_cost(self, tenant_id: str, billing_period: str) -> Decimal:
        return Decimal("0")  # Placeholder

    async def _count_input_records(self, tenant_id: str, billing_period: str) -> int:
        return 0  # Placeholder

    async def _get_all_record_ids(self, tenant_id: str, billing_period: str) -> set[str]:
        return set()  # Placeholder

    async def _get_records_by_ids(self, record_ids: list[str]) -> list[dict]:
        return []  # Placeholder

    async def _get_current_coverage(self, tenant_id: str, billing_period: str) -> Decimal:
        return Decimal("0")  # Placeholder

    async def _write_allocated_records(
        self, results: list[AllocationResult], run_id: str, tenant_id: str
    ) -> int:
        """Bulk insert allocated cost records."""
        # Real impl: batch INSERT into allocated_cost_record table
        return len(results)
