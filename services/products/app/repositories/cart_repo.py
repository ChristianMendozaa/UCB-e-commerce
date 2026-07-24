from typing import Dict, Any, List
from datetime import datetime
from app.core.firebase import firestore_db

_COLLECTION = "carts"

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

def add_item(uid: str, product_id: str, quantity: int) -> Dict[str, Any]:
    """Adds quantity to existing item or creates new one."""
    ref = firestore_db.collection(_COLLECTION).document(uid)
    doc = ref.get()
    
    if not doc.exists:
        current_items = {}
    else:
        current_items = doc.to_dict().get("items", {})
    
    current_qty = current_items.get(product_id, 0)
    new_qty = current_qty + quantity
    
    if new_qty <= 0:
        if product_id in current_items:
            del current_items[product_id]
    else:
        current_items[product_id] = new_qty
    
    payload = {
        "userId": uid,
        "items": current_items,
        "updatedAt": _now()
    }
    
    if not doc.exists:
        ref.set(payload)
    else:
        ref.update(payload)
        
    return get_cart(uid)

def update_item_quantity(uid: str, product_id: str, quantity: int) -> Dict[str, Any]:
    """Sets the exact quantity of an item."""
    ref = firestore_db.collection(_COLLECTION).document(uid)
    doc = ref.get()
    
    if not doc.exists:
        current_items = {}
    else:
        current_items = doc.to_dict().get("items", {})
        
    if quantity <= 0:
        if product_id in current_items:
            del current_items[product_id]
    else:
        current_items[product_id] = quantity
        
    payload = {
        "userId": uid,
        "items": current_items,
        "updatedAt": _now()
    }
    
    if not doc.exists:
        ref.set(payload)
    else:
        ref.update(payload)
        
    return get_cart(uid)

def remove_item(uid: str, product_id: str) -> Dict[str, Any]:
    ref = firestore_db.collection(_COLLECTION).document(uid)
    doc = ref.get()
    
    if not doc.exists:
        return get_cart(uid)
    
    current_items = doc.to_dict().get("items", {})
    if product_id in current_items:
        del current_items[product_id]
        payload = {
            "items": current_items,
            "updatedAt": _now()
        }
        ref.update(payload)
        
    return get_cart(uid)

def clear_cart(uid: str) -> Dict[str, Any]:
    firestore_db.collection(_COLLECTION).document(uid).delete()
    return {"userId": uid, "items": []}
