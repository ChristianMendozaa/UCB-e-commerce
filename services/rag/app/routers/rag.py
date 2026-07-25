import logging
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.deps.internal_auth import require_internal_token
from app.services.rag_service import (
    SourceNotFoundError,
    delete_document,
    get_answer,
    index_document,
    process_upload,
)

router = APIRouter(
    prefix="/internal/rag",
    dependencies=[Depends(require_internal_token)],
)
logger = logging.getLogger(__name__)

Namespace = Literal["products"]
SourceId = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
]
QueryText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2_000),
]


class IndexDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    namespace: Namespace
    source_id: SourceId


class DeleteDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    namespace: Namespace
    source_id: SourceId


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    query: QueryText
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("/documents")
def upsert_document(payload: IndexDocumentRequest):
    try:
        return index_document(payload.namespace, payload.source_id)
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Error indexando documento RAG (source_id=%s)", payload.source_id)
        raise HTTPException(status_code=502, detail="No se pudo indexar el documento.")


@router.delete("/documents")
def remove_document(payload: DeleteDocumentRequest):
    try:
        return delete_document(payload.namespace, payload.source_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Error eliminando documento RAG (source_id=%s)", payload.source_id)
        raise HTTPException(status_code=502, detail="No se pudo eliminar el documento.")


@router.post("/query")
def query_documents(payload: QueryRequest):
    try:
        return get_answer(payload.query, top_k=payload.top_k)
    except Exception:
        logger.exception("Error consultando el RAG (query=%r)", payload.query)
        raise HTTPException(status_code=502, detail="No se pudo consultar el RAG.")


@router.post("/uploads")
async def upload_document(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 2_000_000:
        raise HTTPException(413, "Archivo demasiado grande (máx 2 MB).")
    try:
        return process_upload(file.filename or "upload.txt", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Error procesando la carga de un documento RAG.")
        raise HTTPException(status_code=502, detail="No se pudo procesar el archivo.")
