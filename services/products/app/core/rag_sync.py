import os
from typing import List, Dict, Any
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not (OPENAI_API_KEY and SUPABASE_URL and SUPABASE_KEY):
    # Si faltan variables, no rompemos la app, pero logueamos advertencia
    print("WARNING: Faltan variables de entorno para RAG (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). La sincronización no funcionará.")
    openai_client = None
    supabase = None
else:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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

def embed_text(text: str) -> List[float]:
    if not openai_client:
        return []
    try:
        response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error generando embedding: {e}")
        return []

import uuid

# ... imports ...

def get_deterministic_uuid(source_id: str) -> str:
    """
    Genera un UUID determinista a partir de un ID de texto (Firestore ID).
    Usamos UUID v5 con un namespace personalizado.
    """
    # Namespace arbitrario para nuestros productos
    NAMESPACE_PRODUCTS = uuid.uuid5(uuid.NAMESPACE_DNS, "ucb-commerce-products")
    return str(uuid.uuid5(NAMESPACE_PRODUCTS, source_id))

def sync_product_to_rag(product_data: Dict[str, Any]):
    """
    Sincroniza un producto (creación/edición) con la tabla RAG.
    Estrategia: Borrar chunks anteriores de este producto e insertar uno nuevo.
    """
    if not supabase or not openai_client:
        return

    raw_id = product_data.get("id")
    if not raw_id:
        return
    
    # Convertir ID de Firestore a UUID válido para Supabase
    product_uuid = get_deterministic_uuid(raw_id)

    # 1. Borrar registros previos de este source_id
    try:
        supabase.table("rag_ucbcommerce_chunks").delete().eq("source_id", product_uuid).execute()
    except Exception as e:
        print(f"Error borrando chunks antiguos para {raw_id} ({product_uuid}): {e}")

    # 2. Generar texto y embedding
    text = get_product_text_representation(product_data)
    embedding = embed_text(text)
    
    if not embedding:
        return

    # 3. Insertar nuevo chunk
    row = {
        "source_id": product_uuid,
        "chunk_index": 0,
        "text": text,
        "embedding": embedding
    }

    try:
        supabase.table("rag_ucbcommerce_chunks").insert(row).execute()
        print(f"Producto {raw_id} sincronizado con RAG (UUID: {product_uuid}).")
    except Exception as e:
        print(f"Error insertando chunk para {raw_id}: {e}")

def delete_product_from_rag(product_id: str):
    """
    Elimina los chunks de un producto del RAG.
    """
    if not supabase:
        return

    product_uuid = get_deterministic_uuid(product_id)

    try:
        supabase.table("rag_ucbcommerce_chunks").delete().eq("source_id", product_uuid).execute()
        print(f"Producto {product_id} eliminado de RAG.")
    except Exception as e:
        print(f"Error eliminando chunks para {product_id}: {e}")
