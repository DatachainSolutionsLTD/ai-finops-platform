"""
A05 Anomaly Detection Agent — Alert Routing & Lifecycle Management
FSD Reference: A05 Flow 3 (Alert Generation), Flow 4 (Lifecycle Tracking)

Alert Routing (FSD Steps 14–19):
  - Severity-based routing (Critical → all, Info → analysts only)
  - Root cause routing (misconfig → Engineering, billing → Finance)
  - BU ownership routing
  - Escalation timers (2h Critical, 24h Warning, 72h Info)

Lifecycle States (FSD):
  Detected → Acknowledged → Investigating → Resolved_Confirmed
                                           → Resolved_False_Positive
                                           → Resolved_Expected
  Detected → Auto_Suppressed (via suppression rules)
"""

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional

logger = logging.getLogger("agent.a05.alerting")


class AlertChannel(str, Enum):
    EMAIL = "Email"
    IN_APP = "In_App"
    WEBHOOK = "Webhook"
    SMS = "SMS"
    API = "API"


class LifecycleStatus(str, Enum):
    DETECTED = "Detected"
    ACKNOWLEDGED = "Acknowledged"
    INVESTIGATING = "Investigating"
    RESOLVED_CONFIRMED = "Resolved_Confirmed"
    RESOLVED_FALSE_POSITIVE = "Resolved_False_Positive"
    RESOLVED_EXPECTED = "Resolved_Expected"
    AUTO_SUPPRESSED = "Auto_Suppressed"


# Valid lifecycle transitions (FSD Flow 4)
VALID_TRANSITIONS = {
    LifecycleStatus.DETECTED: {LifecycleStatus.ACKNOWLEDGED, LifecycleStatus.INVESTIGATING,
                                LifecycleStatus.RESOLVED_FALSE_POSITIVE, LifecycleStatus.RESOLVED_EXPECTED,
                                LifecycleStatus.AUTO_SUPPRESSED},
    LifecycleStatus.ACKNOWLEDGED: {LifecycleStatus.INVESTIGATING, LifecycleStatus.RESOLVED_CONFIRMED,
                                    LifecycleStatus.RESOLVED_FALSE_POSITIVE, LifecycleStatus.RESOLVED_EXPECTED},
    LifecycleStatus.INVESTIGATING: {LifecycleStatus.RESOLVED_CONFIRMED, LifecycleStatus.RESOLVED_FALSE_POSITIVE,
                                     LifecycleStatus.RESOLVED_EXPECTED},
    # Terminal states — no further transitions
    LifecycleStatus.RESOLVED_CONFIRMED: set(),
    LifecycleStatus.RESOLVED_FALSE_POSITIVE: set(),
    LifecycleStatus.RESOLVED_EXPECTED: set(),
    LifecycleStatus.AUTO_SUPPRESSED: set(),
}

# Escalation SLAs by severity (FSD Step 19)
ESCALATION_SLAS = {
    "Critical": timedelta(hours=2),
    "Warning": timedelta(hours=24),
    "Informational": timedelta(hours=72),
}


@dataclass
class AlertRecipient:
    user_id: str
    email: str
    name: str
    role: str  # FinOps_Analyst, Engineering, Finance, Executive
    channels: list[AlertChannel]


class AlertRouter:
    """
    Determines alert recipients and channels based on anomaly attributes.
    FSD Flow 3, Steps 14–19.
    """

    def __init__(self, db_session, notification_service, llm_client, event_publisher):
        self.db = db_session
        self.notifier = notification_service
        self.llm = llm_client
        self.publisher = event_publisher

    async def route_and_send_alert(self, anomaly: dict, tenant_id: str) -> dict:
        """
        Full alert pipeline:
        1. Generate LLM narrative (FSD Step 15)
        2. Determine recipients (FSD Step 16)
        3. Send via channels (FSD Step 17)
        4. Log delivery (FSD Step 18)
        5. Start escalation timer (FSD Step 19)
        """
        alert_id = str(uuid.uuid4())
        severity = anomaly.get("severity", "Informational")

        # Step 15: Generate NL alert narrative via LLM
        narrative = await self._generate_alert_narrative(anomaly)

        # Step 16: Determine routing
        recipients = await self._determine_recipients(anomaly, tenant_id)

        # Step 17: Send via configured channels
        delivery_results = []
        for recipient in recipients:
            for channel in recipient.channels:
                result = await self._send_alert(
                    alert_id=alert_id,
                    anomaly=anomaly,
                    recipient=recipient,
                    channel=channel,
                    narrative=narrative,
                )
                delivery_results.append(result)

        # Step 18: Log alert distribution
        alert_log = {
            "alert_id": alert_id,
            "anomaly_id": anomaly["anomaly_id"],
            "tenant_id": tenant_id,
            "severity": severity,
            "recipients_count": len(recipients),
            "channels_used": list({r["channel"] for r in delivery_results}),
            "delivery_results": delivery_results,
            "narrative_length": len(narrative) if narrative else 0,
            "alert_timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Step 19: Start escalation timer
        escalation_sla = ESCALATION_SLAS.get(severity, timedelta(hours=72))
        alert_log["escalation_deadline"] = (datetime.now(timezone.utc) + escalation_sla).isoformat()

        # Publish alert event
        await self.publisher.publish(
            "finops.anomaly.detected.v1",
            {
                "event_id": str(uuid.uuid4()),
                "event_type": "anomaly.detected",
                "event_timestamp": datetime.now(timezone.utc).isoformat(),
                "tenant_id": tenant_id,
                "anomaly_id": anomaly["anomaly_id"],
                "severity": severity,
                "severity_score": anomaly.get("severity_score", 0),
                "root_cause_category": anomaly.get("root_cause_category", "Unclassified"),
                "baseline_value_sar": anomaly.get("baseline_value", 0),
                "actual_value_sar": anomaly.get("actual_value", 0),
                "deviation_pct": anomaly.get("deviation_pct", 0),
                "deviation_direction": anomaly.get("deviation_direction", "Spike"),
                "financial_impact_30d_sar": anomaly.get("financial_impact_30d", 0),
            },
        )

        logger.info(
            "Alert routed",
            extra={
                "alert_id": alert_id,
                "anomaly_id": anomaly["anomaly_id"],
                "severity": severity,
                "recipients": len(recipients),
            },
        )

        return alert_log

    async def _generate_alert_narrative(self, anomaly: dict) -> str:
        """
        FSD Step 15: LLM-generated alert narrative with 4 sections:
        What happened, Why it matters, Likely cause, Recommended action.
        """
        prompt = (
            f"Generate a concise alert narrative for this cost anomaly:\n\n"
            f"Provider: {anomaly.get('provider', 'Unknown')}\n"
            f"Service: {anomaly.get('service_name', 'Unknown')}\n"
            f"Severity: {anomaly.get('severity', 'Unknown')}\n"
            f"Baseline (SAR): {anomaly.get('baseline_value', 0):,.2f}\n"
            f"Actual (SAR): {anomaly.get('actual_value', 0):,.2f}\n"
            f"Deviation: {anomaly.get('deviation_pct', 0):.1f}%\n"
            f"Direction: {anomaly.get('deviation_direction', 'Spike')}\n"
            f"7-day Impact (SAR): {anomaly.get('financial_impact_7d', 0):,.2f}\n"
            f"30-day Impact (SAR): {anomaly.get('financial_impact_30d', 0):,.2f}\n"
            f"Root Cause: {anomaly.get('root_cause_category', 'Unclassified')}\n\n"
            f"Format as 4 sections: What happened, Why it matters, Likely cause, "
            f"Recommended action. Keep under 200 words total. Use SAR currency."
        )

        try:
            response = await self.llm.create_message(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                system="You are a FinOps alert system generating concise, actionable anomaly alerts.",
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text
        except Exception as e:
            logger.warning(f"LLM narrative generation failed: {e}")
            return self._fallback_narrative(anomaly)

    def _fallback_narrative(self, anomaly: dict) -> str:
        """Template-based fallback narrative."""
        return (
            f"ANOMALY DETECTED: {anomaly.get('provider', '')} {anomaly.get('service_name', '')} "
            f"costs deviated {anomaly.get('deviation_pct', 0):.0f}% from baseline. "
            f"Actual: SAR {anomaly.get('actual_value', 0):,.0f} vs baseline SAR {anomaly.get('baseline_value', 0):,.0f}. "
            f"30-day projected impact: SAR {anomaly.get('financial_impact_30d', 0):,.0f}. "
            f"Root cause: {anomaly.get('root_cause_category', 'Under investigation')}. "
            f"Please review and take action."
        )

    async def _determine_recipients(
        self, anomaly: dict, tenant_id: str
    ) -> list[AlertRecipient]:
        """
        FSD Step 16: Route based on severity, root cause, and BU ownership.
        """
        recipients = []
        severity = anomaly.get("severity", "Informational")
        root_cause = anomaly.get("root_cause_category", "Unclassified")

        # Load tenant notification config
        # Real impl: query notification_config from tenant settings
        all_stakeholders = await self._load_stakeholders(tenant_id)

        for person in all_stakeholders:
            should_notify = False

            # Critical: all configured recipients
            if severity == "Critical":
                should_notify = True

            # Warning: FinOps analysts + Engineering (if misconfig)
            elif severity == "Warning":
                if person.role in ("FinOps_Analyst", "Tenant_Admin"):
                    should_notify = True
                if root_cause == "Resource_Misconfiguration" and person.role == "Engineering":
                    should_notify = True
                if root_cause == "Billing_Error" and person.role == "Finance":
                    should_notify = True

            # Informational: FinOps analysts only
            elif severity == "Informational":
                if person.role == "FinOps_Analyst":
                    should_notify = True

            if should_notify:
                recipients.append(person)

        return recipients

    async def _send_alert(
        self,
        alert_id: str,
        anomaly: dict,
        recipient: AlertRecipient,
        channel: AlertChannel,
        narrative: str,
    ) -> dict:
        """FSD Step 17: Dispatch alert to specific channel."""
        try:
            if channel == AlertChannel.EMAIL:
                await self.notifier.send_email(
                    to=recipient.email,
                    subject=f"[{anomaly['severity']}] Cost Anomaly — {anomaly.get('service_name', 'Unknown')}",
                    html_body=self._render_email_template(anomaly, narrative),
                )
            elif channel == AlertChannel.IN_APP:
                await self.notifier.push_notification(
                    user_id=recipient.user_id,
                    title=f"Cost Anomaly: {anomaly.get('service_name', '')}",
                    body=narrative[:200],
                    link=f"/anomalies/{anomaly['anomaly_id']}",
                    severity=anomaly["severity"],
                )
            elif channel == AlertChannel.WEBHOOK:
                await self.notifier.send_webhook(
                    url=recipient.channels.get("webhook_url", ""),
                    payload={
                        "alert_id": alert_id,
                        "anomaly_id": anomaly["anomaly_id"],
                        "severity": anomaly["severity"],
                        "narrative": narrative,
                        "action_url": f"/anomalies/{anomaly['anomaly_id']}",
                    },
                )

            return {
                "alert_id": alert_id,
                "recipient_id": recipient.user_id,
                "channel": channel,
                "delivery_status": "Sent",
            }
        except Exception as e:
            logger.error(f"Alert delivery failed: {channel} → {recipient.email}: {e}")
            return {
                "alert_id": alert_id,
                "recipient_id": recipient.user_id,
                "channel": channel,
                "delivery_status": "Failed",
                "error": str(e),
            }

    def _render_email_template(self, anomaly: dict, narrative: str) -> str:
        """Render HTML email for anomaly alert."""
        severity_colors = {"Critical": "#EF4444", "Warning": "#F59E0B", "Informational": "#3B82F6"}
        color = severity_colors.get(anomaly["severity"], "#6B7280")

        return f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: {color}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">{anomaly['severity']} — Cost Anomaly Detected</h2>
                <p style="margin: 4px 0 0;">{anomaly.get('provider', '')} / {anomaly.get('service_name', '')}</p>
            </div>
            <div style="padding: 20px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
                <table style="width: 100%; margin-bottom: 16px;">
                    <tr><td style="padding: 4px 0; color: #6B7280;">Deviation:</td>
                        <td style="font-weight: bold;">{anomaly.get('deviation_pct', 0):.1f}% {anomaly.get('deviation_direction', '')}</td></tr>
                    <tr><td style="padding: 4px 0; color: #6B7280;">Baseline (SAR):</td>
                        <td>{anomaly.get('baseline_value', 0):,.2f}</td></tr>
                    <tr><td style="padding: 4px 0; color: #6B7280;">Actual (SAR):</td>
                        <td style="font-weight: bold;">{anomaly.get('actual_value', 0):,.2f}</td></tr>
                    <tr><td style="padding: 4px 0; color: #6B7280;">30-Day Impact (SAR):</td>
                        <td style="color: #EF4444; font-weight: bold;">{anomaly.get('financial_impact_30d', 0):,.2f}</td></tr>
                </table>
                <div style="background: #F9FAFB; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                    <p style="white-space: pre-line; font-size: 14px; line-height: 1.5;">{narrative}</p>
                </div>
                <a href="/anomalies/{anomaly['anomaly_id']}" style="display: inline-block; background: {color};
                   color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                    View Anomaly Details
                </a>
            </div>
        </div>
        """

    async def _load_stakeholders(self, tenant_id: str) -> list[AlertRecipient]:
        """Load notification recipients for tenant."""
        # Real implementation: query tenant notification preferences
        return []


class LifecycleManager:
    """
    Manages anomaly lifecycle state transitions.
    FSD Flow 4: Anomaly Resolution Lifecycle Tracking.
    """

    def __init__(self, db_session, event_publisher):
        self.db = db_session
        self.publisher = event_publisher

    async def transition(
        self,
        anomaly_id: str,
        tenant_id: str,
        new_status: LifecycleStatus,
        transitioned_by: Optional[str] = None,
        notes: Optional[str] = None,
        remediation_action: Optional[str] = None,
        financial_impact_confirmed: Optional[float] = None,
        root_cause_validated: Optional[str] = None,
    ) -> dict:
        """
        Execute a lifecycle state transition with validation.
        Records immutable transition log entry.
        """
        # Get current anomaly state
        current_anomaly = await self._get_anomaly(anomaly_id, tenant_id)
        if not current_anomaly:
            raise ValueError(f"Anomaly {anomaly_id} not found")

        current_status = LifecycleStatus(current_anomaly["lifecycle_status"])

        # Validate transition
        if new_status not in VALID_TRANSITIONS.get(current_status, set()):
            raise ValueError(
                f"Invalid transition: {current_status} → {new_status}. "
                f"Allowed: {VALID_TRANSITIONS[current_status]}"
            )

        now = datetime.now(timezone.utc)
        transition_id = str(uuid.uuid4())

        # Write lifecycle transition log (immutable)
        transition_record = {
            "transition_id": transition_id,
            "anomaly_id": anomaly_id,
            "tenant_id": tenant_id,
            "previous_status": current_status,
            "new_status": new_status,
            "transitioned_by": transitioned_by,
            "transition_timestamp": now.isoformat(),
            "notes": notes,
            "remediation_action": remediation_action,
            "financial_impact_confirmed_sar": financial_impact_confirmed,
            "root_cause_validated": root_cause_validated,
        }

        # Update anomaly record
        update_fields = {"lifecycle_status": new_status}
        if new_status in (
            LifecycleStatus.RESOLVED_CONFIRMED,
            LifecycleStatus.RESOLVED_FALSE_POSITIVE,
            LifecycleStatus.RESOLVED_EXPECTED,
        ):
            update_fields["resolved_by"] = transitioned_by
            update_fields["resolved_timestamp"] = now.isoformat()
            update_fields["resolution_notes"] = notes
            if new_status == LifecycleStatus.RESOLVED_CONFIRMED:
                update_fields["resolution_type"] = "Confirmed"
            elif new_status == LifecycleStatus.RESOLVED_FALSE_POSITIVE:
                update_fields["resolution_type"] = "False_Positive"
            else:
                update_fields["resolution_type"] = "Expected_Change"

        await self._update_anomaly(anomaly_id, tenant_id, update_fields)
        await self._write_transition_log(transition_record)

        # Publish lifecycle event if resolved
        if "resolved" in new_status.value.lower():
            await self.publisher.publish(
                "finops.anomaly.resolved.v1",
                {
                    "event_id": str(uuid.uuid4()),
                    "event_type": "anomaly.resolved",
                    "event_timestamp": now.isoformat(),
                    "tenant_id": tenant_id,
                    "anomaly_id": anomaly_id,
                    "resolution_type": update_fields.get("resolution_type", ""),
                    "financial_impact_confirmed_sar": financial_impact_confirmed,
                    "resolved_by": transitioned_by,
                },
            )

            # Publish to downstream agents (FSD Steps 34-38)
            if new_status == LifecycleStatus.RESOLVED_CONFIRMED:
                await self._notify_downstream_agents(
                    anomaly_id, tenant_id, current_anomaly, financial_impact_confirmed
                )

        logger.info(
            "Lifecycle transition",
            extra={
                "anomaly_id": anomaly_id,
                "transition": f"{current_status} → {new_status}",
                "by": transitioned_by or "system",
            },
        )

        return transition_record

    async def check_escalations(self, tenant_id: str):
        """
        FSD Step 19: Check for anomalies exceeding escalation SLAs.
        Auto-escalate to next notification tier.
        """
        for severity, sla in ESCALATION_SLAS.items():
            deadline = datetime.now(timezone.utc) - sla
            overdue = await self._get_unacknowledged_anomalies(
                tenant_id, severity, deadline
            )
            for anomaly in overdue:
                current_tier = anomaly.get("escalation_tier", 1)
                if current_tier < 3:
                    await self._escalate(anomaly, current_tier + 1)

    async def _notify_downstream_agents(
        self, anomaly_id, tenant_id, anomaly, confirmed_impact
    ):
        """FSD Steps 34-38: Notify A04, A06, A07 of confirmed anomaly."""
        # A04: Update dashboards with confirmed anomaly
        await self.publisher.publish(
            "finops.anomaly.resolved.v1",
            {
                "event_type": "anomaly.resolved",
                "tenant_id": tenant_id,
                "anomaly_id": anomaly_id,
                "resolution_type": "Confirmed",
                "financial_impact_confirmed_sar": confirmed_impact,
            },
        )

    # DB access placeholders
    async def _get_anomaly(self, anomaly_id, tenant_id) -> Optional[dict]:
        return None

    async def _update_anomaly(self, anomaly_id, tenant_id, fields):
        pass

    async def _write_transition_log(self, record):
        pass

    async def _get_unacknowledged_anomalies(self, tenant_id, severity, deadline):
        return []

    async def _escalate(self, anomaly, new_tier):
        pass
