from typing import Any, Dict

import httpx

from app.core.config import INTERNAL_API_TOKEN, RAG_API_URL

_HEADERS = {"X-Internal-Token": INTERNAL_API_TOKEN}
_TIMEOUT = 20


async def query(question: str, top_k: int = 5) -> Dict[str, Any]:
    """
    Consulta el servicio rag y devuelve {"answer": ..., "chunks_used": ...}.
    Propaga errores HTTP/red al llamador (rag_search_tool decide cómo mostrarlos).
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{RAG_API_URL}/internal/rag/query",
            json={"query": question, "top_k": top_k},
            headers=_HEADERS,
        )
        resp.raise_for_status()
        return resp.json()


async def upload(filename: str, content: bytes) -> Dict[str, Any]:
    """
    Envía un archivo de texto al servicio rag para indexarlo como documento suelto.
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{RAG_API_URL}/internal/rag/uploads",
            files={"file": (filename, content, "text/plain")},
            headers=_HEADERS,
        )
        resp.raise_for_status()
        return resp.json()
