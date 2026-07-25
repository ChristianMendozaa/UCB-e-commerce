import logging
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.tools import normalize_current_page
from app.services import rag_client
from app.services.agent_service import run_agent

router = APIRouter()
logger = logging.getLogger(__name__)

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
