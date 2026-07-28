import asyncio
from contextlib import suppress
import json
import logging
import re
import secrets
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.config import CHAT_SESSION_COOKIE_NAME
from app.core.tools import navigate_tool, normalize_current_page
from app.domain.protocol import (
    ChatTurnRequest,
    ConfirmationRequest,
    ReceiptRequest,
)
from app.services import rag_client
from app.services.agent_service import execute_tool, run_agent
from app.services.confirmation_service import (
    InvalidConfirmationToken,
    verify_confirmation_token,
)

router = APIRouter()
logger = logging.getLogger(__name__)
_SESSION_PATTERN = re.compile(r"[A-Za-z0-9_-]{32,128}")
_AFFIRMATIVE_PATTERN = re.compile(
    r"(?:sí|si|confirmo|confirma|sí,\s*confirma|si,\s*confirma|hazlo)[.!]?",
    flags=re.IGNORECASE,
)

Question = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2_000),
]
HistoryText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=4_000),
]
CurrentPage = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=5_000),
]


class ChatHistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    sender: Literal["user", "bot"]
    text: HistoryText


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    question: Question
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=20)
    current_page: CurrentPage = "/"

    @field_validator("current_page")
    @classmethod
    def validate_current_page(cls, value: str) -> str:
        normalized = normalize_current_page(value)
        if normalized is None:
            raise ValueError("current_page debe ser una ruta válida de la aplicación")
        return normalized

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if file.content_type not in ["text/plain", "application/octet-stream"]:
        raise HTTPException(400, "Solo archivos .txt")

    content = await file.read()
    if len(content) > 2_000_000:
        raise HTTPException(413, "Archivo demasiado grande (máx 2 MB).")

    try:
        result = await rag_client.upload(file.filename or "upload.txt", content)
        return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 400:
            raise HTTPException(400, e.response.text)
        raise HTTPException(500, f"Error interno: {e.response.text}")
    except Exception as e:
        raise HTTPException(500, f"Error interno: {str(e)}")

@router.post("/chat")
async def chat(request: Request, payload: ChatRequest):
    # Extraer cookies para pasarlas al agente
    cookies = request.cookies

    try:
        # Ejecutar el agente con contexto de página
        result = await run_agent(
            payload.question,
            cookies,
            [message.model_dump() for message in payload.history],
            payload.current_page,
        )
        return result
    except Exception:
        logger.exception("Error interno procesando una solicitud de chat.")
        raise HTTPException(500, "Error interno del servicio de chat")


def _chat_session_id(request: Request) -> tuple[str, bool]:
    candidate = request.cookies.get(CHAT_SESSION_COOKIE_NAME, "")
    if _SESSION_PATTERN.fullmatch(candidate):
        return candidate, False
    return secrets.token_urlsafe(32), True


def _sse(event: str, data: dict) -> str:
    return (
        f"event: {event}\n"
        f"data: {json.dumps(data, ensure_ascii=False, default=str, separators=(',', ':'))}\n\n"
    )


async def _perform_confirmation(
    request: Request,
    payload: ConfirmationRequest,
    session_id: str,
) -> dict:
    try:
        action = verify_confirmation_token(
            payload.token,
            session_id=session_id,
        )
    except InvalidConfirmationToken as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if payload.decision == "reject":
        return {
            "answer": "Entendido. No realicé ningún cambio.",
            "status": "rejected",
            "action_id": action.action_id,
            "ui_actions": [],
        }

    result = await execute_tool(
        action.tool,
        action.arguments,
        dict(request.cookies),
        idempotency_key=action.idempotency_key,
    )
    if result == "AUTH_REQUIRED":
        login = json.loads(navigate_tool("/login"))
        return {
            "answer": "Necesitas iniciar sesión antes de confirmar esta acción.",
            "status": "auth_required",
            "action_id": action.action_id,
            "ui_actions": [
                {
                    "id": secrets.token_hex(16),
                    "version": 1,
                    "type": "navigate",
                    "payload": {"url": login["url"]},
                }
            ],
        }

    failed = result.startswith("Error")
    post_action_type = (
        "orders.refresh"
        if action.tool == "create_order_tool"
        else "cart.refresh"
    )
    ui_actions = []
    if not failed:
        ui_actions.append(
            {
                "id": secrets.token_hex(16),
                "version": 1,
                "type": post_action_type,
                "payload": {},
            }
        )
        if action.tool == "create_order_tool":
            ui_actions.append(
                {
                    "id": secrets.token_hex(16),
                    "version": 1,
                    "type": "navigate",
                    "payload": {"url": "/orders"},
                }
            )
    return {
        "answer": result,
        "status": "failed" if failed else "succeeded",
        "action_id": action.action_id,
        "ui_actions": ui_actions,
    }


@router.post("/chat/turns")
async def chat_turn(request: Request, payload: ChatTurnRequest):
    session_id, is_new_session = _chat_session_id(request)

    async def events():
        requested_id = request.headers.get("x-request-id", "")
        turn_id = (
            requested_id
            if re.fullmatch(r"[A-Za-z0-9_-]{16,128}", requested_id)
            else secrets.token_hex(16)
        )
        yield _sse(
            "turn.started",
            {"turn_id": turn_id, "session_id": session_id},
        )
        await asyncio.sleep(0)

        if (
            payload.pending_confirmation_token
            and _AFFIRMATIVE_PATTERN.fullmatch(payload.question.strip())
        ):
            result = await _perform_confirmation(
                request,
                ConfirmationRequest(
                    token=payload.pending_confirmation_token,
                    decision="approve",
                ),
                session_id,
            )
            yield _sse("assistant.delta", {"delta": result["answer"]})
            for action in result["ui_actions"]:
                yield _sse("ui.action", action)
            yield _sse(
                "turn.completed",
                {
                    "turn_id": turn_id,
                    "cost": 0,
                    "status": result["status"],
                },
            )
            return

        event_queue: asyncio.Queue[tuple[str, dict]] = asyncio.Queue(maxsize=128)

        async def emit_agent_event(event: str, data: dict) -> None:
            await event_queue.put((event, data))

        async def run_streaming_agent() -> None:
            try:
                result = await run_agent(
                    payload.question,
                    dict(request.cookies),
                    [message.model_dump() for message in payload.history],
                    payload.page_context.route,
                    structured=True,
                    session_id=session_id,
                    page_context={
                        **payload.page_context.model_dump(),
                        "action_receipts": [
                            receipt.model_dump() for receipt in payload.receipts
                        ],
                    },
                    event_sink=emit_agent_event,
                )
                await event_queue.put(("__result__", result))
            except Exception:
                logger.exception("El stream del agente terminó con un error.")
                await event_queue.put(
                    (
                        "__error__",
                        {
                            "message": (
                                "No pude completar la respuesta. "
                                "Por favor intenta nuevamente."
                            )
                        },
                    )
                )

        agent_task = asyncio.create_task(run_streaming_agent())
        streamed_text = ""
        result = None
        try:
            while True:
                event, data = await event_queue.get()
                if event == "__result__":
                    result = data
                    break
                if event == "__error__":
                    yield _sse("assistant.delta", {"delta": data["message"]})
                    yield _sse(
                        "turn.completed",
                        {
                            "turn_id": turn_id,
                            "cost": 0,
                            "status": "failed",
                        },
                    )
                    return
                if event == "assistant.delta":
                    streamed_text += str(data.get("delta", ""))
                yield _sse(event, data)
        finally:
            if not agent_task.done():
                agent_task.cancel()
                with suppress(asyncio.CancelledError):
                    await agent_task

        assert result is not None
        answer = result["answer"]
        if answer and not streamed_text.rstrip().endswith(answer.rstrip()):
            separator = "\n\n" if streamed_text.strip() else ""
            yield _sse(
                "assistant.delta",
                {"delta": separator + answer},
            )
        for renderable in result["renderables"]:
            yield _sse("renderable", renderable)
        for action in result["ui_actions"]:
            yield _sse("ui.action", action)
        if result["pending_confirmation"]:
            yield _sse(
                "confirmation.required",
                result["pending_confirmation"],
            )
        yield _sse(
            "turn.completed",
            {
                "turn_id": turn_id,
                "cost": result["cost"],
                "trace": result["trace"],
                "status": "completed",
            },
        )

    response = StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
    if is_new_session:
        response.set_cookie(
            CHAT_SESSION_COOKIE_NAME,
            session_id,
            max_age=7 * 24 * 60 * 60,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="lax",
            path="/",
        )
    return response


@router.post("/chat/confirmations")
async def confirm_action(request: Request, payload: ConfirmationRequest):
    session_id, is_new_session = _chat_session_id(request)
    if is_new_session:
        raise HTTPException(
            status_code=400,
            detail="La sesión de confirmación ya no está disponible.",
        )
    return await _perform_confirmation(request, payload, session_id)


@router.post("/chat/actions/receipt", status_code=202)
async def action_receipt(request: Request, payload: ReceiptRequest):
    session_id, _ = _chat_session_id(request)
    logger.info(
        "UI action receipt session=%s action=%s status=%s revision=%s",
        session_id[:8],
        payload.receipt.action_id,
        payload.receipt.status,
        payload.receipt.resulting_revision,
    )
    return {"accepted": True}
