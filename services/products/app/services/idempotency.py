from __future__ import annotations

import hashlib


def command_receipt_id(user_id: str, idempotency_key: str) -> str:
    """Build a stable, non-reversible Firestore document id for a command."""
    if not user_id or not idempotency_key:
        raise ValueError("user_id and idempotency_key are required")
    return hashlib.sha256(
        f"{user_id}:{idempotency_key}".encode("utf-8")
    ).hexdigest()
