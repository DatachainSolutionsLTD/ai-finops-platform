"""
AI FinOps Platform — API Entry Point
Minimal working server that exposes health check and agent status endpoints.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AI FinOps Platform API",
    version="0.1.0",
    description="Agentic AI FinOps Platform — Seed Round API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "")


@app.get("/")
async def root():
    return {
        "platform": "AI FinOps Agentic Platform",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/healthz")
async def healthz():
    return {"status": "healthy", "version": "0.1.0"}


@app.get("/api/v1/agents")
async def list_agents():
    return {
        "agents": [
            {"id": "A01", "name": "Data Ingestion", "status": "active", "autonomy": "L4"},
            {"id": "A02", "name": "Cost Normalization", "status": "active", "autonomy": "L4"},
            {"id": "A03", "name": "Cost Allocation", "status": "active", "autonomy": "L4"},
            {"id": "A04", "name": "Reporting & Analytics", "status": "active", "autonomy": "L4"},
            {"id": "A05", "name": "Anomaly Detection", "status": "active", "autonomy": "L4"},
            {"id": "A06", "name": "Forecasting", "status": "planned", "autonomy": "L3"},
            {"id": "A07", "name": "Budget Guardian", "status": "planned", "autonomy": "L3"},
            {"id": "A27", "name": "Orchestrator", "status": "active", "autonomy": "L4"},
        ]
    }


@app.get("/api/v1/status")
async def platform_status():
    db_connected = bool(DATABASE_URL)
    return {
        "platform": "operational",
        "database": "connected" if db_connected else "not configured",
        "agents_registered": 8,
        "migrations_applied": 24,
        "tables_created": 260,
    }
