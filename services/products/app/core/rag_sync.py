import logging
from typing import Dict, Any

import httpx

from app.config import RAG_API_URL, INTERNAL_API_TOKEN

logger = logging.getLogger(__name__)

_DOCUMENTS_URL = RAG_API_URL + "/internal/rag/documents"
_NAMESPACE = "products"
_TIMEOUT = 10


def get_product_text_representation(product: Dict[str, Any]) -> str:
    """
    Convierte la data del producto en un texto descriptivo para el RAG.
    """
    # Manejo seguro de campos opcionales
    name = product.get("name", "Sin nombre")
    desc = product.get("description", "") or "Sin descripción"
    price = product.get("price", 0)
    stock = product.get("stock", 0)
    category = product.get("category", "General")
    career = product.get("career", "General")

    # Formato legible para el LLM
    text = (
        f"ID: {product.get('id', 'N/A')}\n"
        f"Producto: {name}\n"
        f"Categoría: {category}\n"
        f"Carrera: {career}\n"
        f"Precio: {price} Bs.\n"
        f"Stock disponible: {stock}\n"
        f"Descripción: {desc}"
    )
    return text


def sync_product_to_rag(product_data: Dict[str, Any]) -> None:
    """
    Sincroniza un producto (creación/edición) con el servicio rag.
    Best-effort: un fallo aquí nunca debe impedir que la escritura del
    producto (ya persistida en Firestore) se reporte como exitosa.
    """
    raw_id = product_data.get("id")
    if not raw_id:
        return

    text = get_product_text_representation(product_data)

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                _DOCUMENTS_URL,
                json={"namespace": _NAMESPACE, "source_id": raw_id, "text": text},
                headers={"X-Internal-Token": INTERNAL_API_TOKEN},
            )
            resp.raise_for_status()
        logger.info("Producto %s sincronizado con RAG.", raw_id)
    except (httpx.HTTPStatusError, httpx.RequestError):
        logger.warning("No se pudo sincronizar el producto %s con el RAG.", raw_id, exc_info=True)


def delete_product_from_rag(product_id: str) -> None:
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
    except (httpx.HTTPStatusError, httpx.RequestError):
        logger.warning("No se pudo eliminar el producto %s del RAG.", product_id, exc_info=True)
