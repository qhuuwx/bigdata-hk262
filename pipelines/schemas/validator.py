"""
Schema Validator & Dead-Letter Queue (DLQ) Router
Validates incoming POS/ERP events against JSON Schema contracts and routes malformed
records to a structured DLQ JSONL sink with SLA threshold monitoring.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

from jsonschema import Draft202012Validator

SCHEMA_DIR = Path(__file__).resolve().parent


def load_schema(filename: str) -> Dict[str, Any]:
    with (SCHEMA_DIR / filename).open("r", encoding="utf-8") as fh:
        return json.load(fh)


SALES_VALIDATOR = Draft202012Validator(load_schema("sales_event.schema.json"))
INVENTORY_VALIDATOR = Draft202012Validator(load_schema("inventory_event.schema.json"))

NUMERIC_FIELDS = {
    "sales": ("Qty Sold", "Sales Amount", "Cogs", "Number of Transactions"),
    "inventory": (
        "Qty on hand",
        "Stocks Selling Amount",
        "Cost of Stocks",
        "Stock Unit Selling Price",
        "Stock Unit Cost Price",
    ),
}


def validate_event(event: Dict[str, Any], stream_type: str = "sales") -> Tuple[bool, List[str]]:
    """Validates an event payload against its JSON Schema and numeric parseability rules."""
    if not isinstance(event, dict):
        return False, ["Payload must be a JSON object"]

    validator = SALES_VALIDATOR if stream_type == "sales" else INVENTORY_VALIDATOR
    errors = [err.message for err in validator.iter_errors(event)]

    for field in NUMERIC_FIELDS.get(stream_type, ()):
        val = event.get(field)
        if val is not None and val != "":
            try:
                num = float(val)
                if num != num:  # NaN check
                    errors.append(f"Field '{field}' is NaN")
            except (TypeError, ValueError):
                errors.append(f"Field '{field}' is not numeric: {val!r}")

    return len(errors) == 0, errors


def validate_and_route_batch(
    events: List[Dict[str, Any]],
    stream_type: str,
    dlq_path: Path,
    max_dlq_ratio: float = 0.005,
) -> Dict[str, Any]:
    """
    Validates a batch of events, returning valid events and writing malformed records
    to the Dead-Letter Queue (dlq_retail_events.jsonl).
    """
    valid_events: List[Dict[str, Any]] = []
    dlq_records: List[Dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for idx, evt in enumerate(events):
        is_valid, errs = validate_event(evt, stream_type=stream_type)
        if is_valid:
            valid_events.append(evt)
        else:
            dlq_records.append(
                {
                    "stream_type": stream_type,
                    "topic": f"retail.{stream_type}.raw",
                    "dlq_topic": "dlq.retail.events",
                    "offset": idx,
                    "failed_at": now_iso,
                    "validation_errors": errs,
                    "original_payload": evt,
                }
            )

    if dlq_records:
        dlq_path.parent.mkdir(parents=True, exist_ok=True)
        with dlq_path.open("a", encoding="utf-8") as fh:
            for rec in dlq_records:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    total = len(events)
    dlq_ratio = (len(dlq_records) / total) if total > 0 else 0.0
    return {
        "valid_events": valid_events,
        "valid_count": len(valid_events),
        "dlq_count": len(dlq_records),
        "dlq_ratio": round(dlq_ratio, 6),
        "sla_breached": dlq_ratio > max_dlq_ratio,
    }
