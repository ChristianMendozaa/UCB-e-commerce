from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass
from typing import Any

from app.core.config import CHAT_ACTION_SIGNING_SECRET


CONFIRMATION_TTL_SECONDS = 5 * 60
CONFIRMABLE_TOOLS = frozenset(
    {
        "add_to_cart_tool",
        "set_cart_quantity_tool",
        "remove_from_cart_tool",
        "clear_cart_tool",
        "create_order_tool",
    }
)


class InvalidConfirmationToken(ValueError):
    pass


@dataclass(frozen=True)
class ConfirmedAction:
    action_id: str
    session_id: str
    tool: str
    arguments: dict[str, Any]
    idempotency_key: str
    expires_at: int


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    try:
        return base64.urlsafe_b64decode(value + padding)
    except Exception as exc:
        raise InvalidConfirmationToken("Token de confirmación inválido.") from exc


def _signature(payload: str) -> str:
    return _b64encode(
        hmac.new(
            CHAT_ACTION_SIGNING_SECRET.encode("utf-8"),
            payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
    )


def create_confirmation_token(
    *,
    session_id: str,
    tool: str,
    arguments: dict[str, Any],
    now: int | None = None,
) -> tuple[str, ConfirmedAction]:
    if tool not in CONFIRMABLE_TOOLS:
        raise ValueError("La herramienta no admite confirmación.")
    issued_at = int(time.time() if now is None else now)
    action_id = uuid.uuid4().hex
    payload_data = {
        "v": 1,
        "action_id": action_id,
        "session_id": session_id,
        "tool": tool,
        "arguments": arguments,
        "idempotency_key": f"chat:{action_id}",
        "issued_at": issued_at,
        "expires_at": issued_at + CONFIRMATION_TTL_SECONDS,
    }
    payload = _b64encode(
        json.dumps(
            payload_data,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    )
    token = f"{payload}.{_signature(payload)}"
    return token, ConfirmedAction(
        action_id=action_id,
        session_id=session_id,
        tool=tool,
        arguments=arguments,
        idempotency_key=payload_data["idempotency_key"],
        expires_at=payload_data["expires_at"],
    )


def verify_confirmation_token(
    token: str,
    *,
    session_id: str,
    now: int | None = None,
) -> ConfirmedAction:
    try:
        payload, supplied_signature = token.split(".", 1)
    except ValueError as exc:
        raise InvalidConfirmationToken("Token de confirmación inválido.") from exc
    expected_signature = _signature(payload)
    if not hmac.compare_digest(supplied_signature, expected_signature):
        raise InvalidConfirmationToken("Firma de confirmación inválida.")
    try:
        data = json.loads(_b64decode(payload))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InvalidConfirmationToken("Token de confirmación inválido.") from exc
    if not isinstance(data, dict) or data.get("v") != 1:
        raise InvalidConfirmationToken("Versión de confirmación inválida.")
    if data.get("session_id") != session_id:
        raise InvalidConfirmationToken("La confirmación pertenece a otra sesión.")
    tool = data.get("tool")
    arguments = data.get("arguments")
    if tool not in CONFIRMABLE_TOOLS or not isinstance(arguments, dict):
        raise InvalidConfirmationToken("Acción de confirmación inválida.")
    expires_at = data.get("expires_at")
    if not isinstance(expires_at, int) or expires_at <= int(
        time.time() if now is None else now
    ):
        raise InvalidConfirmationToken("La confirmación expiró.")
    return ConfirmedAction(
        action_id=str(data["action_id"]),
        session_id=session_id,
        tool=tool,
        arguments=arguments,
        idempotency_key=str(data["idempotency_key"]),
        expires_at=expires_at,
    )


def confirmation_copy(tool: str, arguments: dict[str, Any]) -> tuple[str, str]:
    if tool == "add_to_cart_tool":
        quantity = arguments.get("quantity", 1)
        product_id = arguments.get("product_id", "")
        return (
            "Agregar al carrito",
            f"Agregar {quantity} unidad(es) del producto {product_id}.",
        )
    if tool == "set_cart_quantity_tool":
        return (
            "Actualizar cantidad",
            f"Dejar {arguments.get('quantity')} unidad(es) del producto "
            f"{arguments.get('product_id', '')}.",
        )
    if tool == "remove_from_cart_tool":
        return (
            "Quitar del carrito",
            f"Quitar el producto {arguments.get('product_id', '')} del carrito.",
        )
    if tool == "clear_cart_tool":
        return "Vaciar carrito", "Eliminar todos los productos del carrito."
    return "Crear pedido", "Crear el pedido con el contenido actual del carrito."
