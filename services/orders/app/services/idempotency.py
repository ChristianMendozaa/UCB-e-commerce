from __future__ import annotations

import hashlib


def idempotent_order_id(user_id: str, idempotency_key: str) -> str:
    """Return the deterministic order document id for a retried command."""
    if not user_id or not idempotency_key:
        raise ValueError("user_id and idempotency_key are required")
    digest = hashlib.sha256(
        f"{user_id}:{idempotency_key}".encode("utf-8")
    ).hexdigest()
    return f"idem_{digest}"
