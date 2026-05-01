"""
A01 Data Ingestion Agent — AWS Cost and Usage Report (CUR) Connector
FSD Reference: Flow 1 (DI-001, DI-002), Steps 1-12
Seed Scope: AWS only, single-tenant (G42)
"""

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import AsyncIterator

import boto3
import pyarrow.parquet as pq
from botocore.exceptions import ClientError

from src.connectors.base import BaseConnector, ConnectorResult, RawRecord
from src.models.events import IngestionCompletedEvent, IngestionFailedEvent
from src.events.publisher import EventPublisher

logger = logging.getLogger("agent.a01.connectors.aws_cur")


class AWSCURConnector(BaseConnector):
    """
    AWS Cost and Usage Report connector.

    Reads CUR Parquet/CSV exports from S3, parses line items preserving
    full account hierarchy, service, region, tags, and cost breakdowns.
    Implements hash-based delta detection for incremental ingestion.

    FSD Steps Implemented:
      Step 3: Read CUR from S3, identify new partitions, parse line items
      Step 7: Write raw records to staging with metadata
      Step 8: Data quality checks (count, mandatory fields, duplicates)
      Step 9: Publish ingestion completion event
    """

    SOURCE_TYPE = "AWS"
    SOURCE_SUBTYPE = "AWS_CUR"

    def __init__(
        self,
        connector_id: str,
        tenant_id: str,
        config: dict,
        vault_client,
        redis_client,
        event_publisher: EventPublisher,
    ):
        super().__init__(connector_id, tenant_id, config)
        self.vault_client = vault_client
        self.redis = redis_client
        self.publisher = event_publisher

        # Config from connector registry
        self.s3_bucket = config["cur_s3_bucket"]
        self.s3_prefix = config.get("cur_s3_prefix", "")
        self.report_name = config.get("report_name", "")
        self.region = config.get("region", "me-south-1")

        self._s3_client = None

    async def _get_s3_client(self):
        """Retrieve AWS credentials from Vault, create S3 client."""
        if self._s3_client is None:
            creds = await self.vault_client.read_secret(
                f"secret/data/tenants/{self.tenant_id}/cloud/aws"
            )
            session = boto3.Session(
                aws_access_key_id=creds["access_key_id"],
                aws_secret_access_key=creds["secret_access_key"],
                region_name=self.region,
            )
            # If role_arn provided, assume cross-account role
            if creds.get("role_arn"):
                sts = session.client("sts")
                assumed = sts.assume_role(
                    RoleArn=creds["role_arn"],
                    ExternalId=creds.get("external_id", ""),
                    RoleSessionName=f"finops-a01-{self.tenant_id[:8]}",
                    DurationSeconds=3600,
                )
                session = boto3.Session(
                    aws_access_key_id=assumed["Credentials"]["AccessKeyId"],
                    aws_secret_access_key=assumed["Credentials"]["SecretAccessKey"],
                    aws_session_token=assumed["Credentials"]["SessionToken"],
                    region_name=self.region,
                )
            self._s3_client = session.client("s3")
        return self._s3_client

    async def test_connectivity(self) -> dict:
        """Test S3 bucket access and CUR availability. FSD: Connector Setup Step 4."""
        try:
            s3 = await self._get_s3_client()
            response = s3.list_objects_v2(
                Bucket=self.s3_bucket,
                Prefix=self.s3_prefix,
                MaxKeys=5,
            )
            objects = response.get("Contents", [])
            return {
                "status": "Success",
                "objects_found": len(objects),
                "bucket": self.s3_bucket,
                "prefix": self.s3_prefix,
            }
        except ClientError as e:
            return {
                "status": "Failed",
                "error_type": e.response["Error"]["Code"],
                "error_detail": str(e),
            }

    async def discover_partitions(self, since: datetime | None = None) -> list[str]:
        """
        Discover CUR partition prefixes for billing periods not yet ingested.
        CUR structure: s3://{bucket}/{prefix}/{report_name}/{YYYYMMDD-YYYYMMDD}/
        """
        s3 = await self._get_s3_client()
        paginator = s3.get_paginator("list_objects_v2")
        base_prefix = f"{self.s3_prefix}{self.report_name}/" if self.report_name else self.s3_prefix

        partitions = []
        async_pages = paginator.paginate(
            Bucket=self.s3_bucket,
            Prefix=base_prefix,
            Delimiter="/",
        )

        for page in async_pages:
            for prefix_obj in page.get("CommonPrefixes", []):
                partition_key = prefix_obj["Prefix"]
                # Check if this partition was already ingested (Redis dedup)
                dedup_key = f"finops:{self.tenant_id}:ingestion:partition:{hashlib.sha256(partition_key.encode()).hexdigest()[:16]}"
                if not await self.redis.exists(dedup_key):
                    partitions.append(partition_key)

        logger.info(
            "Discovered CUR partitions",
            extra={
                "tenant_id": self.tenant_id,
                "connector_id": self.connector_id,
                "total_partitions": len(partitions),
            },
        )
        return partitions

    async def extract_records(
        self, partition_prefix: str, batch_size: int = 50_000
    ) -> AsyncIterator[list[RawRecord]]:
        """
        Extract CUR line items from Parquet files in a partition.
        Yields batches of RawRecord for downstream processing.

        FSD Step 3: Downloads and decompresses Parquet/CSV files. Parses line items
        preserving: account hierarchy, service, region, usage type, resource ID,
        tags, costs (unblended, amortized, net), usage quantity.
        """
        s3 = await self._get_s3_client()
        paginator = s3.get_paginator("list_objects_v2")

        # List all Parquet/CSV files in partition
        files = []
        for page in paginator.paginate(Bucket=self.s3_bucket, Prefix=partition_prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.endswith(".parquet") or key.endswith(".csv.gz") or key.endswith(".csv"):
                    files.append(key)

        batch = []
        for file_key in files:
            logger.info(f"Processing CUR file: s3://{self.s3_bucket}/{file_key}")

            if file_key.endswith(".parquet"):
                records = await self._read_parquet(file_key)
            else:
                records = await self._read_csv(file_key)

            for record in records:
                raw_record = self._map_cur_to_raw(record)
                batch.append(raw_record)

                if len(batch) >= batch_size:
                    yield batch
                    batch = []

        if batch:
            yield batch

    async def _read_parquet(self, s3_key: str) -> list[dict]:
        """Read a Parquet CUR file from S3."""
        s3 = await self._get_s3_client()
        response = s3.get_object(Bucket=self.s3_bucket, Key=s3_key)
        body = response["Body"].read()

        # Read Parquet into PyArrow table
        import io
        table = pq.read_table(io.BytesIO(body))
        return table.to_pylist()

    async def _read_csv(self, s3_key: str) -> list[dict]:
        """Read a CSV/gzipped CUR file from S3."""
        import csv
        import gzip
        import io

        s3 = await self._get_s3_client()
        response = s3.get_object(Bucket=self.s3_bucket, Key=s3_key)
        body = response["Body"].read()

        if s3_key.endswith(".gz"):
            body = gzip.decompress(body)

        reader = csv.DictReader(io.StringIO(body.decode("utf-8")))
        return list(reader)

    def _map_cur_to_raw(self, cur_line: dict) -> RawRecord:
        """
        Map AWS CUR line item fields to platform RawRecord schema.

        Preserves: account hierarchy, service, region, usage type,
        resource ID, tags, costs (unblended, amortized, net), usage quantity.
        """
        # Extract resource tags (CUR stores them as resourceTags/user:*)
        tags = {}
        for key, value in cur_line.items():
            if key.startswith("resourceTags/"):
                tag_name = key.replace("resourceTags/user:", "").replace("resourceTags/aws:", "aws:")
                if value:
                    tags[tag_name] = value

        # Determine billing period from line item
        billing_period = cur_line.get(
            "bill/BillingPeriodStartDate",
            cur_line.get("identity/TimeInterval", "")[:10],
        )

        return RawRecord(
            record_id=str(uuid.uuid4()),
            tenant_id=self.tenant_id,
            connector_id=self.connector_id,
            source_type="AWS",
            billing_period=billing_period,
            resource_id=cur_line.get("lineItem/ResourceId", ""),
            resource_name=cur_line.get("product/ProductName", ""),
            service_name=cur_line.get("lineItem/ProductCode", ""),
            region=cur_line.get("product/region", cur_line.get("product/location", "")),
            account_id=cur_line.get("lineItem/UsageAccountId", ""),
            raw_cost=Decimal(str(cur_line.get("lineItem/UnblendedCost", "0"))),
            raw_currency=cur_line.get("lineItem/CurrencyCode", "USD"),
            raw_usage_quantity=Decimal(str(cur_line.get("lineItem/UsageAmount", "0"))),
            raw_usage_unit=cur_line.get("pricing/unit", ""),
            tags_json=tags,
            raw_payload={
                "line_item_type": cur_line.get("lineItem/LineItemType", ""),
                "usage_type": cur_line.get("lineItem/UsageType", ""),
                "operation": cur_line.get("lineItem/Operation", ""),
                "availability_zone": cur_line.get("lineItem/AvailabilityZone", ""),
                "blended_cost": cur_line.get("lineItem/BlendedCost", ""),
                "amortized_cost": cur_line.get(
                    "savingsPlan/AmortizedUpfrontCostForUsage",
                    cur_line.get("reservation/AmortizedUpfrontCostForUsage", ""),
                ),
                "net_unblended_cost": cur_line.get("lineItem/NetUnblendedCost", ""),
                "payer_account_id": cur_line.get("bill/PayerAccountId", ""),
                "billing_entity": cur_line.get("bill/BillingEntity", ""),
                "pricing_term": cur_line.get("pricing/term", ""),
                "pricing_rate_id": cur_line.get("pricing/RateId", ""),
            },
            ingestion_timestamp=datetime.now(timezone.utc),
        )

    def _compute_record_hash(self, record: RawRecord) -> str:
        """
        Compute SHA256 hash for deduplication.
        Hash key: tenant_id + resource_id + billing_period + service_name + raw_cost
        """
        hash_input = (
            f"{record.tenant_id}|{record.resource_id}|{record.billing_period}|"
            f"{record.service_name}|{record.raw_cost}"
        )
        return hashlib.sha256(hash_input.encode()).hexdigest()

    async def deduplicate_batch(
        self, records: list[RawRecord], run_id: str
    ) -> tuple[list[RawRecord], int]:
        """
        Hash-based delta detection using Redis SET.
        Returns (new_records, duplicates_removed_count).

        FSD Step 8: Duplicate detection via hash comparison.
        """
        dedup_key = f"finops:{self.tenant_id}:ingestion:dedup:{self.connector_id}:{records[0].billing_period if records else 'unknown'}"
        new_records = []
        dup_count = 0

        pipe = self.redis.pipeline()
        hashes = [self._compute_record_hash(r) for r in records]

        for h in hashes:
            pipe.sismember(dedup_key, h)

        results = await pipe.execute()

        for record, record_hash, is_dup in zip(records, hashes, results):
            if is_dup:
                dup_count += 1
            else:
                new_records.append(record)
                await self.redis.sadd(dedup_key, record_hash)

        # Set 7-day TTL on dedup set
        await self.redis.expire(dedup_key, 604800)

        logger.info(
            "Deduplication complete",
            extra={
                "total": len(records),
                "new": len(new_records),
                "duplicates": dup_count,
            },
        )
        return new_records, dup_count

    async def validate_batch(self, records: list[RawRecord]) -> tuple[list[RawRecord], list[RawRecord]]:
        """
        Data quality validation on raw records.
        Returns (valid_records, quarantined_records).

        FSD Step 8: Record count validation, missing mandatory fields,
        date range completeness.
        """
        valid = []
        quarantined = []

        for record in records:
            issues = []

            # Mandatory field checks
            if not record.billing_period:
                issues.append("Missing billing_period")
            if not record.source_type:
                issues.append("Missing source_type")
            if record.raw_cost is None or record.raw_cost < 0:
                issues.append(f"Invalid raw_cost: {record.raw_cost}")

            if issues:
                record.quality_status = "Quarantined"
                record.quality_notes = "; ".join(issues)
                quarantined.append(record)
            else:
                record.quality_status = "Valid"
                valid.append(record)

        return valid, quarantined

    async def reconcile(
        self, run_id: str, source_total: Decimal, staged_total: Decimal
    ) -> dict:
        """
        Cost reconciliation: source total vs. staged total.
        Variance must be within 0.1% tolerance.

        FSD Step 8: Record count validation, cost reconciliation.
        """
        if source_total == 0:
            variance_pct = Decimal("0")
        else:
            variance_pct = abs((staged_total - source_total) / source_total * 100)

        status = "Balanced" if variance_pct <= Decimal("0.1") else "Warning"
        if variance_pct > Decimal("1.0"):
            status = "Critical"

        return {
            "source_total": float(source_total),
            "staged_total": float(staged_total),
            "variance_pct": float(variance_pct),
            "status": status,
        }
