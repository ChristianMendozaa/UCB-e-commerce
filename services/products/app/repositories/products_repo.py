# app/repositories/products_repo.py
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter, Or, And, BaseCompositeFilter

from app.core.firebase import firestore_db

_COLLECTION = "products"

def _now() -> datetime:
    # Firestore Admin acepta aware/naive; usamos UTC naive para uniformidad
    return datetime.utcnow()

def _doc_to_out(doc) -> Dict[str, Any]:
    data = doc.to_dict() or {}
    data["id"] = doc.id
    # normalizamos timestamps
    data["createdAt"] = data.get("createdAt")
    data["updatedAt"] = data.get("updatedAt")
    return data

def create_product(payload: Dict[str, Any], uid: str) -> Dict[str, Any]:
    ts = _now()
    payload = {
        **payload,
        "createdAt": ts,
        "updatedAt": ts,
        "createdBy": uid,
    }
    ref = firestore_db.collection(_COLLECTION).document()
    ref.set(payload)
    return {**payload, "id": ref.id}

def get_product(prod_id: str) -> Optional[Dict[str, Any]]:
    doc = firestore_db.collection(_COLLECTION).document(prod_id).get()
    if not doc.exists:
        return None
    return _doc_to_out(doc)

def update_product(prod_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    doc_ref = firestore_db.collection(_COLLECTION).document(prod_id)
    doc = doc_ref.get()
    if not doc.exists:
        return None
    update = {k: v for (k, v) in payload.items() if v is not None}
    if not update:
        # nada que actualizar
        return _doc_to_out(doc)
    update["updatedAt"] = _now()
    doc_ref.set(update, merge=True)
    return _doc_to_out(doc_ref.get())

def delete_product(prod_id: str) -> bool:
    doc_ref = firestore_db.collection(_COLLECTION).document(prod_id)
    if not doc_ref.get().exists:
        return False
    doc_ref.delete()
    return True

def list_products(
    q: Optional[str],
    category: Optional[str],
    career: Optional[str],
    limit: int = 50,
    cursor_iso: Optional[str] = None,
    restrict_to_careers: Optional[List[str]] = None,  # si se provee, filtra a estas carreras
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    # construimos query
    qry = firestore_db.collection(_COLLECTION).order_by("createdAt", direction="DESCENDING")

    if category:
        qry = qry.where(filter=FieldFilter("category", "==", category))

    # career: si llega explícita, prioriza; si no, y existe restricción, usamos IN sobre lista
    if career:
        qry = qry.where(filter=FieldFilter("career", "==", career))
    elif restrict_to_careers:
        # Firestore soporta "in" hasta 30 elementos
        if len(restrict_to_careers) == 1:
            qry = qry.where(filter=FieldFilter("career", "==", restrict_to_careers[0]))
        else:
            qry = qry.where(filter=FieldFilter("career", "in", restrict_to_careers[:30]))

    if cursor_iso:
        try:
            start_after = datetime.fromisoformat(cursor_iso)
            qry = qry.start_after({"createdAt": start_after})
        except Exception:
            pass

    # Nota: filtro de texto simple en cliente; en Firestore puro usarías búsquedas compuestas o un índice externo
    docs = qry.limit(limit).stream()
    results = []
    for d in docs:
        item = _doc_to_out(d)
        if q:
            text = f"{item.get('name','')} {item.get('description','')}".lower()
            if q.lower() not in text:
                continue
        results.append(item)

    next_cursor = results[-1]["createdAt"].isoformat() if results else None
    return results, next_cursor

def iter_all_products():
    """Generador que devuelve todos los productos de la colección."""
    docs = firestore_db.collection(_COLLECTION).stream()
    for d in docs:
        yield _doc_to_out(d)
