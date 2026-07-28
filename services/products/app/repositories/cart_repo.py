from typing import Dict, Any, List, Optional
from datetime import datetime
from google.cloud import firestore as gcf
from app.core.firebase import firestore_db
from app.services.idempotency import command_receipt_id

_COLLECTION = "carts"
_RECEIPT_COLLECTION = "cart_command_receipts"


class CartValidationError(ValueError):
    pass

def _now() -> datetime:
    return datetime.utcnow()

from app.repositories import products_repo

def get_cart(uid: str) -> Dict[str, Any]:
    doc = firestore_db.collection(_COLLECTION).document(uid).get()
    if not doc.exists:
        return {"userId": uid, "items": []}
    
    data = doc.to_dict()
    items_map = data.get("items", {})
    # Convert {pid: qty} to list (Simple version for Frontend)
    items_list = [{"productId": k, "quantity": v} for k, v in items_map.items()]
    
    return {
        "userId": uid,
        "items": items_list,
        "updatedAt": data.get("updatedAt")
    }

def get_cart_enriched(uid: str) -> Dict[str, Any]:
    """Cart with product details for Chatbot (No images)"""
    doc = firestore_db.collection(_COLLECTION).document(uid).get()
    if not doc.exists:
        return {"userId": uid, "items": []}
    
    data = doc.to_dict()
    items_map = data.get("items", {})
    
    items_list = []
    for pid, qty in items_map.items():
        item_data = {"productId": pid, "quantity": qty}
        # Enrich with product details
        product = products_repo.get_product(pid)
        
        if product:
            item_data["name"] = product.get("name", f"Unknown Name ({pid})")
            item_data["price"] = product.get("price", 0)
            item_data["description"] = product.get("description", "")
            # item_data["image"] = product.get("image", "") # Omit image for chatbot
        else:
             item_data["name"] = f"Unknown Product ({pid}) "
             item_data["price"] = 0
             
        items_list.append(item_data)
    
    return {
        "userId": uid,
        "items": items_list,
        "updatedAt": data.get("updatedAt")
    }

def get_cart_frontend(uid: str) -> Dict[str, Any]:
    """Cart with FULL product details for Frontend (Images, Stock, etc.)"""
    doc = firestore_db.collection(_COLLECTION).document(uid).get()
    if not doc.exists:
        return {"userId": uid, "items": []}
    
    data = doc.to_dict()
    items_map = data.get("items", {})
    
    items_list = []
    for pid, qty in items_map.items():
        item_data = {"productId": pid, "quantity": qty}
        # Enrich with full product details
        product = products_repo.get_product(pid)
        
        if product:
            item_data["name"] = product.get("name", "Unknown Product")
            item_data["price"] = product.get("price", 0)
            item_data["description"] = product.get("description", "")
            item_data["image"] = product.get("image", "")
            item_data["category"] = product.get("category", "")
            item_data["career"] = product.get("career", "")
            item_data["stock"] = product.get("stock", 0)
        else:
             item_data["name"] = "Unknown Product"
             item_data["price"] = 0
             
        items_list.append(item_data)
    
    return {
        "userId": uid,
        "items": items_list,
        "updatedAt": data.get("updatedAt")
    }

def _mutate_cart(
    uid: str,
    *,
    operation: str,
    product_id: Optional[str] = None,
    quantity: Optional[int] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    cart_ref = firestore_db.collection(_COLLECTION).document(uid)
    receipt_ref = (
        firestore_db.collection(_RECEIPT_COLLECTION).document(
            command_receipt_id(uid, idempotency_key)
        )
        if idempotency_key
        else None
    )
    product_ref = (
        firestore_db.collection("products").document(product_id)
        if product_id and operation in {"add", "set"}
        else None
    )

    @gcf.transactional
    def apply(transaction: gcf.Transaction):
        receipt = receipt_ref.get(transaction=transaction) if receipt_ref else None
        if receipt is not None and receipt.exists:
            return

        cart_snapshot = cart_ref.get(transaction=transaction)
        product_snapshot = (
            product_ref.get(transaction=transaction) if product_ref else None
        )
        items = dict(
            ((cart_snapshot.to_dict() or {}).get("items", {}))
            if cart_snapshot.exists
            else {}
        )

        if operation in {"add", "set"}:
            if product_snapshot is None or not product_snapshot.exists:
                raise CartValidationError("Producto no encontrado.")
            if not isinstance(quantity, int) or isinstance(quantity, bool):
                raise CartValidationError("Cantidad inválida.")
            product = product_snapshot.to_dict() or {}
            next_quantity = (
                int(items.get(product_id, 0)) + quantity
                if operation == "add"
                else quantity
            )
            if next_quantity < 1 or next_quantity > 20:
                raise CartValidationError("La cantidad debe estar entre 1 y 20.")
            if next_quantity > int(product.get("stock", 0)):
                raise CartValidationError("Stock insuficiente.")
            items[product_id] = next_quantity
        elif operation == "remove":
            items.pop(product_id, None)
        elif operation == "clear":
            items.clear()
        else:
            raise CartValidationError("Operación de carrito desconocida.")

        if items:
            transaction.set(
                cart_ref,
                {
                    "userId": uid,
                    "items": items,
                    "updatedAt": _now(),
                },
            )
        else:
            transaction.delete(cart_ref)
        if receipt_ref:
            transaction.set(
                receipt_ref,
                {
                    "userId": uid,
                    "operation": operation,
                    "createdAt": _now(),
                },
            )

    apply(firestore_db.transaction())
    return get_cart(uid)


def add_item(
    uid: str,
    product_id: str,
    quantity: int,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    return _mutate_cart(
        uid,
        operation="add",
        product_id=product_id,
        quantity=quantity,
        idempotency_key=idempotency_key,
    )


def update_item_quantity(
    uid: str,
    product_id: str,
    quantity: int,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    return _mutate_cart(
        uid,
        operation="set",
        product_id=product_id,
        quantity=quantity,
        idempotency_key=idempotency_key,
    )


def remove_item(
    uid: str,
    product_id: str,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    return _mutate_cart(
        uid,
        operation="remove",
        product_id=product_id,
        idempotency_key=idempotency_key,
    )


def clear_cart(
    uid: str,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    return _mutate_cart(
        uid,
        operation="clear",
        idempotency_key=idempotency_key,
    )
