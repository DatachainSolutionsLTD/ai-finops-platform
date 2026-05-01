"""
A27 Orchestrator Agent — Skeleton Pipeline Coordinator
FSD Reference: A27 FSD (Seed: Minimal Coordination Only)
Scope: A01 → A02 → A03 → A04/A05 pipeline sequencing

Seed Capabilities:
  - Sequential pipeline coordination (ingestion → normalization → allocation → reporting/anomaly)
  - Agent health monitoring (heartbeat polling)
  - Event bus subscription (Redis Pub/Sub)
  - Pipeline status tracking
  - Error propagation and retry coordination

Deferred to Angel:
  - Priority arbitration, resource allocation, multi-agent workflow engine
  - Conflict resolution routing to A28
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

logger = logging.getLogger("agent.a27.orchestrator")


class PipelineStage(str, Enum):
    INGESTION = "ingestion"
    NORMALIZATION = "normalization"
    ALLOCATION = "allocation"
    REPORTING = "reporting"
    ANOMALY_DETECTION = "anomaly_detection"


class PipelineStatus(str, Enum):
    IDLE = "Idle"
    RUNNING = "Running"
    COMPLETED = "Completed"
    PARTIAL = "Partial"
    FAILED = "Failed"


# Pipeline dependency graph (Seed: linear chain)
PIPELINE_GRAPH = {
    PipelineStage.INGESTION: [],
    PipelineStage.NORMALIZATION: [PipelineStage.INGESTION],
    PipelineStage.ALLOCATION: [PipelineStage.NORMALIZATION],
    PipelineStage.REPORTING: [PipelineStage.ALLOCATION],
    PipelineStage.ANOMALY_DETECTION: [PipelineStage.NORMALIZATION],
}

# Agent → Stage mapping
STAGE_AGENTS = {
    PipelineStage.INGESTION: "A01",
    PipelineStage.NORMALIZATION: "A02",
    PipelineStage.ALLOCATION: "A03",
    PipelineStage.REPORTING: "A04",
    PipelineStage.ANOMALY_DETECTION: "A05",
}


class PipelineRun:
    """Tracks a single end-to-end pipeline execution."""

    def __init__(self, tenant_id: str, trigger: str = "Scheduled"):
        self.run_id = str(uuid.uuid4())
        self.tenant_id = tenant_id
        self.trigger = trigger
        self.status = PipelineStatus.IDLE
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.stage_results: dict[PipelineStage, dict] = {}
        self.current_stage: Optional[PipelineStage] = None

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "tenant_id": self.tenant_id,
            "trigger": self.trigger,
            "status": self.status,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "current_stage": self.current_stage,
            "stage_results": {
                k.value: v for k, v in self.stage_results.items()
            },
            "duration_seconds": (
                (self.end_time - self.start_time).total_seconds()
                if self.end_time and self.start_time
                else None
            ),
        }


class OrchestratorEngine:
    """
    Seed-scope pipeline orchestrator.

    Manages the A01→A02→A03→A04/A05 data flow sequence.
    Listens to Redis Pub/Sub events and coordinates stage transitions.
    """

    def __init__(self, redis_client, db_session, event_publisher):
        self.redis = redis_client
        self.db = db_session
        self.publisher = event_publisher
        self.active_runs: dict[str, PipelineRun] = {}
        self.agent_health: dict[str, dict] = {}
        self._running = False

    # -----------------------------------------------------------------------
    # Pipeline Execution
    # -----------------------------------------------------------------------

    async def execute_full_pipeline(self, tenant_id: str, trigger: str = "Scheduled") -> dict:
        """
        Execute the complete Seed pipeline: A01 → A02 → A03 → (A04 + A05 parallel).
        """
        run = PipelineRun(tenant_id, trigger)
        self.active_runs[run.run_id] = run
        run.status = PipelineStatus.RUNNING
        run.start_time = datetime.now(timezone.utc)

        logger.info(
            "Pipeline started",
            extra={"run_id": run.run_id, "tenant_id": tenant_id, "trigger": trigger},
        )

        try:
            # Stage 1: Ingestion (A01)
            ingestion_result = await self._execute_stage(
                run, PipelineStage.INGESTION, tenant_id
            )
            if ingestion_result.get("status") == "Failed":
                run.status = PipelineStatus.FAILED
                return self._finalize_run(run)

            # Stage 2: Normalization (A02) — depends on ingestion
            normalization_result = await self._execute_stage(
                run, PipelineStage.NORMALIZATION, tenant_id,
                context={"source_run_id": ingestion_result.get("run_id")},
            )
            if normalization_result.get("status") == "Failed":
                run.status = PipelineStatus.PARTIAL
                return self._finalize_run(run)

            # Stage 3: Allocation (A03) — depends on normalization
            allocation_result = await self._execute_stage(
                run, PipelineStage.ALLOCATION, tenant_id,
                context={
                    "normalization_run_id": normalization_result.get("run_id"),
                    "billing_period": normalization_result.get("billing_period"),
                },
            )

            # Stage 4a + 4b: Reporting (A04) + Anomaly Detection (A05) — parallel
            reporting_task = self._execute_stage(
                run, PipelineStage.REPORTING, tenant_id,
                context={"allocation_run_id": allocation_result.get("run_id")},
            )
            anomaly_task = self._execute_stage(
                run, PipelineStage.ANOMALY_DETECTION, tenant_id,
                context={"normalization_run_id": normalization_result.get("run_id")},
            )

            reporting_result, anomaly_result = await asyncio.gather(
                reporting_task, anomaly_task, return_exceptions=True
            )

            # Handle exceptions from parallel stages
            if isinstance(reporting_result, Exception):
                run.stage_results[PipelineStage.REPORTING] = {
                    "status": "Failed", "error": str(reporting_result)
                }
            if isinstance(anomaly_result, Exception):
                run.stage_results[PipelineStage.ANOMALY_DETECTION] = {
                    "status": "Failed", "error": str(anomaly_result)
                }

            # Determine overall status
            all_stages = list(run.stage_results.values())
            if all(s.get("status") == "Completed" for s in all_stages):
                run.status = PipelineStatus.COMPLETED
            elif any(s.get("status") == "Failed" for s in all_stages):
                run.status = PipelineStatus.PARTIAL
            else:
                run.status = PipelineStatus.COMPLETED

        except Exception as e:
            logger.error(f"Pipeline execution failed: {e}", exc_info=True)
            run.status = PipelineStatus.FAILED

        return self._finalize_run(run)

    async def _execute_stage(
        self,
        run: PipelineRun,
        stage: PipelineStage,
        tenant_id: str,
        context: Optional[dict] = None,
    ) -> dict:
        """Execute a single pipeline stage and wait for completion."""
        agent = STAGE_AGENTS[stage]
        run.current_stage = stage

        logger.info(f"Executing stage: {stage.value} (Agent {agent})")

        # Check agent health before dispatching
        if not await self._check_agent_health(agent, tenant_id):
            result = {"status": "Failed", "error": f"Agent {agent} is unhealthy"}
            run.stage_results[stage] = result
            return result

        # Dispatch to agent via internal API call
        try:
            result = await self._dispatch_to_agent(agent, tenant_id, stage, context)
            run.stage_results[stage] = result

            # Cache result in Redis for downstream consumers
            cache_key = f"finops:{tenant_id}:pipeline:{run.run_id}:{stage.value}"
            await self.redis.set(cache_key, json.dumps(result), ex=86400)

            return result

        except Exception as e:
            result = {"status": "Failed", "error": str(e)}
            run.stage_results[stage] = result
            return result

    async def _dispatch_to_agent(
        self, agent: str, tenant_id: str, stage: PipelineStage, context: dict
    ) -> dict:
        """Dispatch work to an agent via HTTP API call."""
        import httpx

        agent_name = {
            "A01": "a01-data-ingestion",
            "A02": "a02-cost-normalization",
            "A03": "a03-allocation",
            "A04": "a04-reporting-analytics",
            "A05": "a05-anomaly-detection",
        }[agent]

        base_url = f"http://finops-{agent_name}.tenant-g42-seed:8080"

        endpoints = {
            PipelineStage.INGESTION: ("/connectors/auto-trigger", "POST"),
            PipelineStage.NORMALIZATION: ("/runs/auto-trigger", "POST"),
            PipelineStage.ALLOCATION: ("/runs/trigger", "POST"),
            PipelineStage.REPORTING: ("/reports/auto-generate", "POST"),
            PipelineStage.ANOMALY_DETECTION: ("/detection-runs/trigger", "POST"),
        }

        path, method = endpoints[stage]
        url = f"{base_url}{path}"

        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.request(
                method,
                url,
                headers={"X-Tenant-ID": tenant_id},
                json=context or {},
            )
            resp.raise_for_status()
            return resp.json()

    def _finalize_run(self, run: PipelineRun) -> dict:
        """Finalize pipeline run and log summary."""
        run.end_time = datetime.now(timezone.utc)
        summary = run.to_dict()

        logger.info(
            "Pipeline completed",
            extra={
                "run_id": run.run_id,
                "status": run.status,
                "stages": len(run.stage_results),
                "duration_s": summary.get("duration_seconds"),
            },
        )

        # Cleanup
        self.active_runs.pop(run.run_id, None)
        return summary

    # -----------------------------------------------------------------------
    # Agent Health Monitoring
    # -----------------------------------------------------------------------

    async def _check_agent_health(self, agent: str, tenant_id: str) -> bool:
        """Check agent health via Redis cache or direct health endpoint."""
        cache_key = f"finops:{tenant_id}:agent:{agent}:health"
        cached = await self.redis.hgetall(cache_key)

        if cached and cached.get("status") == "healthy":
            return True

        # Direct health check
        try:
            agent_name = {
                "A01": "a01-data-ingestion",
                "A02": "a02-cost-normalization",
                "A03": "a03-allocation",
                "A04": "a04-reporting-analytics",
                "A05": "a05-anomaly-detection",
            }.get(agent, "")

            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"http://finops-{agent_name}.tenant-g42-seed:8080/healthz"
                )
                is_healthy = resp.status_code == 200

                # Update cache
                await self.redis.hset(cache_key, mapping={
                    "status": "healthy" if is_healthy else "unhealthy",
                    "last_check": datetime.now(timezone.utc).isoformat(),
                })
                await self.redis.expire(cache_key, 300)

                return is_healthy
        except Exception as e:
            logger.warning(f"Health check failed for {agent}: {e}")
            return False

    async def monitor_agent_health(self):
        """Background task: periodic health checks for all seed agents."""
        agents = ["A01", "A02", "A03", "A04", "A05"]
        tenant_id = "g42-seed"

        while self._running:
            for agent in agents:
                healthy = await self._check_agent_health(agent, tenant_id)
                self.agent_health[agent] = {
                    "status": "Healthy" if healthy else "Degraded",
                    "last_check": datetime.now(timezone.utc).isoformat(),
                }

                # Publish health status
                await self.publisher.publish(
                    "finops.platform.agent-health.v1",
                    {
                        "event_id": str(uuid.uuid4()),
                        "event_type": "platform.agent.health",
                        "event_timestamp": datetime.now(timezone.utc).isoformat(),
                        "agent_id": agent,
                        "status": "Healthy" if healthy else "Degraded",
                    },
                )

            await asyncio.sleep(60)  # Check every 60 seconds

    # -----------------------------------------------------------------------
    # Event Bus Listener
    # -----------------------------------------------------------------------

    async def start_event_listener(self):
        """Listen for inter-agent events on Redis Pub/Sub."""
        self._running = True
        pubsub = self.redis.pubsub()

        # Subscribe to all agent completion events
        await pubsub.subscribe(
            "finops.ingestion.run-completed.v1",
            "finops.ingestion.run-failed.v1",
            "finops.normalization.run-completed.v1",
            "finops.allocation.run-completed.v1",
            "finops.anomaly.detected.v1",
            "finops.anomaly.storm-activated.v1",
        )

        logger.info("A27 event listener started")

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue

            try:
                event = json.loads(message["data"])
                channel = message["channel"]

                if isinstance(channel, bytes):
                    channel = channel.decode()

                await self._handle_event(channel, event)

            except Exception as e:
                logger.error(f"Event handling error: {e}", exc_info=True)

    async def _handle_event(self, channel: str, event: dict):
        """Route events to appropriate handlers."""
        event_type = event.get("event_type", "")

        if "ingestion.run.failed" in channel:
            logger.warning(
                "Ingestion failure detected — pipeline halted for tenant",
                extra={"tenant_id": event.get("tenant_id"), "error": event.get("error_type")},
            )

        elif "anomaly.storm-activated" in channel:
            logger.warning(
                "Anomaly storm mode activated — batching alerts",
                extra={
                    "tenant_id": event.get("tenant_id"),
                    "anomaly_count": event.get("anomaly_count"),
                },
            )

        # Log all events for audit
        logger.info(f"Event received: {event_type}", extra={"event": event})

    async def stop(self):
        """Graceful shutdown."""
        self._running = False
        logger.info("A27 orchestrator shutting down")

    # -----------------------------------------------------------------------
    # Status API
    # -----------------------------------------------------------------------

    def get_pipeline_status(self) -> dict:
        """Return current orchestrator state."""
        return {
            "agent": "A27",
            "version": "0.1.0",
            "status": "Running" if self._running else "Stopped",
            "active_pipeline_runs": len(self.active_runs),
            "agent_health": self.agent_health,
            "pipelines": [r.to_dict() for r in self.active_runs.values()],
        }
