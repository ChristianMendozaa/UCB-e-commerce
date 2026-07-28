from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.tools import normalize_current_page


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class HistoryMessage(StrictModel):
    sender: Literal["user", "bot"]
    text: str = Field(min_length=1, max_length=4_000)


class PageContext(StrictModel):
    route: str = Field(default="/", min_length=1, max_length=5_000)
    surface: Literal[
        "home",
        "catalog",
        "product",
        "cart",
        "orders",
        "careers",
        "career",
        "login",
        "unknown",
    ] = "unknown"
    revision: int = Field(default=0, ge=0)
    capabilities: list[str] = Field(default_factory=list, max_length=20)
    state: dict[str, Any] = Field(default_factory=dict)

    @field_validator("route")
    @classmethod
    def validate_route(cls, value: str) -> str:
        normalized = normalize_current_page(value)
        if normalized is None:
            raise ValueError("route debe ser una ruta válida de la aplicación")
        return normalized

    @field_validator("capabilities")
    @classmethod
    def validate_capabilities(cls, value: list[str]) -> list[str]:
        for capability in value:
            if (
                not capability
                or len(capability) > 80
                or not all(part.replace("_", "").isalnum() for part in capability.split("."))
            ):
                raise ValueError("capability inválida")
        return list(dict.fromkeys(value))

    @field_validator("state")
    @classmethod
    def validate_state_size(cls, value: dict[str, Any]) -> dict[str, Any]:
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        if len(encoded.encode("utf-8")) > 16_384:
            raise ValueError("state excede el límite permitido")
        return value


class ActionReceipt(StrictModel):
    action_id: str = Field(min_length=1, max_length=128)
    status: Literal["succeeded", "rejected", "failed", "unsupported"]
    detail: str | None = Field(default=None, max_length=500)
    resulting_revision: int | None = Field(default=None, ge=0)


class ChatTurnRequest(StrictModel):
    question: str = Field(min_length=1, max_length=2_000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=20)
    page_context: PageContext = Field(default_factory=PageContext)
    receipts: list[ActionReceipt] = Field(default_factory=list, max_length=20)
    pending_confirmation_token: str | None = Field(default=None, max_length=8_000)

    @field_validator("question")
    @classmethod
    def strip_question(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("question no puede estar vacía")
        return stripped


class ConfirmationRequest(StrictModel):
    token: str = Field(min_length=1, max_length=8_000)
    decision: Literal["approve", "reject"]


class ReceiptRequest(StrictModel):
    session_id: str | None = Field(default=None, max_length=256)
    receipt: ActionReceipt


class PreferencePatch(StrictModel):
    career: str | None = Field(default=None, max_length=100)
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    categories: list[str] | None = Field(default=None, max_length=20)

    @field_validator("categories")
    @classmethod
    def clean_categories(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [item.strip() for item in value if item.strip()]
        if any(len(item) > 100 for item in cleaned):
            raise ValueError("categoría demasiado larga")
        return list(dict.fromkeys(cleaned))

    @field_validator("budget_max")
    @classmethod
    def validate_budget_range(cls, value: float | None, info):
        minimum = info.data.get("budget_min")
        if value is not None and minimum is not None and value < minimum:
            raise ValueError("budget_max no puede ser menor a budget_min")
        return value


class UIAction(StrictModel):
    id: str
    version: Literal[1] = 1
    type: Literal[
        "navigate",
        "catalog.apply_filters",
        "catalog.clear_filters",
        "catalog.set_sort",
        "catalog.set_view",
        "product.set_quantity",
        "products.highlight",
        "cart.refresh",
        "orders.refresh",
    ]
    payload: dict[str, Any]


class Renderable(StrictModel):
    id: str
    version: Literal[1] = 1
    type: Literal[
        "product_list",
        "comparison",
        "cart_summary",
        "order_list",
        "suggestions",
    ]
    data: dict[str, Any]


class PendingConfirmation(StrictModel):
    id: str
    token: str
    tool: str
    title: str
    description: str
    arguments: dict[str, Any]
    expires_at: int
