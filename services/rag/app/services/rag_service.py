import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence

from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.vector import Vector

from app.core.config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    COSINE_DISTANCE_THRESHOLD,
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
    MAX_CHUNKS,
    PRODUCTS_COLLECTION,
    RAG_CHUNKS_COLLECTION,
    RAG_SOURCES_COLLECTION,
    SOURCE_SEGMENT_CHARS,
    openai_client,
)
from app.core.firebase import firestore_db


class SourceNotFoundError(ValueError):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _source_key(namespace: str, source_id: str) -> str:
    if namespace not in {"products", "documents"}:
        raise ValueError(f"Namespace RAG desconocido: {namespace}")
    return f"{namespace}:{source_id}"


def _chunk_document_id(namespace: str, source_id: str, chunk_index: int) -> str:
    identity = f"{namespace}\0{source_id}\0{chunk_index}".encode("utf-8")
    return hashlib.sha256(identity).hexdigest()


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _decode_content(content: bytes) -> str:
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("latin1")


def chunk_text(text: str) -> List[str]:
    """Split text into bounded, overlapping chunks without duplicates."""
    text = text.strip()
    n = len(text)
    if n == 0:
        return []
    if n <= CHUNK_SIZE:
        return [text]

    chunks: List[str] = []
    start = 0
    while start < n and len(chunks) < MAX_CHUNKS:
        end = min(start + CHUNK_SIZE, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == n:
            break
        new_start = end - CHUNK_OVERLAP
        if new_start <= start:
            break
        start = new_start

    return list(dict.fromkeys(chunks))


def _validated_embeddings(response: Any, expected_count: int) -> List[List[float]]:
    embeddings = [item.embedding for item in response.data]
    if len(embeddings) != expected_count:
        raise RuntimeError("OpenAI devolvió una cantidad inesperada de embeddings.")
    if any(len(embedding) != EMBEDDING_DIM for embedding in embeddings):
        raise RuntimeError(
            f"Los embeddings deben tener exactamente {EMBEDDING_DIM} dimensiones."
        )
    return embeddings


def embed_text(text: str) -> List[float]:
    response = openai_client.embeddings.create(model=EMBEDDING_MODEL, input=text)
    return _validated_embeddings(response, 1)[0]


def embed_texts(texts: Sequence[str]) -> List[List[float]]:
    if not texts:
        return []
    response = openai_client.embeddings.create(model=EMBEDDING_MODEL, input=list(texts))
    return _validated_embeddings(response, len(texts))


def get_product_text_representation(product: Dict[str, Any]) -> str:
    name = product.get("name", "Sin nombre")
    description = product.get("description", "") or "Sin descripción"
    price = product.get("price", 0)
    stock = product.get("stock", 0)
    category = product.get("category", "General")
    career = product.get("career", "General")
    tags = ", ".join(product.get("tags") or [])
    use_cases = ", ".join(product.get("use_cases") or [])
    attributes = ", ".join(
        f"{key}: {value}"
        for key, value in (product.get("attributes") or {}).items()
    )
    return (
        f"ID: {product.get('id', 'N/A')}\n"
        f"Producto: {name}\n"
        f"Categoría: {category}\n"
        f"Carrera: {career}\n"
        f"Precio: {price} Bs.\n"
        f"Stock disponible: {stock}\n"
        f"Etiquetas: {tags or 'Sin etiquetas'}\n"
        f"Usos: {use_cases or 'Sin usos registrados'}\n"
        f"Atributos: {attributes or 'Sin atributos registrados'}\n"
        f"Descripción: {description}"
    )


def _stream_chunks_for_source(source_key: str) -> Iterable[Any]:
    return (
        firestore_db.collection(RAG_CHUNKS_COLLECTION)
        .where(filter=FieldFilter("source_key", "==", source_key))
        .stream()
    )


def _replace_chunks(
    namespace: str,
    source_id: str,
    chunks: Sequence[str],
    embeddings: Sequence[Sequence[float]],
) -> int:
    if len(chunks) != len(embeddings):
        raise ValueError("Cada chunk debe tener exactamente un embedding.")

    source_key = _source_key(namespace, source_id)
    collection = firestore_db.collection(RAG_CHUNKS_COLLECTION)
    existing = {doc.id: doc for doc in _stream_chunks_for_source(source_key)}
    new_ids = {
        _chunk_document_id(namespace, source_id, index)
        for index in range(len(chunks))
    }
    batch = firestore_db.batch()
    updated_at = _now()
    text_hash = _content_hash("\n".join(chunks))

    for index, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        document_id = _chunk_document_id(namespace, source_id, index)
        batch.set(
            collection.document(document_id),
            {
                "namespace": namespace,
                "source_id": source_id,
                "source_key": source_key,
                "chunk_index": index,
                "text": chunk,
                "embedding": Vector(embedding),
                "embedding_model": EMBEDDING_MODEL,
                "content_hash": text_hash,
                "updated_at": updated_at,
            },
        )

    for stale_id, stale_doc in existing.items():
        if stale_id not in new_ids:
            batch.delete(stale_doc.reference)

    batch.commit()
    return len(chunks)


def _index_text(namespace: str, source_id: str, text: str) -> Dict[str, Any]:
    chunks = chunk_text(text)
    embeddings = embed_texts(chunks)
    stored = _replace_chunks(namespace, source_id, chunks, embeddings)
    return {"source_id": source_id, "chunks_stored": stored}


def index_document(namespace: str, source_id: str) -> Dict[str, Any]:
    if namespace != "products":
        raise ValueError(f"Namespace RAG desconocido: {namespace}")
    snapshot = (
        firestore_db.collection(PRODUCTS_COLLECTION).document(source_id).get()
    )
    if not snapshot.exists:
        raise SourceNotFoundError(f"Producto no encontrado: {source_id}")
    product = snapshot.to_dict() or {}
    product["id"] = snapshot.id
    return _index_text(namespace, source_id, get_product_text_representation(product))


def delete_document(namespace: str, source_id: str) -> Dict[str, Any]:
    source_key = _source_key(namespace, source_id)
    docs = list(_stream_chunks_for_source(source_key))
    if docs:
        batch = firestore_db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()
    return {"source_id": source_id, "chunks_deleted": len(docs)}


def store_text_source(
    source_id: str,
    filename: str,
    text: str,
    *,
    kind: str = "upload",
) -> Dict[str, Any]:
    if kind not in {"upload", "seed"}:
        raise ValueError("Tipo de fuente de texto desconocido.")
    if not chunk_text(text):
        raise ValueError("El archivo no contiene texto útil.")

    source_ref = firestore_db.collection(RAG_SOURCES_COLLECTION).document(source_id)
    previous = source_ref.get()
    previous_data = previous.to_dict() if previous.exists else {}
    segments = [
        text[start : start + SOURCE_SEGMENT_CHARS]
        for start in range(0, len(text), SOURCE_SEGMENT_CHARS)
    ]
    old_segment_count = int((previous_data or {}).get("segment_count", 0))
    batch = firestore_db.batch()
    now = _now()
    batch.set(
        source_ref,
        {
            "source_id": source_id,
            "namespace": "documents",
            "kind": kind,
            "filename": filename,
            "content_hash": _content_hash(text),
            "segment_count": len(segments),
            "created_at": (previous_data or {}).get("created_at", now),
            "updated_at": now,
        },
    )
    for index, segment in enumerate(segments):
        batch.set(
            source_ref.collection("segments").document(f"{index:06d}"),
            {"index": index, "text": segment},
        )
    for index in range(len(segments), old_segment_count):
        batch.delete(source_ref.collection("segments").document(f"{index:06d}"))
    batch.commit()
    return {
        "source_id": source_id,
        "segments_stored": len(segments),
        "content_hash": _content_hash(text),
    }


def _read_stored_source(source_id: str) -> str:
    source_ref = firestore_db.collection(RAG_SOURCES_COLLECTION).document(source_id)
    source = source_ref.get()
    if not source.exists:
        raise SourceNotFoundError(f"Fuente de texto no encontrada: {source_id}")
    segment_count = int((source.to_dict() or {}).get("segment_count", 0))
    segments: List[str] = []
    for index in range(segment_count):
        segment = source_ref.collection("segments").document(f"{index:06d}").get()
        if not segment.exists:
            raise RuntimeError(
                f"Falta el segmento {index} de la fuente de texto {source_id}."
            )
        segments.append((segment.to_dict() or {}).get("text", ""))
    return "".join(segments)


def index_stored_source(source_id: str) -> Dict[str, Any]:
    return _index_text("documents", source_id, _read_stored_source(source_id))


def process_upload(
    filename: str,
    content: bytes,
    *,
    source_id: Optional[str] = None,
    kind: str = "upload",
) -> Dict[str, Any]:
    text = _decode_content(content)
    actual_source_id = source_id or str(uuid.uuid4())
    store_text_source(actual_source_id, filename, text, kind=kind)
    return index_stored_source(actual_source_id)


def get_answer(question: str, top_k: int = 5) -> Dict[str, Any]:
    query_embedding = embed_text(question)
    vector_query = firestore_db.collection(RAG_CHUNKS_COLLECTION).find_nearest(
        vector_field="embedding",
        query_vector=Vector(query_embedding),
        distance_measure=DistanceMeasure.COSINE,
        limit=top_k,
        distance_result_field="vector_distance",
        distance_threshold=COSINE_DISTANCE_THRESHOLD,
    )

    matches: List[Dict[str, Any]] = []
    for snapshot in vector_query.stream():
        data = snapshot.to_dict() or {}
        distance = float(data.get("vector_distance", 0.0))
        matches.append(
            {
                "id": snapshot.id,
                "source_id": data.get("source_id"),
                "namespace": data.get("namespace"),
                "chunk_index": data.get("chunk_index"),
                "text": data.get("text", ""),
                "similarity": 1.0 - distance,
            }
        )

    context = "\n\n".join(f"- {match['text']}" for match in matches)
    return {
        "answer": (
            context
            if context
            else "No encontré información relevante en la base de conocimientos."
        ),
        "chunks_used": matches,
    }


def prune_orphan_chunks(valid_source_keys: set[str]) -> int:
    orphan_refs = []
    for snapshot in firestore_db.collection(RAG_CHUNKS_COLLECTION).stream():
        data = snapshot.to_dict() or {}
        if data.get("source_key") not in valid_source_keys:
            orphan_refs.append(snapshot.reference)

    deleted = 0
    for start in range(0, len(orphan_refs), 450):
        batch = firestore_db.batch()
        current = orphan_refs[start : start + 450]
        for reference in current:
            batch.delete(reference)
        batch.commit()
        deleted += len(current)
    return deleted
