"""
A04 Reporting & Analytics Agent — Report Generation Engine
FSD Reference: A04 Flow 1 (Scheduled Report Generation), Steps 1–10
Seed Scope: 6 report types, PDF/CSV output, LLM narrative summaries
"""

import io
import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional

from jinja2 import Template

logger = logging.getLogger("agent.a04.report_engine")


class ReportType(str, Enum):
    COST_SUMMARY = "Cost_Summary"
    BUDGET_VARIANCE = "Budget_Variance"
    OPTIMIZATION_SUMMARY = "Optimization_Summary"
    EXECUTIVE_BRIEFING = "Executive_Briefing"
    CHARGEBACK = "Chargeback"
    GOVERNANCE_SCORECARD = "Governance_Scorecard"


class OutputFormat(str, Enum):
    PDF = "PDF"
    CSV = "CSV"
    XLSX = "XLSX"
    DASHBOARD = "Dashboard"


class ReportGenerationEngine:
    """
    Orchestrates the 4-step report rendering pipeline (FSD A04 Step 5):
      Step 1 — Data Aggregation: queries agent data feeds
      Step 2 — Visualization Generation: charts, tables, KPI cards
      Step 3 — Narrative Generation: LLM-powered executive summaries
      Step 4 — Layout Composition: assemble final report
    """

    def __init__(self, db_session, redis_client, llm_client, event_publisher):
        self.db = db_session
        self.redis = redis_client
        self.llm = llm_client
        self.publisher = event_publisher

    async def generate_report(
        self,
        report_definition: dict,
        tenant_id: str,
        time_range: str = "Last_30d",
        filters: Optional[dict] = None,
        output_formats: list[str] = None,
    ) -> dict:
        """
        Execute the full report generation pipeline.
        FSD Steps 1-10.
        """
        generation_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)
        report_type = ReportType(report_definition["report_type"])
        output_formats = output_formats or ["PDF", "Dashboard"]

        logger.info(
            "Starting report generation",
            extra={
                "generation_id": generation_id,
                "report_type": report_type,
                "tenant_id": tenant_id,
            },
        )

        try:
            # Step 1 — Data Aggregation
            report_data = await self._aggregate_data(
                tenant_id, report_type, time_range, filters
            )

            # Step 2 — Visualization Preparation
            visualizations = self._prepare_visualizations(report_type, report_data)

            # Step 3 — LLM Narrative Generation
            narrative = await self._generate_narrative(
                report_type, report_data, tenant_id
            )

            # Step 4 — Layout Composition & Output
            outputs = {}
            for fmt in output_formats:
                if fmt == "PDF":
                    outputs["pdf"] = await self._render_pdf(
                        report_definition, report_data, visualizations, narrative
                    )
                elif fmt == "CSV":
                    outputs["csv"] = self._render_csv(report_data)
                elif fmt == "XLSX":
                    outputs["xlsx"] = self._render_xlsx(report_data)
                elif fmt == "Dashboard":
                    outputs["dashboard"] = {
                        "kpi_cards": report_data.get("kpi_cards", []),
                        "charts": visualizations,
                        "tables": report_data.get("tables", []),
                        "narrative": narrative,
                    }

            duration = (datetime.now(timezone.utc) - start_time).total_seconds()

            # Step 8 — Log generation event
            result = {
                "generation_id": generation_id,
                "report_id": report_definition["report_id"],
                "tenant_id": tenant_id,
                "status": "Completed",
                "records_queried": report_data.get("total_records", 0),
                "sections_rendered": len(visualizations),
                "duration_seconds": int(duration),
                "output_formats": output_formats,
                "narrative_length": len(narrative) if narrative else 0,
            }

            # Step 9 — Publish completion event
            await self.publisher.publish(
                "finops.reporting.generation-completed.v1",
                {
                    "event_id": str(uuid.uuid4()),
                    "event_type": "reporting.generation.completed",
                    "event_timestamp": datetime.now(timezone.utc).isoformat(),
                    "tenant_id": tenant_id,
                    "generation_id": generation_id,
                    "report_id": report_definition["report_id"],
                    "status": "Completed",
                },
            )

            return {**result, "outputs": outputs}

        except Exception as e:
            logger.error(f"Report generation failed: {e}", exc_info=True)
            return {
                "generation_id": generation_id,
                "status": "Failed",
                "error_type": type(e).__name__,
                "error_detail": str(e),
            }

    # -----------------------------------------------------------------------
    # STEP 1: Data Aggregation
    # -----------------------------------------------------------------------

    async def _aggregate_data(
        self, tenant_id: str, report_type: ReportType, time_range: str, filters: dict
    ) -> dict:
        """
        FSD Step 1 + Step 4: Query aggregated cost data store.
        Sources: A03 (allocated costs), A05 (anomaly summaries).
        """
        # Resolve time range to date bounds
        date_from, date_to = self._resolve_time_range(time_range)

        if report_type == ReportType.COST_SUMMARY:
            return await self._aggregate_cost_summary(tenant_id, date_from, date_to, filters)
        elif report_type == ReportType.EXECUTIVE_BRIEFING:
            return await self._aggregate_executive_briefing(tenant_id, date_from, date_to)
        elif report_type == ReportType.CHARGEBACK:
            return await self._aggregate_chargeback(tenant_id, date_from, date_to, filters)
        elif report_type == ReportType.BUDGET_VARIANCE:
            return await self._aggregate_budget_variance(tenant_id, date_from, date_to)
        elif report_type == ReportType.OPTIMIZATION_SUMMARY:
            return await self._aggregate_optimization(tenant_id, date_from, date_to)
        elif report_type == ReportType.GOVERNANCE_SCORECARD:
            return await self._aggregate_governance(tenant_id, date_from, date_to)
        else:
            return {"total_records": 0, "kpi_cards": [], "tables": []}

    async def _aggregate_cost_summary(
        self, tenant_id: str, date_from, date_to, filters
    ) -> dict:
        """Aggregate total spend by provider, service, BU, application."""
        # Query normalized_cost_record and allocated_cost_record
        # Real implementation uses SQLAlchemy with tenant RLS
        return {
            "total_records": 0,
            "kpi_cards": [
                {"label": "Total Spend (SAR)", "value": 0, "change_pct": 0, "trend": "stable"},
                {"label": "MoM Change", "value": "0%", "direction": "neutral"},
                {"label": "Active Providers", "value": 1},
                {"label": "Services Used", "value": 0},
                {"label": "Data Freshness", "value": "< 12h"},
            ],
            "spend_by_provider": [],
            "spend_by_service_category": [],
            "spend_by_bu": [],
            "spend_trend_daily": [],
            "top_cost_drivers": [],
            "tables": [],
        }

    async def _aggregate_executive_briefing(self, tenant_id, date_from, date_to) -> dict:
        """Executive-level KPIs across all domains."""
        return {
            "total_records": 0,
            "kpi_cards": [
                {"label": "Total Cloud Spend (SAR)", "value": 0},
                {"label": "MoM Change", "value": "0%"},
                {"label": "Budget Utilization", "value": "0%"},
                {"label": "Optimization Savings (SAR)", "value": 0},
                {"label": "Anomalies Detected", "value": 0},
                {"label": "Allocation Coverage", "value": "0%"},
            ],
            "spend_trend_12m": [],
            "spend_by_provider": [],
            "anomaly_summary": [],
            "top_recommendations": [],
        }

    async def _aggregate_chargeback(self, tenant_id, date_from, date_to, filters) -> dict:
        """Chargeback data grouped by owner dimension."""
        return {
            "total_records": 0,
            "kpi_cards": [
                {"label": "Total Chargeback (SAR)", "value": 0},
                {"label": "Coverage Rate", "value": "0%"},
                {"label": "BUs Charged", "value": 0},
                {"label": "Unattributed (SAR)", "value": 0},
            ],
            "chargeback_by_bu": [],
            "chargeback_by_category": [],
            "tables": [],
        }

    async def _aggregate_budget_variance(self, tenant_id, date_from, date_to) -> dict:
        return {"total_records": 0, "kpi_cards": [], "budget_vs_actual": [], "tables": []}

    async def _aggregate_optimization(self, tenant_id, date_from, date_to) -> dict:
        return {"total_records": 0, "kpi_cards": [], "recommendations": [], "tables": []}

    async def _aggregate_governance(self, tenant_id, date_from, date_to) -> dict:
        return {"total_records": 0, "kpi_cards": [], "scores": [], "tables": []}

    # -----------------------------------------------------------------------
    # STEP 2: Visualization Preparation
    # -----------------------------------------------------------------------

    def _prepare_visualizations(self, report_type: ReportType, data: dict) -> list[dict]:
        """
        FSD Step 2: Prepare chart specifications for rendering.
        Returns chart configs consumable by frontend (Recharts) or PDF renderer.
        """
        charts = []

        if report_type in (ReportType.COST_SUMMARY, ReportType.EXECUTIVE_BRIEFING):
            charts.extend([
                {
                    "id": "spend_trend",
                    "type": "line",
                    "title": "Cloud Spend Trend",
                    "data": data.get("spend_trend_daily", data.get("spend_trend_12m", [])),
                    "x_key": "date",
                    "y_key": "total_sar",
                    "color": "#3B82F6",
                },
                {
                    "id": "spend_by_provider",
                    "type": "donut",
                    "title": "Spend by Provider",
                    "data": data.get("spend_by_provider", []),
                    "name_key": "provider",
                    "value_key": "total_sar",
                },
                {
                    "id": "spend_by_bu",
                    "type": "bar",
                    "title": "Spend by Business Unit",
                    "data": data.get("spend_by_bu", []),
                    "x_key": "bu_name",
                    "y_key": "total_sar",
                    "color": "#10B981",
                },
                {
                    "id": "top_cost_drivers",
                    "type": "horizontal_bar",
                    "title": "Top 10 Cost Drivers",
                    "data": data.get("top_cost_drivers", [])[:10],
                    "x_key": "cost_sar",
                    "y_key": "service_name",
                },
            ])

        if report_type == ReportType.CHARGEBACK:
            charts.extend([
                {
                    "id": "chargeback_by_bu",
                    "type": "stacked_bar",
                    "title": "Monthly Chargeback by Business Unit",
                    "data": data.get("chargeback_by_bu", []),
                    "x_key": "bu_name",
                    "stack_keys": ["direct_sar", "shared_sar", "idle_tax_sar"],
                },
                {
                    "id": "chargeback_by_category",
                    "type": "treemap",
                    "title": "Chargeback by Cost Category",
                    "data": data.get("chargeback_by_category", []),
                },
            ])

        return charts

    # -----------------------------------------------------------------------
    # STEP 3: LLM Narrative Generation
    # -----------------------------------------------------------------------

    async def _generate_narrative(
        self, report_type: ReportType, data: dict, tenant_id: str
    ) -> str:
        """
        FSD Step 3: Generate natural language executive summary using LLM.
        Invokes Anthropic Claude API for contextual narrative generation.
        """
        kpis = data.get("kpi_cards", [])
        kpi_summary = "\n".join(
            [f"- {k['label']}: {k['value']}" for k in kpis]
        )

        prompt = self._build_narrative_prompt(report_type, kpi_summary, data)

        try:
            response = await self.llm.create_message(
                model="claude-sonnet-4-20250514",
                max_tokens=1000,
                system=(
                    "You are a FinOps analyst generating executive summaries for cloud "
                    "cost reports. Write concise, actionable narratives. Use SAR currency. "
                    "Highlight trends, anomalies, and recommendations. Keep under 300 words."
                ),
                messages=[{"role": "user", "content": prompt}],
            )
            narrative = response.content[0].text
            logger.info(f"LLM narrative generated: {len(narrative)} chars")
            return narrative

        except Exception as e:
            logger.warning(f"LLM narrative generation failed: {e}")
            # Fallback: template-based summary
            return self._generate_fallback_narrative(report_type, kpis)

    def _build_narrative_prompt(
        self, report_type: ReportType, kpi_summary: str, data: dict
    ) -> str:
        """Build the LLM prompt based on report type and data."""
        prompts = {
            ReportType.COST_SUMMARY: (
                f"Generate an executive summary for a Cloud Cost Summary Report.\n\n"
                f"Key Metrics:\n{kpi_summary}\n\n"
                f"Top cost drivers: {json.dumps(data.get('top_cost_drivers', [])[:5])}\n"
                f"Spend by provider: {json.dumps(data.get('spend_by_provider', []))}\n\n"
                f"Provide: 1) Overall spending trend, 2) Key changes from last period, "
                f"3) Top areas for attention, 4) Recommended actions."
            ),
            ReportType.EXECUTIVE_BRIEFING: (
                f"Generate a C-level executive briefing on cloud infrastructure costs.\n\n"
                f"Key Metrics:\n{kpi_summary}\n\n"
                f"Anomaly count: {data.get('anomaly_summary', [])}\n"
                f"Top recommendations: {json.dumps(data.get('top_recommendations', [])[:3])}\n\n"
                f"Write for a CFO/CTO audience. Focus on: financial impact, risk areas, "
                f"and strategic recommendations. Be direct and quantitative."
            ),
            ReportType.CHARGEBACK: (
                f"Generate a chargeback report summary.\n\n"
                f"Key Metrics:\n{kpi_summary}\n\n"
                f"Chargeback by BU: {json.dumps(data.get('chargeback_by_bu', [])[:5])}\n\n"
                f"Highlight: allocation coverage, unattributed costs, month-over-month "
                f"changes per BU, and any allocation rule adjustments needed."
            ),
        }
        return prompts.get(
            report_type,
            f"Generate a summary for a {report_type.value} report.\n\nMetrics:\n{kpi_summary}",
        )

    def _generate_fallback_narrative(
        self, report_type: ReportType, kpis: list[dict]
    ) -> str:
        """Template-based fallback when LLM is unavailable."""
        kpi_lines = "; ".join([f"{k['label']}: {k['value']}" for k in kpis[:4]])
        return (
            f"This {report_type.value.replace('_', ' ')} report covers the selected "
            f"period. Key metrics: {kpi_lines}. Please review the detailed charts and "
            f"tables below for a complete breakdown. Contact your FinOps team for "
            f"questions or action items."
        )

    # -----------------------------------------------------------------------
    # STEP 4: Output Rendering
    # -----------------------------------------------------------------------

    async def _render_pdf(
        self, definition: dict, data: dict, charts: list, narrative: str
    ) -> dict:
        """
        FSD Step 6: Generate PDF report.
        Uses WeasyPrint or similar for HTML→PDF conversion.
        """
        # In production: render HTML template → WeasyPrint → PDF bytes
        # Seed: return metadata for PDF generation service
        return {
            "format": "PDF",
            "file_name": f"{definition['report_name']}_{datetime.now().strftime('%Y%m%d')}.pdf",
            "sections": len(charts) + 2,  # charts + narrative + summary
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def _render_csv(self, data: dict) -> dict:
        """FSD Step 6: Generate CSV data export."""
        return {
            "format": "CSV",
            "rows": data.get("total_records", 0),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def _render_xlsx(self, data: dict) -> dict:
        """FSD Step 6: Generate XLSX data export."""
        return {
            "format": "XLSX",
            "sheets": ["Summary", "Detail", "Charts"],
            "rows": data.get("total_records", 0),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    def _resolve_time_range(self, time_range: str):
        """Convert time range enum to date bounds."""
        from datetime import timedelta
        today = datetime.now(timezone.utc).date()
        ranges = {
            "Last_7d": (today - timedelta(days=7), today),
            "Last_30d": (today - timedelta(days=30), today),
            "Last_90d": (today - timedelta(days=90), today),
            "MTD": (today.replace(day=1), today),
            "QTD": (today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1), today),
            "YTD": (today.replace(month=1, day=1), today),
        }
        return ranges.get(time_range, (today - timedelta(days=30), today))
