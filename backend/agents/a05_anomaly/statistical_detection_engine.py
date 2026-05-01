"""
A05 Anomaly Detection Agent — Statistical Detection Engine
FSD Reference: A05 Flow 1 (Scheduled Detection Cycle), Steps 1–7
Seed Scope: Statistical methods only (ML deferred to Series A)

Detection Models (FSD Step 4):
  1. Z-Score Analysis        — standard deviation from rolling mean
  2. IQR Method              — interquartile range outlier detection
  3. EWMA                    — exponentially weighted moving average trend shifts
  4. Rate-of-Change          — day-over-day percentage threshold
  5. Ensemble (consensus)    — majority vote across models
"""

import hashlib
import logging
import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional

import numpy as np

logger = logging.getLogger("agent.a05.detection")


class Severity(str, Enum):
    INFORMATIONAL = "Informational"
    WARNING = "Warning"
    CRITICAL = "Critical"


class DeviationDirection(str, Enum):
    SPIKE = "Spike"
    DROP = "Drop"


class RootCauseCategory(str, Enum):
    BILLING_ERROR = "Billing_Error"
    RESOURCE_MISCONFIGURATION = "Resource_Misconfiguration"
    DEMAND_SPIKE = "Demand_Spike"
    PRICING_CHANGE = "Pricing_Change"
    SECURITY_INCIDENT = "Security_Incident"
    DATA_QUALITY = "Data_Quality"
    UNCLASSIFIED = "Unclassified"


@dataclass
class CostDimension:
    """A unique cost dimension tuple for baseline computation."""
    tenant_id: str
    provider: str = ""
    service_name: str = ""
    region: str = ""
    business_unit_id: str = ""
    application_id: str = ""
    environment: str = ""

    @property
    def dimension_hash(self) -> str:
        key = f"{self.tenant_id}|{self.provider}|{self.service_name}|{self.region}|{self.business_unit_id}|{self.environment}"
        return hashlib.sha256(key.encode()).hexdigest()[:16]


@dataclass
class Baseline:
    """Statistical baseline for a cost dimension."""
    mean: float = 0.0
    stddev: float = 0.0
    median: float = 0.0
    q1: float = 0.0
    q3: float = 0.0
    iqr: float = 0.0
    ewma: float = 0.0
    sample_count: int = 0
    last_values: list = field(default_factory=list)
    last_updated: str = ""


@dataclass
class DetectionResult:
    """Result of anomaly detection for one dimension."""
    anomaly_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    dimension: CostDimension = field(default_factory=CostDimension)
    detection_method: str = ""
    severity: Severity = Severity.INFORMATIONAL
    severity_score: float = 0.0
    root_cause_category: RootCauseCategory = RootCauseCategory.UNCLASSIFIED
    root_cause_confidence: float = 0.0
    baseline_value: float = 0.0
    actual_value: float = 0.0
    deviation_amount: float = 0.0
    deviation_pct: float = 0.0
    deviation_direction: DeviationDirection = DeviationDirection.SPIKE
    financial_impact_7d: float = 0.0
    financial_impact_30d: float = 0.0
    blast_radius: int = 1
    confidence_score: float = 0.0


class StatisticalDetectionEngine:
    """
    Multi-model statistical anomaly detection engine.

    FSD Flow 1: Scheduled Detection Cycle
    Step 3: Compute dynamic baselines per cost dimension
    Step 4: Apply statistical models
    Step 5: Calculate deviation metrics + financial impact
    Step 6: Write results to Detection_Run_Log
    Step 7: Publish completion event
    """

    def __init__(
        self,
        redis_client,
        db_session,
        config: Optional[dict] = None,
    ):
        self.redis = redis_client
        self.db = db_session

        cfg = config or {}
        # Z-Score thresholds (FSD default)
        self.zscore_warning = cfg.get("zscore_warning_threshold", 2.5)
        self.zscore_critical = cfg.get("zscore_critical_threshold", 3.5)

        # IQR multiplier
        self.iqr_multiplier = cfg.get("iqr_multiplier", 1.5)

        # EWMA smoothing factor (FSD default: 0.3)
        self.ewma_alpha = cfg.get("ewma_alpha", 0.3)

        # Rate-of-change thresholds (FSD default)
        self.roc_warning_pct = cfg.get("roc_warning_pct", 50.0)
        self.roc_critical_pct = cfg.get("roc_critical_pct", 200.0)

        # Lookback period for baseline
        self.lookback_days = cfg.get("lookback_days", 30)

        # Severity thresholds (FSD Step 9)
        self.critical_daily_impact = cfg.get("critical_daily_impact_sar", 10000)
        self.warning_daily_impact = cfg.get("warning_daily_impact_sar", 1000)

    # -----------------------------------------------------------------------
    # Main Detection Cycle
    # -----------------------------------------------------------------------

    async def run_detection_cycle(self, tenant_id: str) -> dict:
        """
        Execute a full anomaly detection cycle for a tenant.
        Returns run summary with detected anomalies.
        """
        run_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)

        logger.info(f"Starting detection cycle", extra={"run_id": run_id, "tenant_id": tenant_id})

        # Get all unique cost dimensions for this tenant
        dimensions = await self._discover_dimensions(tenant_id)
        logger.info(f"Scanning {len(dimensions)} cost dimensions")

        all_anomalies: list[DetectionResult] = []
        dimensions_scanned = 0

        for dim in dimensions:
            dimensions_scanned += 1

            # Compute/retrieve baseline
            baseline = await self._compute_baseline(dim)
            if baseline.sample_count < 7:
                continue  # Need minimum data for meaningful detection

            # Get current value
            current_value = await self._get_current_value(dim)
            if current_value is None:
                continue

            # Run all 4 detection models
            model_results = []

            zscore_result = self._detect_zscore(baseline, current_value, dim)
            if zscore_result:
                model_results.append(zscore_result)

            iqr_result = self._detect_iqr(baseline, current_value, dim)
            if iqr_result:
                model_results.append(iqr_result)

            ewma_result = self._detect_ewma(baseline, current_value, dim)
            if ewma_result:
                model_results.append(ewma_result)

            roc_result = self._detect_rate_of_change(baseline, current_value, dim)
            if roc_result:
                model_results.append(roc_result)

            # Ensemble: if 2+ models agree, use highest severity
            if len(model_results) >= 2:
                ensemble = self._ensemble_vote(model_results, baseline, current_value, dim)
                all_anomalies.append(ensemble)
            elif len(model_results) == 1:
                # Single model detection — lower confidence
                single = model_results[0]
                single.confidence_score *= 0.7  # Reduce confidence for single-model
                single.detection_method = f"{single.detection_method}_solo"
                all_anomalies.append(single)

            # Update EWMA in baseline cache
            await self._update_ewma(dim, current_value)

        # Classify severity for all anomalies (FSD Flow 2, Steps 8–13)
        for anomaly in all_anomalies:
            self._classify_severity(anomaly)
            self._infer_root_cause(anomaly)
            self._calculate_financial_impact(anomaly)

        duration = (datetime.now(timezone.utc) - start_time).total_seconds()

        # Check suppression rules
        suppressed_count = await self._apply_suppression_rules(tenant_id, all_anomalies)

        summary = {
            "run_id": run_id,
            "tenant_id": tenant_id,
            "status": "Completed",
            "dimensions_scanned": dimensions_scanned,
            "records_analyzed": dimensions_scanned,
            "anomalies_detected": len(all_anomalies),
            "anomalies_suppressed": suppressed_count,
            "models_used": "Z_Score,IQR,EWMA,Rate_of_Change",
            "duration_seconds": int(duration),
            "anomalies": all_anomalies,
        }

        logger.info(
            "Detection cycle complete",
            extra={
                "run_id": run_id,
                "dimensions": dimensions_scanned,
                "anomalies": len(all_anomalies),
                "suppressed": suppressed_count,
                "duration_s": int(duration),
            },
        )

        return summary

    # -----------------------------------------------------------------------
    # Detection Model 1: Z-Score Analysis
    # -----------------------------------------------------------------------

    def _detect_zscore(
        self, baseline: Baseline, current: float, dim: CostDimension
    ) -> Optional[DetectionResult]:
        """
        FSD Step 4: Z-Score — number of standard deviations from mean.
        Warning: >= 2.5 SD, Critical: >= 3.5 SD
        """
        if baseline.stddev == 0:
            return None

        z = abs(current - baseline.mean) / baseline.stddev

        if z < self.zscore_warning:
            return None

        direction = DeviationDirection.SPIKE if current > baseline.mean else DeviationDirection.DROP
        deviation_pct = ((current - baseline.mean) / max(baseline.mean, 0.01)) * 100

        return DetectionResult(
            dimension=dim,
            detection_method="Z_Score",
            baseline_value=baseline.mean,
            actual_value=current,
            deviation_amount=current - baseline.mean,
            deviation_pct=deviation_pct,
            deviation_direction=direction,
            confidence_score=min(z / 5.0 * 100, 100),  # Scale z to 0–100
        )

    # -----------------------------------------------------------------------
    # Detection Model 2: IQR Method
    # -----------------------------------------------------------------------

    def _detect_iqr(
        self, baseline: Baseline, current: float, dim: CostDimension
    ) -> Optional[DetectionResult]:
        """
        FSD Step 4: IQR — outlier beyond Q1 - 1.5*IQR or Q3 + 1.5*IQR.
        """
        if baseline.iqr == 0:
            return None

        lower = baseline.q1 - self.iqr_multiplier * baseline.iqr
        upper = baseline.q3 + self.iqr_multiplier * baseline.iqr

        if lower <= current <= upper:
            return None

        direction = DeviationDirection.SPIKE if current > upper else DeviationDirection.DROP
        reference = upper if direction == DeviationDirection.SPIKE else lower
        deviation_pct = ((current - baseline.median) / max(baseline.median, 0.01)) * 100

        # Confidence: how far beyond the fence
        fence_distance = abs(current - reference) / max(baseline.iqr, 0.01)

        return DetectionResult(
            dimension=dim,
            detection_method="IQR",
            baseline_value=baseline.median,
            actual_value=current,
            deviation_amount=current - baseline.median,
            deviation_pct=deviation_pct,
            deviation_direction=direction,
            confidence_score=min(fence_distance / 3.0 * 100, 100),
        )

    # -----------------------------------------------------------------------
    # Detection Model 3: EWMA
    # -----------------------------------------------------------------------

    def _detect_ewma(
        self, baseline: Baseline, current: float, dim: CostDimension
    ) -> Optional[DetectionResult]:
        """
        FSD Step 4: EWMA — detects trend shifts using smoothing factor.
        """
        if baseline.ewma == 0 or baseline.stddev == 0:
            return None

        # New EWMA value
        new_ewma = self.ewma_alpha * current + (1 - self.ewma_alpha) * baseline.ewma

        # Control limits: EWMA ± 3 * sigma * sqrt(alpha / (2 - alpha))
        sigma_ewma = baseline.stddev * math.sqrt(self.ewma_alpha / (2 - self.ewma_alpha))
        upper_limit = baseline.ewma + 3 * sigma_ewma
        lower_limit = baseline.ewma - 3 * sigma_ewma

        if lower_limit <= new_ewma <= upper_limit:
            return None

        direction = DeviationDirection.SPIKE if new_ewma > upper_limit else DeviationDirection.DROP
        deviation_pct = ((current - baseline.ewma) / max(baseline.ewma, 0.01)) * 100

        return DetectionResult(
            dimension=dim,
            detection_method="EWMA",
            baseline_value=baseline.ewma,
            actual_value=current,
            deviation_amount=current - baseline.ewma,
            deviation_pct=deviation_pct,
            deviation_direction=direction,
            confidence_score=min(abs(new_ewma - baseline.ewma) / max(sigma_ewma * 3, 0.01) * 100, 100),
        )

    # -----------------------------------------------------------------------
    # Detection Model 4: Rate-of-Change
    # -----------------------------------------------------------------------

    def _detect_rate_of_change(
        self, baseline: Baseline, current: float, dim: CostDimension
    ) -> Optional[DetectionResult]:
        """
        FSD Step 4: Rate-of-change — day-over-day % threshold.
        Warning: > 50% DoD, Critical: > 200% DoD
        """
        if not baseline.last_values or len(baseline.last_values) < 2:
            return None

        previous = baseline.last_values[-1]
        if previous == 0:
            return None

        roc_pct = ((current - previous) / abs(previous)) * 100

        if abs(roc_pct) < self.roc_warning_pct:
            return None

        direction = DeviationDirection.SPIKE if roc_pct > 0 else DeviationDirection.DROP

        return DetectionResult(
            dimension=dim,
            detection_method="Rate_of_Change",
            baseline_value=previous,
            actual_value=current,
            deviation_amount=current - previous,
            deviation_pct=roc_pct,
            deviation_direction=direction,
            confidence_score=min(abs(roc_pct) / 300 * 100, 100),
        )

    # -----------------------------------------------------------------------
    # Ensemble Voting
    # -----------------------------------------------------------------------

    def _ensemble_vote(
        self,
        results: list[DetectionResult],
        baseline: Baseline,
        current: float,
        dim: CostDimension,
    ) -> DetectionResult:
        """
        Combine multiple model detections into a single ensemble result.
        Uses highest confidence and severity from agreeing models.
        """
        best = max(results, key=lambda r: r.confidence_score)
        avg_confidence = sum(r.confidence_score for r in results) / len(results)
        model_names = ",".join(r.detection_method for r in results)

        ensemble = DetectionResult(
            dimension=dim,
            detection_method=f"Ensemble({model_names})",
            baseline_value=best.baseline_value,
            actual_value=current,
            deviation_amount=best.deviation_amount,
            deviation_pct=best.deviation_pct,
            deviation_direction=best.deviation_direction,
            confidence_score=min(avg_confidence * 1.2, 100),  # Boost for agreement
        )
        return ensemble

    # -----------------------------------------------------------------------
    # Severity Classification (FSD Flow 2, Step 9)
    # -----------------------------------------------------------------------

    def _classify_severity(self, anomaly: DetectionResult):
        """
        FSD Step 9 — Composite severity scoring:
        Critical (>80): impact > 10K SAR/day, or deviation > 300%, or blast_radius > 5
        Warning (40–80): impact 1K–10K SAR/day, or deviation 100–300%
        Informational (<40): impact < 1K SAR/day, or deviation 50–100%
        """
        daily_impact = abs(anomaly.deviation_amount)
        dev_pct = abs(anomaly.deviation_pct)

        # Composite score: weighted combination
        impact_score = min(daily_impact / self.critical_daily_impact * 40, 40)
        deviation_score = min(dev_pct / 300 * 30, 30)
        confidence_factor = anomaly.confidence_score / 100 * 20
        blast_factor = min(anomaly.blast_radius / 5 * 10, 10)

        score = impact_score + deviation_score + confidence_factor + blast_factor
        anomaly.severity_score = round(min(score, 100), 2)

        if score > 80:
            anomaly.severity = Severity.CRITICAL
        elif score > 40:
            anomaly.severity = Severity.WARNING
        else:
            anomaly.severity = Severity.INFORMATIONAL

    # -----------------------------------------------------------------------
    # Root Cause Inference (FSD Flow 2, Step 10)
    # -----------------------------------------------------------------------

    def _infer_root_cause(self, anomaly: DetectionResult):
        """
        FSD Step 10 — Heuristic root cause categorization.
        Seed: rule-based. Series A: ML-powered root cause analysis.
        """
        dev_pct = abs(anomaly.deviation_pct)
        direction = anomaly.deviation_direction

        # Heuristic rules
        if direction == DeviationDirection.DROP and dev_pct > 80:
            anomaly.root_cause_category = RootCauseCategory.BILLING_ERROR
            anomaly.root_cause_confidence = 60
        elif direction == DeviationDirection.SPIKE and dev_pct > 200:
            anomaly.root_cause_category = RootCauseCategory.RESOURCE_MISCONFIGURATION
            anomaly.root_cause_confidence = 55
        elif direction == DeviationDirection.SPIKE and 50 < dev_pct <= 200:
            anomaly.root_cause_category = RootCauseCategory.DEMAND_SPIKE
            anomaly.root_cause_confidence = 50
        else:
            anomaly.root_cause_category = RootCauseCategory.UNCLASSIFIED
            anomaly.root_cause_confidence = 30

    # -----------------------------------------------------------------------
    # Financial Impact Projection (FSD Step 5)
    # -----------------------------------------------------------------------

    def _calculate_financial_impact(self, anomaly: DetectionResult):
        """
        FSD Step 5: Estimate 7-day and 30-day cost impact if deviation persists.
        """
        daily_deviation = abs(anomaly.deviation_amount)
        anomaly.financial_impact_7d = round(daily_deviation * 7, 2)
        anomaly.financial_impact_30d = round(daily_deviation * 30, 2)

    # -----------------------------------------------------------------------
    # Suppression Rules (FSD Flow 5)
    # -----------------------------------------------------------------------

    async def _apply_suppression_rules(
        self, tenant_id: str, anomalies: list[DetectionResult]
    ) -> int:
        """
        FSD Flow 5: Apply suppression rules to prevent alert fatigue.
        Critical anomalies are NEVER suppressed.
        """
        suppressed = 0
        # Load active suppression rules from cache/DB
        rules = await self._load_suppression_rules(tenant_id)

        for anomaly in anomalies:
            if anomaly.severity == Severity.CRITICAL:
                continue  # Critical never suppressed

            for rule in rules:
                if self._rule_matches(rule, anomaly):
                    anomaly.detection_method += "_SUPPRESSED"
                    suppressed += 1
                    break

        return suppressed

    def _rule_matches(self, rule: dict, anomaly: DetectionResult) -> bool:
        """Check if a suppression rule matches an anomaly's dimensions."""
        criteria = rule.get("match_criteria", {})
        dim = anomaly.dimension

        for key, expected_values in criteria.items():
            actual = getattr(dim, key, None)
            if actual and actual not in expected_values:
                return False
        return True

    # -----------------------------------------------------------------------
    # Baseline Management
    # -----------------------------------------------------------------------

    async def _compute_baseline(self, dim: CostDimension) -> Baseline:
        """
        FSD Step 3: Compute dynamic baseline from historical cost data.
        Caches in Redis with 7-day TTL.
        """
        cache_key = f"finops:{dim.tenant_id}:anomaly:baseline:{dim.dimension_hash}"

        # Try Redis cache first
        cached = await self.redis.hgetall(cache_key)
        if cached and float(cached.get("sample_count", 0)) >= 7:
            return Baseline(
                mean=float(cached["mean"]),
                stddev=float(cached["stddev"]),
                median=float(cached.get("median", 0)),
                q1=float(cached.get("q1", 0)),
                q3=float(cached.get("q3", 0)),
                iqr=float(cached.get("iqr", 0)),
                ewma=float(cached.get("ewma", 0)),
                sample_count=int(cached["sample_count"]),
                last_values=[float(v) for v in cached.get("last_values", "").split(",") if v],
                last_updated=cached.get("last_updated", ""),
            )

        # Compute from DB
        values = await self._get_historical_values(dim, self.lookback_days)
        if len(values) < 7:
            return Baseline(sample_count=len(values))

        arr = np.array(values, dtype=float)
        q1, q3 = np.percentile(arr, [25, 75])

        baseline = Baseline(
            mean=float(np.mean(arr)),
            stddev=float(np.std(arr)),
            median=float(np.median(arr)),
            q1=float(q1),
            q3=float(q3),
            iqr=float(q3 - q1),
            ewma=float(arr[-1]),  # Initialize EWMA with last value
            sample_count=len(values),
            last_values=values[-7:],
            last_updated=datetime.now(timezone.utc).isoformat(),
        )

        # Cache to Redis
        cache_data = {
            "mean": str(baseline.mean),
            "stddev": str(baseline.stddev),
            "median": str(baseline.median),
            "q1": str(baseline.q1),
            "q3": str(baseline.q3),
            "iqr": str(baseline.iqr),
            "ewma": str(baseline.ewma),
            "sample_count": str(baseline.sample_count),
            "last_values": ",".join(str(v) for v in baseline.last_values),
            "last_updated": baseline.last_updated,
        }
        await self.redis.hset(cache_key, mapping=cache_data)
        await self.redis.expire(cache_key, 604800)  # 7 days

        return baseline

    async def _update_ewma(self, dim: CostDimension, current_value: float):
        """Update EWMA value in Redis cache."""
        cache_key = f"finops:{dim.tenant_id}:anomaly:baseline:{dim.dimension_hash}"
        cached_ewma = await self.redis.hget(cache_key, "ewma")
        if cached_ewma:
            old_ewma = float(cached_ewma)
            new_ewma = self.ewma_alpha * current_value + (1 - self.ewma_alpha) * old_ewma
            await self.redis.hset(cache_key, "ewma", str(new_ewma))

    # -----------------------------------------------------------------------
    # Data Access (placeholders — real impl queries PostgreSQL)
    # -----------------------------------------------------------------------

    async def _discover_dimensions(self, tenant_id: str) -> list[CostDimension]:
        """Discover unique cost dimension tuples from normalized data."""
        return []  # Real: SELECT DISTINCT provider, service_name, region, ... FROM normalized_cost_record

    async def _get_current_value(self, dim: CostDimension) -> Optional[float]:
        """Get the latest daily cost for a dimension tuple."""
        return None  # Real: SUM(billed_cost_sar) WHERE billing_period = current

    async def _get_historical_values(self, dim: CostDimension, days: int) -> list[float]:
        """Get daily cost values for the lookback period."""
        return []  # Real: daily SUM(billed_cost_sar) GROUP BY billing_period ORDER BY date

    async def _load_suppression_rules(self, tenant_id: str) -> list[dict]:
        """Load active suppression rules."""
        return []  # Real: SELECT * FROM suppression_rule WHERE is_active AND tenant_id
