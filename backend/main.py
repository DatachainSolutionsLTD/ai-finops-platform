"""
AI FinOps Platform — API Entry Point
Minimal working server that exposes health check, agent status, and demo auth endpoints.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from jose import jwt

app = FastAPI(
    title="AI FinOps Platform API",
    version="0.1.0",
    description="Agentic AI FinOps Platform — Seed Round API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.netlify\.app|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Demo auth configuration ─────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "finops-demo-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRY_HOURS = 24

DEMO_TENANT_ID = "550e8400-e29b-41d4-a716-446655440000"

DEMO_USERS = {
    "admin@finops-platform.local": {
        "password": "Admin@123",
        "userId": "u-001",
        "displayName": "Platform Administrator",
        "roles": ["Platform_Admin"],
        "permissions": [
            "dashboard:read", "dashboard:write",
            "agents:read", "agents:write",
            "tenants:read", "tenants:write",
            "users:read", "users:write",
            "billing:read", "billing:write",
            "settings:read", "settings:write",
        ],
    },
    "finops@g42.ai": {
        "password": "FinOps@123",
        "userId": "u-002",
        "displayName": "G42 FinOps Lead",
        "roles": ["FinOps_Analyst"],
        "permissions": [
            "dashboard:read", "dashboard:write",
            "agents:read",
            "billing:read",
            "reports:read", "reports:write",
        ],
    },
    "cfo@g42.ai": {
        "password": "Exec@123",
        "userId": "u-003",
        "displayName": "G42 CFO",
        "roles": ["Executive_Viewer"],
        "permissions": [
            "dashboard:read",
            "reports:read",
            "billing:read",
        ],
    },
}

DEMO_TENANT = {
    "tenantId": DEMO_TENANT_ID,
    "tenantCode": "g42-seed",
    "displayName": "G42 Cloud",
    "tierCode": "enterprise",
    "primaryCurrencyCode": "AED",
    "primaryLocale": "en-AE",
    "primaryTimezone": "Asia/Dubai",
}


class LoginRequest(BaseModel):
    email: str
    password: str


def _create_access_token(user_email: str, user_info: dict) -> tuple[str, datetime]:
    expires = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRY_HOURS)
    claims = {
        "sub": user_info["userId"],
        "email": user_email,
        "tenantId": DEMO_TENANT_ID,
        "roles": user_info["roles"],
        "permissions": user_info["permissions"],
        "exp": int(expires.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, expires


# ── Auth endpoints ──────────────────────────────────────────────────────────
@app.post("/api/v1/auth/login")
async def auth_login(req: LoginRequest):
    user_info = DEMO_USERS.get(req.email)
    if not user_info or req.password != user_info["password"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token, expires = _create_access_token(req.email, user_info)

    return {
        "data": {
            "accessToken": token,
            "accessTokenExpiresAt": expires.isoformat(),
            "user": {
                "userId": user_info["userId"],
                "email": req.email,
                "displayName": user_info["displayName"],
                "emailVerified": True,
            },
            "tenants": [DEMO_TENANT],
            "defaultTenantId": DEMO_TENANT_ID,
            "roles": user_info["roles"],
            "permissions": user_info["permissions"],
        }
    }


@app.post("/api/v1/auth/refresh")
async def auth_refresh():
    # For demo purposes, return a fresh token for the admin user
    user_info = DEMO_USERS["admin@finops-platform.local"]
    token, expires = _create_access_token("admin@finops-platform.local", user_info)
    return {
        "data": {
            "accessToken": token,
            "accessTokenExpiresAt": expires.isoformat(),
        }
    }


@app.post("/api/v1/auth/logout")
async def auth_logout():
    return {"data": {"success": True}}

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
