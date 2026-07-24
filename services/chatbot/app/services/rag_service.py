import uuid
from typing import List, Dict, Any
from app.core.config import (
    openai_client, supabase,
    CHUNK_SIZE, CHUNK_OVERLAP, MAX_CHUNKS
)

def chunk_text(text: str) -> List[str]:
    """
    Divide el texto en chunks con solapamiento, evitando duplicados
    y bucles infinitos.
    """
    text = text.strip()
    n = len(text)
    if n == 0:
        return []

    # Caso simple: texto corto → un solo chunk
    if n <= CHUNK_SIZE:
        return [text]

    chunks: List[str] = []
    start = 0
    count = 0

    while start < n and count < MAX_CHUNKS:
        end = min(start + CHUNK_SIZE, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
            count += 1

        if end == n:
            # Llegamos al final del texto
            break

        new_start = end - CHUNK_OVERLAP

        # Asegurarnos de que avanzamos y no entramos en bucle
        if new_start <= start:
            break

        start = new_start

    # Opcional: quitar duplicados exactos por seguridad
    seen = set()
    unique_chunks: List[str] = []
    for c in chunks:
        if c not in seen:
            seen.add(c)
            unique_chunks.append(c)

    return unique_chunks


def embed_text(text: str) -> List[float]:
    """Obtiene embedding OpenAI text-embedding-3-small para un solo texto."""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Obtiene embeddings en batch para una lista de textos."""
    if not texts:
        return []
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    # La API devuelve los embeddings en el mismo orden del input
    return [item.embedding for item in response.data]

def process_upload(content: bytes) -> Dict[str, Any]:
    try:
        text = content.decode("utf-8")
    except Exception:
        text = content.decode("latin1")

    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("El archivo no contiene texto útil.")

    source_id = str(uuid.uuid4())

    # Una sola llamada a OpenAI para todos los chunks
    embeddings = embed_texts(chunks)

    rows = []
    for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        rows.append({
            "source_id": source_id,
            "chunk_index": idx,
            "text": chunk,
            "embedding": emb
        })

    if rows:
        supabase.table("rag_ucbcommerce_chunks").insert(rows).execute()

    return {"source_id": source_id, "chunks_stored": len(rows)}

def get_answer(question: str, top_k: int = 5, source_id: str = None) -> Dict[str, Any]:
    q_emb = embed_text(question)

    params = {
        "query_embedding": q_emb,
        "match_count": top_k,
        "filter_source": source_id
    }

    # RPC específica para esta tabla
    rpc = supabase.rpc("match_rag_ucbcommerce_chunks", params).execute()
    matches = rpc.data or []

    # Formatear el contexto
    context = "\n\n".join([f"- {m['text']}" for m in matches])
    
    return {
        "answer": context if context else "No encontré información relevante en la base de conocimientos.",
        "chunks_used": matches
    }
