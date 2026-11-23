"""
Streaming Event Processor (Redpanda/Kafka + Schema Validation + DLQ + Redis Sync)
Processes micro-batches of POS sales and inventory events, routing malformed events
to dlq_retail_events.jsonl and emitting clean updates for Redis Streams / Lakehouse Bronze.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from pipelines.schemas.validator import validate_and_route_batch


def process_stream_microbatch(
    events: List[Dict[str, Any]],
    stream_type: str,
    lakehouse_dir: Path,
) -> Dict[str, Any]:
    """
    Validates a streaming micro-batch against JSON Schema, routes bad payloads to DLQ,
    and writes valid events to a Bronze streaming staging JSONL sink.
    """
    dlq_path = lakehouse_dir / "dlq" / "dlq_retail_events.jsonl"
    result = validate_and_route_batch(events, stream_type=stream_type, dlq_path=dlq_path)

    valid_events = result["valid_events"]
    if valid_events:
        bronze_stream_path = lakehouse_dir / "bronze" / f"{stream_type}_stream.jsonl"
        bronze_stream_path.parent.mkdir(parents=True, exist_ok=True)
        with bronze_stream_path.open("a", encoding="utf-8") as fh:
            for evt in valid_events:
                fh.write(json.dumps(evt, ensure_ascii=False) + "\n")

    return {
        "valid_count": result["valid_count"],
        "dlq_count": result["dlq_count"],
        "dlq_ratio": result["dlq_ratio"],
        "sla_breached": result["sla_breached"],
    }
