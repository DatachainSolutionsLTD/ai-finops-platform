"""
Airflow DAGs — Seed Ingestion Pipeline
FSD Reference: A01 Flow 1 (TRG-01), A02 Flow 1, A03 Flow 1
Pipeline: AWS CUR Ingestion → FOCUS Normalization → Cost Allocation

Schedule: Every 12 hours (0 2,14 * * *)
Tenant: G42 (Seed — single tenant, parameterized for Angel multi-tenant)
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.decorators import task
from airflow.operators.python import PythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator
from airflow.providers.http.operators.http import SimpleHttpOperator
from airflow.utils.trigger_rule import TriggerRule

# =============================================================================
# DAG 1: AWS CUR Ingestion Pipeline (A01)
# FSD: A01 Flow 1 — Cloud Ingestion, Steps 1–12
# =============================================================================

COMMON_ARGS = {
    "owner": "finops-platform",
    "depends_on_past": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=30),
    "execution_timeout": timedelta(hours=2),
    "tags": ["seed", "ingestion", "a01"],
}

with DAG(
    dag_id="a01_aws_cur_ingestion",
    description="A01: Ingest AWS CUR billing data, validate, stage, publish event",
    schedule_interval="0 2,14 * * *",
    start_date=datetime(2026, 6, 1),
    catchup=False,
    max_active_runs=1,
    default_args=COMMON_ARGS,
) as dag_a01:

    @task(task_id="discover_connectors")
    def discover_connectors(**context):
        """
        FSD Step 2: Query Connector Registry for all active AWS connectors.
        Returns list of connector_ids to process.
        """
        import requests

        resp = requests.get(
            "http://finops-a01-data-ingestion.tenant-g42-seed:8080/connectors",
            headers={"X-Tenant-ID": context["params"].get("tenant_id", "g42-seed")},
            params={"source_type": "AWS", "is_active": "true"},
            timeout=30,
        )
        resp.raise_for_status()
        connectors = resp.json()["data"]
        return [c["connector_id"] for c in connectors]

    @task(task_id="ingest_cur_data")
    def ingest_cur_data(connector_ids: list, **context):
        """
        FSD Steps 3, 7, 8: For each AWS connector:
        - Discover new CUR partitions
        - Extract Parquet line items
        - Deduplicate via hash comparison
        - Validate mandatory fields
        - Write to staging (S3 + PostgreSQL raw_staging_record)
        - Cost reconciliation check
        """
        import requests

        tenant_id = context["params"].get("tenant_id", "g42-seed")
        run_results = []

        for connector_id in connector_ids:
            resp = requests.post(
                f"http://finops-a01-data-ingestion.tenant-g42-seed:8080/connectors/{connector_id}/trigger",
                headers={"X-Tenant-ID": tenant_id},
                json={"billing_period": context["ds"]},
                timeout=300,
            )
            resp.raise_for_status()
            result = resp.json()
            run_results.append(result)

            context["ti"].xcom_push(
                key=f"run_id_{connector_id}", value=result["run_id"]
            )

        return run_results

    @task(task_id="wait_for_completion")
    def wait_for_completion(run_results: list, **context):
        """
        Poll ingestion run status until all runs complete or fail.
        FSD Step 11: Update Ingestion Run Log with final status.
        """
        import time
        import requests

        tenant_id = context["params"].get("tenant_id", "g42-seed")
        max_wait = 3600  # 1 hour max
        poll_interval = 15  # seconds
        elapsed = 0
        completed_runs = []

        pending_run_ids = [r["run_id"] for r in run_results]

        while pending_run_ids and elapsed < max_wait:
            for run_id in list(pending_run_ids):
                resp = requests.get(
                    f"http://finops-a01-data-ingestion.tenant-g42-seed:8080/runs/{run_id}",
                    headers={"X-Tenant-ID": tenant_id},
                    timeout=30,
                )
                run = resp.json()

                if run["status"] in ("Completed", "Partial", "Failed", "Quarantined"):
                    pending_run_ids.remove(run_id)
                    completed_runs.append(run)

            if pending_run_ids:
                time.sleep(poll_interval)
                elapsed += poll_interval

        # Push aggregated results for downstream
        total_records = sum(r.get("records_validated", 0) for r in completed_runs)
        failed_count = sum(1 for r in completed_runs if r["status"] == "Failed")

        return {
            "completed_runs": len(completed_runs),
            "total_records_ingested": total_records,
            "failed_runs": failed_count,
            "run_ids": [r["run_id"] for r in completed_runs],
        }

    @task(task_id="publish_completion_event")
    def publish_completion_event(summary: dict, **context):
        """
        FSD Step 9: Publish ingestion completion event to message bus.
        Triggers A02 normalization via Redis Pub/Sub.
        """
        import json
        import redis
        import uuid

        r = redis.from_url(context["params"].get("redis_url", "redis://redis:6379/1"))
        tenant_id = context["params"].get("tenant_id", "g42-seed")

        for run_id in summary["run_ids"]:
            event = {
                "event_id": str(uuid.uuid4()),
                "event_type": "ingestion.run.completed",
                "event_timestamp": datetime.utcnow().isoformat(),
                "tenant_id": tenant_id,
                "run_id": run_id,
                "status": "Completed",
                "records_received": summary["total_records_ingested"],
                "billing_period": context["ds"],
                "pipeline_version": "0.1.0",
            }
            r.publish(
                "finops.ingestion.run-completed.v1",
                json.dumps(event),
            )

        return summary

    @task(task_id="log_audit_entry", trigger_rule=TriggerRule.ALL_DONE)
    def log_audit_entry(summary: dict, **context):
        """FSD Step 11: Record immutable audit log entry."""
        import requests

        requests.post(
            "http://finops-a01-data-ingestion.tenant-g42-seed:8080/audit-log",
            headers={"X-Tenant-ID": context["params"].get("tenant_id", "g42-seed")},
            json={
                "event_type": "Ingestion_Completed",
                "event_detail": summary,
            },
            timeout=30,
        )

    # DAG orchestration
    connectors = discover_connectors()
    results = ingest_cur_data(connectors)
    summary = wait_for_completion(results)
    publish_completion_event(summary)
    log_audit_entry(summary)


# =============================================================================
# DAG 2: FOCUS Normalization Pipeline (A02)
# FSD: A02 Flow 1 — Event-triggered normalization, Steps 1–11
# Trigger: Ingestion completion event (or manual via API)
# =============================================================================

with DAG(
    dag_id="a02_focus_normalization",
    description="A02: Normalize ingested data to FOCUS schema via dbt pipeline",
    schedule_interval=None,  # Event-triggered (or externally triggered)
    start_date=datetime(2026, 6, 1),
    catchup=False,
    max_active_runs=2,
    default_args={**COMMON_ARGS, "tags": ["seed", "normalization", "a02"]},
) as dag_a02:

    @task(task_id="receive_ingestion_event")
    def receive_ingestion_event(**context):
        """
        FSD Step 1-2: Validate ingestion completion event.
        Receives run_id from DAG trigger config or manual parameter.
        """
        conf = context.get("dag_run").conf or {}
        source_run_id = conf.get("source_run_id")
        tenant_id = conf.get("tenant_id", "g42-seed")

        if not source_run_id:
            raise ValueError("source_run_id is required in DAG trigger config")

        return {"source_run_id": source_run_id, "tenant_id": tenant_id}

    @task(task_id="run_dbt_normalization")
    def run_dbt_normalization(event_data: dict, **context):
        """
        FSD Steps 5-10: Execute dbt models for FOCUS normalization.
        - stg_raw_cost_records: staging layer
        - int_taxonomy_mapped: service taxonomy mapping
        - int_currency_converted: USD → SAR conversion
        - int_unit_normalized: usage unit standardization
        - int_dimensionally_enriched: org dimension tagging
        - fct_normalized_cost_record: final FOCUS-compliant output
        """
        import subprocess

        result = subprocess.run(
            [
                "dbt", "run",
                "--project-dir", "/app/dbt",
                "--profiles-dir", "/app/dbt",
                "--select", "tag:normalization",
                "--vars", f'{{"source_run_id": "{event_data["source_run_id"]}", '
                          f'"tenant_id": "{event_data["tenant_id"]}"}}',
            ],
            capture_output=True,
            text=True,
            timeout=1800,
        )

        if result.returncode != 0:
            raise RuntimeError(f"dbt run failed: {result.stderr}")

        return {
            "dbt_status": "success",
            "source_run_id": event_data["source_run_id"],
            "tenant_id": event_data["tenant_id"],
            "stdout": result.stdout[-2000:],  # Last 2K chars
        }

    @task(task_id="run_dbt_quality_tests")
    def run_dbt_quality_tests(dbt_result: dict, **context):
        """
        FSD Step 11: Quality validation via dbt tests.
        - FOCUS mandatory field completeness
        - Cost reconciliation within 0.1% tolerance
        - Dimensional coverage >= 85%
        - Taxonomy coverage >= 95%
        """
        import subprocess

        result = subprocess.run(
            [
                "dbt", "test",
                "--project-dir", "/app/dbt",
                "--profiles-dir", "/app/dbt",
                "--select", "tag:normalization_quality",
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )

        tests_passed = result.returncode == 0
        return {
            "tests_passed": tests_passed,
            "test_output": result.stdout[-2000:],
            **dbt_result,
        }

    @task(task_id="publish_normalization_event")
    def publish_normalization_event(quality_result: dict, **context):
        """
        FSD Step 13: Publish normalization completion event.
        Triggers A03 allocation, A04 reporting, A05 anomaly detection.
        """
        import json
        import redis
        import uuid

        r = redis.from_url(context["params"].get("redis_url", "redis://redis:6379/1"))

        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "normalization.run.completed",
            "event_timestamp": datetime.utcnow().isoformat(),
            "tenant_id": quality_result["tenant_id"],
            "source_run_id": quality_result["source_run_id"],
            "status": "Completed" if quality_result["tests_passed"] else "Partial",
            "billing_period": context.get("ds", ""),
            "pipeline_version": "0.1.0",
        }
        r.publish("finops.normalization.run-completed.v1", json.dumps(event))

        return event

    # DAG orchestration
    event = receive_ingestion_event()
    dbt_out = run_dbt_normalization(event)
    quality = run_dbt_quality_tests(dbt_out)
    publish_normalization_event(quality)


# =============================================================================
# DAG 3: Cost Allocation Pipeline (A03)
# FSD: A03 Flow 1 — Normalization-triggered allocation, Steps 1–7
# Trigger: Normalization completion event (or manual)
# =============================================================================

with DAG(
    dag_id="a03_cost_allocation",
    description="A03: Allocate normalized costs to owners using configured rules",
    schedule_interval=None,  # Event-triggered
    start_date=datetime(2026, 6, 1),
    catchup=False,
    max_active_runs=2,
    default_args={**COMMON_ARGS, "tags": ["seed", "allocation", "a03"]},
) as dag_a03:

    @task(task_id="receive_normalization_event")
    def receive_normalization_event(**context):
        """FSD Step 1: Receive normalization completion event."""
        conf = context.get("dag_run").conf or {}
        return {
            "normalization_run_id": conf.get("normalization_run_id"),
            "tenant_id": conf.get("tenant_id", "g42-seed"),
            "billing_period": conf.get("billing_period"),
        }

    @task(task_id="execute_allocation")
    def execute_allocation(event_data: dict, **context):
        """
        FSD Steps 2-7: Execute allocation engine.
        Calls A03 API which handles rule evaluation, fixed/proportional/dynamic
        allocation, shared pool distribution, and reconciliation.
        """
        import requests

        tenant_id = event_data["tenant_id"]

        # Trigger allocation run via A03 API
        resp = requests.post(
            "http://finops-a03-allocation.tenant-g42-seed:8080/runs/trigger",
            headers={"X-Tenant-ID": tenant_id},
            json={
                "normalization_run_id": event_data["normalization_run_id"],
                "billing_period": event_data["billing_period"],
                "trigger_type": "Normalization_Event",
            },
            timeout=600,
        )
        resp.raise_for_status()
        return resp.json()

    @task(task_id="wait_for_allocation")
    def wait_for_allocation(run_result: dict, **context):
        """Wait for allocation run to complete."""
        import time
        import requests

        run_id = run_result["run_id"]
        tenant_id = context.get("dag_run").conf.get("tenant_id", "g42-seed")

        for _ in range(120):  # 30 min max
            resp = requests.get(
                f"http://finops-a03-allocation.tenant-g42-seed:8080/runs/{run_id}",
                headers={"X-Tenant-ID": tenant_id},
                timeout=30,
            )
            run = resp.json()
            if run["status"] in ("Completed", "Partial", "Failed"):
                return run
            time.sleep(15)

        raise TimeoutError(f"Allocation run {run_id} did not complete within 30 minutes")

    @task(task_id="publish_allocation_event")
    def publish_allocation_event(run: dict, **context):
        """FSD: Publish allocation completion event to A04/A27."""
        import json
        import redis
        import uuid

        r = redis.from_url(context["params"].get("redis_url", "redis://redis:6379/1"))
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "allocation.run.completed",
            "event_timestamp": datetime.utcnow().isoformat(),
            "tenant_id": run["tenant_id"],
            "run_id": run["run_id"],
            "billing_period": run["billing_period"],
            "status": run["status"],
            "records_allocated": run.get("records_allocated", 0),
            "coverage_rate_pct": run.get("coverage_rate_pct", 0),
            "pipeline_version": "0.1.0",
        }
        r.publish("finops.allocation.run-completed.v1", json.dumps(event))
        return event

    # DAG orchestration
    event = receive_normalization_event()
    run = execute_allocation(event)
    completed = wait_for_allocation(run)
    publish_allocation_event(completed)


# =============================================================================
# DAG 4: Master Pipeline Orchestrator (A27 Skeleton)
# Chains: A01 → A02 → A03 in sequence
# =============================================================================

with DAG(
    dag_id="a27_master_pipeline",
    description="A27: Master orchestrator — chains ingestion → normalization → allocation",
    schedule_interval="0 2,14 * * *",
    start_date=datetime(2026, 6, 1),
    catchup=False,
    max_active_runs=1,
    default_args={**COMMON_ARGS, "tags": ["seed", "orchestrator", "a27"]},
) as dag_a27:

    trigger_ingestion = TriggerDagRunOperator(
        task_id="trigger_ingestion",
        trigger_dag_id="a01_aws_cur_ingestion",
        conf={"tenant_id": "g42-seed"},
        wait_for_completion=True,
        poke_interval=30,
        allowed_states=["success"],
    )

    trigger_normalization = TriggerDagRunOperator(
        task_id="trigger_normalization",
        trigger_dag_id="a02_focus_normalization",
        conf={"tenant_id": "g42-seed", "source_run_id": "{{ ti.xcom_pull(task_ids='trigger_ingestion') }}"},
        wait_for_completion=True,
        poke_interval=30,
        allowed_states=["success"],
    )

    trigger_allocation = TriggerDagRunOperator(
        task_id="trigger_allocation",
        trigger_dag_id="a03_cost_allocation",
        conf={"tenant_id": "g42-seed"},
        wait_for_completion=True,
        poke_interval=30,
        allowed_states=["success"],
    )

    trigger_ingestion >> trigger_normalization >> trigger_allocation
