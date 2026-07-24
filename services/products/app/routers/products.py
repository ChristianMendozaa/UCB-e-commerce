# app/routers/products.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from typing import Optional

from app.deps.auth import get_current_user
from app.deps.permissions import can_manage_career_or_403, visible_careers_for
from app.schemas.products import ProductCreate, ProductUpdate, ProductOut, ProductList
from app.repositories import products_repo as repo
from app.services.images import upload_image_and_get_url  # ✅ nuevo
from app.core.rag_sync import sync_product_to_rag, delete_product_from_rag
# Nota: Implementaremos la lógica de iteración aquí o en rag_sync, pero como rag_sync no ve el repo, 
# lo haremos en el endpoint usando el repo.

router = APIRouter(prefix="/api/products", tags=["products"])

# --- RUTA PÚBLICA (debe ir antes del detalle) ---
@router.get("/public", response_model=ProductList, tags=["public"])
def list_public_products(
    q: Optional[str] = Query(None, description="Búsqueda simple en nombre/descripcion"),
    category: Optional[str] = Query(None),
    career: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    cursor: Optional[str] = Query(None, description="ISO datetime para paginación"),
):
    items, next_cursor = repo.list_products(
        q=q, category=category, career=career, limit=limit, cursor_iso=cursor, restrict_to_careers=None
    )
    return {"items": items, "next_cursor": next_cursor}

# --- LISTA AUTENTICADA ---
@router.get("", response_model=ProductList)
def list_products(
    q: Optional[str] = Query(None, description="Búsqueda simple en nombre/descripcion"),
    category: Optional[str] = Query(None),
    career: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    cursor: Optional[str] = Query(None, description="ISO datetime para paginación"),
    user=Depends(get_current_user),
):
    restrict_to = visible_careers_for(user["uid"])
    items, next_cursor = repo.list_products(
        q=q, category=category, career=career, limit=limit, cursor_iso=cursor,
        restrict_to_careers=restrict_to if career is None else None,
    )
    return {"items": items, "next_cursor": next_cursor}

# --- DETALLE AUTENTICADO ---
@router.get("/{prod_id}", response_model=ProductOut, tags=["public"])
def get_product(prod_id: str):
    p = repo.get_product(prod_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
# lo haremos en el endpoint usando el repo.

router = APIRouter(prefix="/api/products", tags=["products"])

# --- RUTA PÚBLICA (debe ir antes del detalle) ---
@router.get("/public", response_model=ProductList, tags=["public"])
def list_public_products(
    q: Optional[str] = Query(None, description="Búsqueda simple en nombre/descripcion"),
    category: Optional[str] = Query(None),
    career: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    cursor: Optional[str] = Query(None, description="ISO datetime para paginación"),
):
    items, next_cursor = repo.list_products(
        q=q, category=category, career=career, limit=limit, cursor_iso=cursor, restrict_to_careers=None
    )
    return {"items": items, "next_cursor": next_cursor}

# --- LISTA AUTENTICADA ---
@router.get("", response_model=ProductList)
def list_products(
    q: Optional[str] = Query(None, description="Búsqueda simple en nombre/descripcion"),
    category: Optional[str] = Query(None),
    career: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    cursor: Optional[str] = Query(None, description="ISO datetime para paginación"),
    user=Depends(get_current_user),
):
    restrict_to = visible_careers_for(user["uid"])
    items, next_cursor = repo.list_products(
        q=q, category=category, career=career, limit=limit, cursor_iso=cursor,
        restrict_to_careers=restrict_to if career is None else None,
    )
    return {"items": items, "next_cursor": next_cursor}

# --- DETALLE AUTENTICADO ---
@router.get("/{prod_id}", response_model=ProductOut, tags=["public"])
def get_product(prod_id: str):
    p = repo.get_product(prod_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return p

# --- CREAR JSON (ya lo tenías) ---
@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, user=Depends(get_current_user)):
    can_manage_career_or_403(user["uid"], payload.career)
    created = repo.create_product(payload.dict(), uid=user["uid"])
    # RAG Sync
    sync_product_to_rag(created)
    return created

# --- CREAR con FORM-DATA + archivo (NUEVO) ---
@router.post("/form", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product_form(
    name: str = Form(...),
    price: float = Form(...),
    category: str = Form(...),
    career: str = Form(...),
    stock: int = Form(0),
    description: Optional[str] = Form(""),
    # si te mandan una URL directa, la respetamos; si mandan archivo, subimos y la reemplazamos:
    image_url: Optional[str] = Form(None),
    convert_webp: bool = Form(True),
    image_file: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
):
    can_manage_career_or_403(user["uid"], career)

    # Si llega archivo → subir y obtener URL
    final_image = image_url or ""
    if image_file is not None:
        final_image = await upload_image_and_get_url(image_file, convert_webp=convert_webp)

    payload = {
        "name": name,
        "description": description or "",
        "price": price,
        "category": category,
        "career": career,
        "stock": stock,
        "image": final_image,
    }
    created = repo.create_product(payload, uid=user["uid"])
    # RAG Sync
    sync_product_to_rag(created)
    return created

# --- ACTUALIZAR JSON (ya lo tenías) ---
@router.put("/{prod_id}", response_model=ProductOut)
def update_product(prod_id: str, payload: ProductUpdate, user=Depends(get_current_user)):
    current = repo.get_product(prod_id)
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    target_career = payload.career or current["career"]
    can_manage_career_or_403(user["uid"], target_career)
    updated = repo.update_product(prod_id, payload.dict(exclude_unset=True))
    assert updated is not None
    # RAG Sync
    sync_product_to_rag(updated)
    return updated

# --- ACTUALIZAR con FORM-DATA + archivo (NUEVO) ---
@router.put("/{prod_id}/form", response_model=ProductOut)
async def update_product_form(
    prod_id: str,
    name: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    category: Optional[str] = Form(None),
    career: Optional[str] = Form(None),
    stock: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    convert_webp: bool = Form(True),
    image_file: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
):
    current = repo.get_product(prod_id)
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    target_career = career or current["career"]
    can_manage_career_or_403(user["uid"], target_career)

    final_image = image_url  # si mandan URL directa, la usamos
    if image_file is not None:
        final_image = await upload_image_and_get_url(image_file, convert_webp=convert_webp)

    update_payload = {
        "name": name,
        "description": description,
        "price": price,
        "category": category,
        "career": career,
        "stock": stock,
        # Solo setear 'image' si se envió url o archivo
        **({"image": final_image} if final_image is not None else {}),
    }

    updated = repo.update_product(prod_id, update_payload)
    assert updated is not None
    # RAG Sync
    sync_product_to_rag(updated)
    return updated

# DELETE /api/products/{id}
@router.delete("/{prod_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(prod_id: str, user=Depends(get_current_user)):
    current = repo.get_product(prod_id)
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    can_manage_career_or_403(user["uid"], current["career"])
    ok = repo.delete_product(prod_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    # RAG Sync
    delete_product_from_rag(prod_id)
    return

# --- FORCE SYNC (ADMIN TOOL) ---
@router.post("/force-rag-sync", tags=["admin"])
def force_rag_sync():
    """
    Recorre TODOS los productos y regenera sus embeddings en Supabase.
    Puede tardar si hay muchos productos.
    """
    count = 0
    for product in repo.iter_all_products():
        sync_product_to_rag(product)
        count += 1
    return {"status": "ok", "synced_count": count}