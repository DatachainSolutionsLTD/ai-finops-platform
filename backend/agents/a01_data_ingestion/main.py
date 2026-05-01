# =============================================================================
# A01 Data Ingestion Agent — Module Decomposition & Package Scaffold
# ORALC Paradigm: Observe → Reason → Act → Learn → Communicate
# Autonomy Level: L4 (Fully Autonomous)
# =============================================================================
# services/a01-data-ingestion/
# ├── src/
# │   ├── __init__.py
# │   ├── main.py                    # FastAPI app entry point
# │   ├── config.py                  # Agent configuration & env vars
# │   ├── models/                    # Pydantic models + SQLAlchemy ORM
# │   │   ├── __init__.py
# │   │   ├── connector.py           # DataSourceConnector entity
# │   │   ├── run_log.py             # IngestionRunLog entity
# │   │   ├── staging.py             # RawStagingRecord entity
# │   │   ├── rate_card.py           # RateCard entity
# │   │   ├── audit_log.py           # IngestionAuditLog entity
# │   │   └── events.py              # Event payload schemas
# │   ├── connectors/                # OBSERVE — Source-specific connectors
# │   │   ├── __init__.py
# │   │   ├── base.py                # Abstract base connector
# │   │   ├── aws_cur.py             # AWS CUR connector (Seed primary)
# │   │   ├── manual_upload.py       # CSV/XLSX manual upload handler
# │   │   └── registry.py            # Connector factory/registry
# │   ├── pipeline/                  # ACT — Ingestion pipeline stages
# │   │   ├── __init__.py
# │   │   ├── extractor.py           # Data extraction from sources
# │   │   ├── validator.py           # Data quality validation
# │   │   ├── deduplicator.py        # Hash-based delta detection
# │   │   ├── stager.py              # Write to S3 staging + PostgreSQL
# │   │   └── reconciler.py          # Source vs. staged cost reconciliation
# │   ├── health/                    # OBSERVE + LEARN — Pipeline monitoring
# │   │   ├── __init__.py
# │   │   ├── monitor.py             # Connector health monitoring
# │   │   ├── retry.py               # Exponential backoff retry logic
# │   │   └── schema_detector.py     # Source schema change detection
# │   ├── events/                    # COMMUNICATE — Inter-agent events
# │   │   ├── __init__.py
# │   │   ├── publisher.py           # Redis Pub/Sub event publisher
# │   │   └── subscriber.py          # Event listener (orchestrator cmds)
# │   ├── api/                       # REST API endpoints (OpenAPI A01)
# │   │   ├── __init__.py
# │   │   ├── routes_connectors.py   # /connectors CRUD
# │   │   ├── routes_runs.py         # /runs listing + details
# │   │   ├── routes_upload.py       # /upload manual ingestion
# │   │   ├── routes_rate_cards.py   # /rate-cards CRUD
# │   │   ├── routes_health.py       # /health + /audit-log
# │   │   └── middleware.py          # Tenant context injection, RLS SET
# │   └── services/                  # REASON — Business logic orchestration
# │       ├── __init__.py
# │       ├── ingestion_service.py   # Core ingestion orchestration
# │       ├── connector_service.py   # Connector lifecycle management
# │       ├── upload_service.py      # Manual upload processing
# │       └── audit_service.py       # Immutable audit log writer
# ├── tests/
# │   ├── unit/
# │   ├── integration/
# │   └── conftest.py
# ├── Dockerfile
# ├── requirements.txt
# └── pyproject.toml
# =============================================================================

"""
A01 Data Ingestion Agent — Main Application Entry Point
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import Settings
from src.api.routes_connectors import router as connectors_router
from src.api.routes_runs import router as runs_router
from src.api.routes_upload import router as upload_router
from src.api.routes_rate_cards import router as rate_cards_router
from src.api.routes_health import router as health_router
from src.api.middleware import TenantContextMiddleware
from src.events.subscriber import EventSubscriber
from src.health.monitor import HealthMonitor

logger = logging.getLogger("agent.a01")
settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect DB, Redis, Vault. Shutdown: graceful drain."""
    logger.info(
        "A01 Data Ingestion Agent starting",
        extra={"version": settings.agent_version, "autonomy": "L4"},
    )

    # Initialize event subscriber (listen for orchestrator commands)
    subscriber = EventSubscriber(redis_url=settings.redis_url)
    await subscriber.start()

    # Initialize health monitor (background connector health checks)
    monitor = HealthMonitor(check_interval=settings.health_check_interval)
    await monitor.start()

    yield

    # Graceful shutdown
    await monitor.stop()
    await subscriber.stop()
    logger.info("A01 Data Ingestion Agent stopped")


app = FastAPI(
    title="Data Ingestion Agent (A01)",
    version="0.1.0",
    lifespan=lifespan,
    root_path="/api/v1/ingestion",
)

app.add_middleware(TenantContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(connectors_router, prefix="/connectors", tags=["Connectors"])
app.include_router(runs_router, prefix="/runs", tags=["Ingestion Runs"])
app.include_router(upload_router, prefix="/upload", tags=["Manual Upload"])
app.include_router(rate_cards_router, prefix="/rate-cards", tags=["Rate Cards"])
app.include_router(health_router, tags=["Health"])


@app.get("/healthz")
async def healthz():
    return {"status": "healthy", "agent": "A01", "version": settings.agent_version}


@app.get("/readyz")
async def readyz():
    # Check DB + Redis connectivity
    return {"status": "ready"}


@app.get("/metrics")
async def metrics():
    # Prometheus metrics endpoint (instrumented via opentelemetry)
    return {"status": "ok"}
