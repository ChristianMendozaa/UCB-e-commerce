from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timezone

from google.cloud import firestore as gcf  # 👈 FIX: para usar Query.DESCENDING

from app.core.firebase import firestore_db
from app.deps.auth import get_current_user
from app.deps.permissions import visible_careers_for  # can_manage_career_or_403 no se usa aquí

from app.schemas.orders import (
    CreateOrderIn, OrderOut, OrderItemOut, UpdateStatusIn
)

router = APIRouter(prefix="/orders", tags=["orders"])

# ---------- Helpers ----------

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _doc_to_order_out(doc) -> OrderOut:
    d = doc.to_dict() or {}
    return OrderOut(
        id=doc.id,
        userId=d["userId"],
        items=[OrderItemOut(**it) for it in d.get("items", [])],
        total=float(d.get("total", 0)),
        status=d.get("status", "pending"),
        createdAt=d.get("createdAt").replace(tzinfo=timezone.utc) if d.get("createdAt") else _now_utc(),
        updatedAt=d.get("updatedAt").replace(tzinfo=timezone.utc) if d.get("updatedAt") else _now_utc(),
    )

def _load_product(pid: str) -> Optional[Dict[str, Any]]:
    doc = firestore_db.collection("products").document(pid).get()
    if not doc.exists:
        return None
    d = doc.to_dict() or {}
    # campos esperados: name, price (float), stock (int), career (str)
    return {"id": doc.id, **d}

# ---------- Endpoints cliente ----------

@router.get("/me", response_model=List[OrderOut])
def list_my_orders(
    user=Depends(get_current_user),
    status_filter: Optional[str] = Query(None, description="pending|confirmed|shipped|delivered"),
    limit: int = Query(50, ge=1, le=200),
):
    """Lista pedidos del usuario autenticado (cliente)."""
    q = (
        firestore_db.collection("orders")
        .where("userId", "==", user["uid"])
        .order_by("createdAt", direction=gcf.Query.DESCENDING)  # 👈 FIX
        .limit(limit)
    )
    docs = q.stream()
    out: List[OrderOut] = []
    for doc in docs:
        data = doc.to_dict() or {}
        if status_filter and data.get("status") != status_filter:
            continue
        out.append(_doc_to_order_out(doc))
    return out

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _doc_to_order_out(doc) -> OrderOut:
    d = doc.to_dict() or {}
    return OrderOut(
        id=doc.id,
        userId=d["userId"],
        items=[OrderItemOut(**it) for it in d.get("items", [])],
        total=float(d.get("total", 0)),
        status=d.get("status", "pending"),
        createdAt=d.get("createdAt").replace(tzinfo=timezone.utc) if d.get("createdAt") else _now_utc(),
        updatedAt=d.get("updatedAt").replace(tzinfo=timezone.utc) if d.get("updatedAt") else _now_utc(),
    )

def _safe_prod_ref(product_id: str):
    pid = str(product_id or "").strip()
    if not pid or "/" in pid:
        raise HTTPException(status_code=400, detail="productId inválido.")
    # usar document(path absoluto) para evitar ambigüedad
    return firestore_db.document(f"products/{pid}")

def _load_product(pid: str) -> Optional[Dict[str, Any]]:
    # lectura fuera de TX para prevalidación
    ref = _safe_prod_ref(pid)
    doc = ref.get()
    if not doc.exists:
        return None
    d = doc.to_dict() or {}
    return {"id": doc.id, **d}

@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: CreateOrderIn, user=Depends(get_current_user)):
    # 1) Fetch cart from Firestore
    cart_ref = firestore_db.collection("carts").document(user["uid"])
    cart_doc = cart_ref.get()
    
    items_map = {}
    if cart_doc.exists:
        items_map = cart_doc.to_dict().get("items", {})
        
    if not items_map:
        raise HTTPException(status_code=400, detail="Carrito vacío.")

    # Convert map to list of objects for processing
    class ItemObj:
        def __init__(self, pid, qty):
            self.productId = pid
            self.quantity = qty
            
    cart_items = [ItemObj(pid, qty) for pid, qty in items_map.items()]

    products_cache: Dict[str, Dict[str, Any]] = {}
    total = 0.0
    career_tags: Set[str] = set()

    # 2) Prevalidación: existencia, stock y total
    for it in cart_items:
        prod = _load_product(it.productId)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto {it.productId} no existe.")
        if int(prod.get("stock", 0)) < it.quantity:
            raise HTTPException(status_code=409, detail=f"Stock insuficiente para {prod.get('name','producto')}.")
        products_cache[it.productId] = prod
        total += float(prod.get("price", 0)) * it.quantity
        if prod.get("career"):
            career_tags.add(str(prod["career"]))

    now = _now_utc()

    @gcf.transactional
    def _tx_create(tx: gcf.Transaction):
        # 3) Operaciones atómicas dentro de la TX
        snapshots = []
        for it in cart_items:
            p_ref = _safe_prod_ref(it.productId)
            snap = p_ref.get(transaction=tx)
            snapshots.append((snap, it, p_ref))
        
        # Validar y encolar updates de stock
        for snap, it, p_ref in snapshots:
            if not snap.exists:
                raise HTTPException(status_code=404, detail=f"Producto {it.productId} no existe.")
            current = int((snap.to_dict() or {}).get("stock", 0))
            if current < it.quantity:
                raise HTTPException(status_code=409, detail="Stock cambió; no disponible.")
            tx.update(p_ref, {"stock": current - it.quantity})

        # 4) Crear el pedido
        order_ref = firestore_db.collection("orders").document()
        order_payload = {
            "userId": user["uid"],
            "items": [
                {
                    "productId": it.productId,
                    "quantity": it.quantity,
                    "price": float(products_cache[it.productId]["price"]),
                }
                for it in cart_items
            ],
            "total": float(total),
            "status": "pending",
            "career_tags": sorted(list(career_tags)),
            "createdAt": now,
            "updatedAt": now,
        }
        tx.set(order_ref, order_payload)
        
        # 5) Limpiar carrito (dentro de la transacción)
        tx.delete(cart_ref)
        
        return order_ref

    # ejecutar transacción
    tx = firestore_db.transaction()
    order_ref = _tx_create(tx)

    created = order_ref.get()
    return _doc_to_order_out(created)
# ---------- Endpoints admin ----------

@router.get("", response_model=List[OrderOut])
def list_orders_admin(
    user=Depends(get_current_user),
    status_filter: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=200),
):
    """
    Lista pedidos visibles para un admin:
    - platform_admin: ve todos.
    - admin: solo pedidos con products de SU(S) carrera(s) (usando career_tags).
    - no-admin: retorna 403.
    """
    careers = visible_careers_for(user["uid"])  # [] si platform_admin (=> no limitar) o si student

    # Leemos roles desde la colección real:
    roles_doc = firestore_db.collection("roles").document(user["uid"]).get()
    rdata = roles_doc.to_dict() or {}
    is_platform_admin = bool(rdata.get("platform_admin", False))
    is_admin = "admin" in (rdata.get("roles") or [])

    if not is_platform_admin and not is_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden listar pedidos globales.")

    q = firestore_db.collection("orders")
    if not is_platform_admin:
        # limitar por carrera_tags
        if len(careers) == 0:
            # admin sin carreras asignadas => nada
            return []
        # Firestore: array-contains-any admite máx 10 valores; asumimos pocas carreras
        q = q.where("career_tags", "array_contains_any", careers)

    q = q.order_by("createdAt", direction=gcf.Query.DESCENDING).limit(limit)  # 👈 FIX
    docs = q.stream()

    out: List[OrderOut] = []
    for d in docs:
        data = d.to_dict() or {}
        if status_filter and data.get("status") != status_filter:
            continue
        out.append(_doc_to_order_out(d))
    return out

@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, user=Depends(get_current_user)):
    """Devuelve un pedido si el usuario es dueño o el admin tiene visibilidad por carrera."""
    doc = firestore_db.collection("orders").document(order_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    data = doc.to_dict() or {}

    # dueño
    if data.get("userId") == user["uid"]:
        return _doc_to_order_out(doc)

    # admin autorizado por carrera
    roles_doc = firestore_db.collection("roles").document(user["uid"]).get()
    rdata = roles_doc.to_dict() or {}
    if bool(rdata.get("platform_admin", False)):
        return _doc_to_order_out(doc)

    if "admin" in (rdata.get("roles") or []):
        careers_allowed = set(rdata.get("admin_careers") or [])
        career_tags = set(data.get("career_tags") or [])
        if careers_allowed & career_tags:
            return _doc_to_order_out(doc)

    raise HTTPException(status_code=403, detail="Sin permiso para ver este pedido.")

@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(order_id: str, body: UpdateStatusIn, user=Depends(get_current_user)):
    """
    Cambia el estado del pedido. Solo admins con acceso a la(s) carrera(s) del pedido
    (o platform_admin). Students/owners no cambian estado.
    """
    ref = firestore_db.collection("orders").document(order_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    data = snap.to_dict() or {}
    order_careers = set(data.get("career_tags") or [])

    # permisos
    roles_doc = firestore_db.collection("roles").document(user["uid"]).get()
    rdata = roles_doc.to_dict() or {}
    if not rdata:
        raise HTTPException(status_code=403, detail="Sin permisos.")
    is_platform_admin = bool(rdata.get("platform_admin", False))
    if not is_platform_admin:
        if "admin" not in (rdata.get("roles") or []):
            raise HTTPException(status_code=403, detail="Solo administradores.")
        admin_careers = set(rdata.get("admin_careers") or [])
        if not (admin_careers & order_careers):
            raise HTTPException(status_code=403, detail="No administras la carrera de este pedido.")

    new_status = body.status
    now = _now_utc()
    ref.update({"status": new_status, "updatedAt": now})
    return _doc_to_order_out(ref.get())
