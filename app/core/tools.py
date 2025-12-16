import httpx
import json
from typing import Dict, Any, List
from app.core.config import PRODUCTS_API_URL, ORDERS_API_URL
from app.services.rag_service import get_answer as rag_search

async def rag_search_tool(query: str) -> str:
    """
    Busca información sobre productos o la universidad usando RAG.
    """
    try:
        # Usamos raw_context_only=True implícito en la nueva lógica para obtener los datos crudos
        # y que el Agente principal (GPT-4/Llama-3) procese la respuesta.
        result = rag_search(query)
        return result["answer"]
    except Exception as e:
        return f"Error buscando información: {str(e)}"

async def get_cart_tool(cookies: Dict[str, str] = None) -> str:
    """
    Obtiene los items actuales del carrito del usuario.
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{PRODUCTS_API_URL}/api/cart/chatbot",
                cookies=cookies
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
                if not items:
                    return "El carrito está vacío."
                
                # Devolvemos los datos crudos (pero legibles) para que el LLM decida cómo presentarlos
                # El usuario pidió explícitamente NO formatear en código.
                summary_items = []
                for item in items:
                    summary_items.append({
                        "product_id": item.get('productId'),
                        "name": item.get('name', 'Producto Desconocido'),
                        "quantity": item.get('quantity', 0),
                        "price": item.get('price', 0),
                        "subtotal": item.get('price', 0) * item.get('quantity', 0),
                        "currency": "Bs."
                    })
                
                return json.dumps(summary_items, ensure_ascii=False)
            return f"Error obteniendo carrito: {resp.text}"
        except Exception as e:
            return f"Error de conexión: {str(e)}"

async def add_to_cart_tool(product_id: str, quantity: int, cookies: Dict[str, str] = None) -> str:
    """
    Agrega un producto al carrito del usuario.
    """
    if not product_id or not product_id.strip():
        return "Error: ID de producto inválido (vacío)."
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{PRODUCTS_API_URL}/api/cart/items",
                json={"productId": product_id.strip(), "quantity": quantity},
                cookies=cookies
            )
            if resp.status_code in [200, 201]:
                return "Producto agregado al carrito exitosamente."
            return f"Error agregando al carrito: {resp.text}"
        except Exception as e:
            return f"Error de conexión: {str(e)}"

async def remove_from_cart_tool(product_id: str, cookies: Dict[str, str] = None) -> str:
    """
    Elimina un producto del carrito.
    """
    if not product_id or not product_id.strip():
        return "Error: ID de producto inválido (vacío)."

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.delete(
                f"{PRODUCTS_API_URL}/api/cart/items/{product_id.strip()}",
                cookies=cookies
            )
            if resp.status_code == 200:
                return "Producto eliminado del carrito."
            return f"Error eliminando del carrito: {resp.text}"
        except Exception as e:
            return f"Error de conexión: {str(e)}"

async def clear_cart_tool(cookies: Dict[str, str] = None) -> str:
    """
    Vacía el carrito de compras.
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.delete(
                f"{PRODUCTS_API_URL}/api/cart",
                cookies=cookies
            )
            if resp.status_code == 200:
                return "Carrito vaciado exitosamente."
            return f"Error vaciando el carrito: {resp.text}"
        except Exception as e:
            return f"Error de conexión: {str(e)}"

async def create_order_tool(cookies: Dict[str, str] = None) -> str:
    """
    Crea un pedido con los items actuales del carrito.
    """
    async with httpx.AsyncClient() as client:
        try:
            # El endpoint de orders espera un body vacío ahora
            resp = await client.post(
                f"{ORDERS_API_URL}/orders",
                json={},
                cookies=cookies
            )
            if resp.status_code in [200, 201]:
                order_data = resp.json()
                return f"Pedido creado exitosamente. ID del pedido: {order_data.get('id')}"
            return f"Error creando el pedido: {resp.text}"
        except Exception as e:
            return f"Error de conexión: {str(e)}"

def navigate_tool(target: str) -> str:
    """
    Genera un comando de navegación para el frontend.
    Puede ser un ID de producto o una ruta relativa (ej: '/catalog').
    """
    if target.startswith("/"):
        url = target
    else:
        url = f"/products/{target}"
        
    return json.dumps({"action": "navigate", "url": url})
