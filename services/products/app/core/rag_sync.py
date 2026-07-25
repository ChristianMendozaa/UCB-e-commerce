import logging
from typing import Any, Dict

import httpx

from app.config import RAG_API_URL, INTERNAL_API_TOKEN

logger = logging.getLogger(__name__)

_DOCUMENTS_URL = RAG_API_URL + "/internal/rag/documents"
_NAMESPACE = "products"
_TIMEOUT = 10


def sync_product_to_rag(product_data: Dict[str, Any]) -> bool:
    """
    Sincroniza un producto (creación/edición) con el servicio rag.
    Best-effort: un fallo aquí nunca debe impedir que la escritura del
    producto (ya persistida en Firestore) se reporte como exitosa.
    """
    raw_id = product_data.get("id")
    if not raw_id:
        return False

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                _DOCUMENTS_URL,
                json={"namespace": _NAMESPACE, "source_id": raw_id},
                headers={"X-Internal-Token": INTERNAL_API_TOKEN},
            )
            resp.raise_for_status()
        logger.info("Producto %s sincronizado con RAG.", raw_id)
        return True
    except (httpx.HTTPStatusError, httpx.RequestError):
        logger.warning("No se pudo sincronizar el producto %s con el RAG.", raw_id, exc_info=True)
        return False


def delete_product_from_rag(product_id: str) -> bool:
    """
    Elimina los chunks de un producto del RAG. Best-effort, ver sync_product_to_rag.
    """
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.request(
                "DELETE",
                _DOCUMENTS_URL,
                json={"namespace": _NAMESPACE, "source_id": product_id},
                headers={"X-Internal-Token": INTERNAL_API_TOKEN},
            )
            resp.raise_for_status()
        logger.info("Producto %s eliminado del RAG.", product_id)
        return True
    except (httpx.HTTPStatusError, httpx.RequestError):
        logger.warning("No se pudo eliminar el producto %s del RAG.", product_id, exc_info=True)
        return False
