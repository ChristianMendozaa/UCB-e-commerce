import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.deps.internal_auth import require_internal_token
from app.services.rag_service import delete_document, index_document

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
DocumentText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=20_000),
]


class IndexDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    namespace: Namespace
    source_id: SourceId
    text: DocumentText


class DeleteDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    namespace: Namespace
    source_id: SourceId


@router.post("/documents")
def upsert_document(payload: IndexDocumentRequest):
    try:
        return index_document(payload.namespace, payload.source_id, payload.text)
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
