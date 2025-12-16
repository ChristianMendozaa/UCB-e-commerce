import asyncio
import json
import logging
import re
from typing import Dict, Any, List, Optional
from app.core.config import groq_client
from app.core.tools import (
    rag_search_tool,
    add_to_cart_tool,
    remove_from_cart_tool,
    clear_cart_tool,
    create_order_tool,
    clear_cart_tool,
    create_order_tool,
    navigate_tool,
    get_cart_tool
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# --- Tool Definitions (Schema for Native Tool Calling) ---
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "rag_search_tool",
            "description": "Busca info de productos/UCB. Usa precios/stock del resultado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Consulta de búsqueda"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_cart_tool",
            "description": "Obtiene los productos actuales en el carrito.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_to_cart_tool",
            "description": "Agrega producto al carrito. ID obligatorio.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "ID del producto (alfanumérico)"},
                    "quantity": {"type": "integer", "description": "Cantidad (default 1)"}
                },
                "required": ["product_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remove_from_cart_tool",
            "description": "Elimina producto del carrito.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "ID del producto"}
                },
                "required": ["product_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "clear_cart_tool",
            "description": "Vacía el carrito.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_order_tool",
            "description": "Crea pedido con items del carrito.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "navigate_tool",
            "description": "Redirige al usuario. Usa rutas como '/catalog', '/cart' o un ID de producto.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Ruta (ej: '/catalog') o ID de producto"}
                },
                "required": ["target"]
            }
        }
    }
]

SYSTEM_PROMPT = """
Eres el asistente de UCB Commerce. Ayuda a buscar productos, gestionar carrito y pedidos.

REGLAS:
- **IDIOMA**: Responde SIEMPRE en el idioma del usuario. Si te hablan en inglés, responde en inglés.
- **MONEDA**: Todos los precios están en Bolivianos (Bs.).
- **RAZONAMIENTO**: Antes de usar herramientas, piensa brevemente qué necesitas hacer.
- IDs son cadenas (ej: "ne8jwGSSjCqzPXRLzq8r").
- **NUNCA pidas ID**. Búscalo tú con `rag_search_tool`.
- **NAVEGACIÓN**: 
    - Productos: Si piden "ver X", busca ID -> `navigate_tool(ID)`.
    - General: 
        * "Inicio" -> `navigate_tool('/')`
        * "Catálogo" -> `navigate_tool('/catalog')`
        * "Carreras" o "Por carrera" -> `navigate_tool('/careers')`
        * "Mis pedidos" -> `navigate_tool('/orders')`
- **CONTEXTO**: Si piden "Mochila" y tienes ID de "Hoodie", ¡BUSCA EL NUEVO ID! No recicles.
- **COMPRA**: "Quiero comprar X" => `add_to_cart_tool` + `create_order_tool`.
- **CARRITO**: Si preguntan "qué tengo en el carrito", usa `get_cart_tool`.
- **PROACTIVIDAD**: Ofrece agregar al carrito.
"""

async def run_agent(question: str, cookies: Dict[str, str] = None, history: List[Dict[str, str]] = [], current_page: str = "/") -> Dict[str, Any]:
    """
    Ejecuta el agente usando Tool Calling Nativo y Ejecución Paralela.
    Retorna respuesta y traza de ejecución.
    """
    # Construir historial previo con contexto de página
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Contexto actual: El usuario está viendo la página '{current_page}'."}
    ]
    
    for msg in history:
        role = "user" if msg.get("sender") == "user" else "assistant"
        content = msg.get("text", "")
        messages.append({"role": role, "content": content})
        
    messages.append({"role": "user", "content": question})

    max_steps = 10
    current_step = 0
    navigation_command = None
    
    # Estructura para el trace del frontend
    agent_trace = []

    # Contadores de costos
    total_input_tokens = 0
    total_output_tokens = 0
    INPUT_PRICE_PER_M = 0.15
    OUTPUT_PRICE_PER_M = 0.60
    
    while current_step < max_steps:
        # 1. Llamar al LLM con tools
        try:
            completion = groq_client.chat.completions.create(
                model="openai/gpt-oss-20b", 
                messages=messages,
                tools=TOOLS_SCHEMA,
                tool_choice="auto",
                temperature=0.1
            )
            
            # Acumular uso de tokens
            if completion.usage:
                total_input_tokens += completion.usage.prompt_tokens
                total_output_tokens += completion.usage.completion_tokens
                
        except Exception as e:
            logger.error(f"Error calling LLM: {e}")
            return {"answer": "Lo siento, hubo un error técnico con mi cerebro digital."}
        
        message = completion.choices[0].message
        messages.append(message)
        
        # Capturar Pensamiento (si existe)
        if message.content:
            agent_trace.append({
                "type": "thought",
                "content": message.content,
                "step": current_step + 1
            })
        
        # 2. Verificar output
        if not message.tool_calls:
            answer = message.content or ""
            if navigation_command and navigation_command not in answer:
                 answer += f"\n{navigation_command}"
            
            # Calcular y loguear costos finales
            total_cost = (total_input_tokens * INPUT_PRICE_PER_M / 1_000_000) + \
                         (total_output_tokens * OUTPUT_PRICE_PER_M / 1_000_000)
            
            logger.info(f"💰 COSTO CONSULTA: ${total_cost:.6f} USD | "
                        f"Inputs: {total_input_tokens} | Outputs: {total_output_tokens}")
            
            return {
                "answer": answer,
                "trace": agent_trace,
                "cost": total_cost 
            }

        # 3. Preparar ejecución paralela
        coroutines = []
        tool_call_mappings = [] # Para mantener el orden y asociación

        for tool_call in message.tool_calls:
            function_name = tool_call.function.name
            try:
                function_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                function_args = {}
            
            # Registrar uso de herramienta en trace
            agent_trace.append({
                "type": "tool_call",
                "name": function_name,
                "args": function_args,
                "step": current_step + 1
            })

            # Agregamos la coroutina a la lista de ejecución
            coroutines.append(execute_tool(function_name, function_args, cookies))
            
            # Guardamos metadatos para reconstruir el mensaje luego
            tool_call_mappings.append({
                "id": tool_call.id,
                "name": function_name
            })

        # 4. Ejecutar todas las herramientas simultáneamente
        results = await asyncio.gather(*coroutines)

        # 5. Procesar resultados y actualizar historial
        for i, result in enumerate(results):
            mapping = tool_call_mappings[i]
            
            # Capturar navegación (si hubo varias, la última gana, o podrías manejar todas)
            if mapping["name"] == "navigate_tool":
                navigation_command = result
            
            # Registrar resultado en trace
            agent_trace.append({
                "type": "tool_result",
                "name": mapping["name"],
                "content": str(result),
                "step": current_step + 1
            })
            
            messages.append({
                "tool_call_id": mapping["id"],
                "role": "tool",
                "name": mapping["name"],
                "content": str(result)
            })
            
        current_step += 1

    return {"answer": "Lo siento, alcancé el límite de pasos.", "trace": agent_trace}

async def execute_tool(name: str, args: Dict[str, Any], cookies: Dict[str, str]) -> str:
    if name == "rag_search_tool":
        return await rag_search_tool(args.get("query"))
    elif name == "get_cart_tool":
        return await get_cart_tool(cookies)
    elif name == "add_to_cart_tool":
        return await add_to_cart_tool(args.get("product_id"), args.get("quantity", 1), cookies)
    elif name == "remove_from_cart_tool":
        return await remove_from_cart_tool(args.get("product_id"), cookies)
    elif name == "clear_cart_tool":
        return await clear_cart_tool(cookies)
    elif name == "create_order_tool":
        return await create_order_tool(cookies)
    elif name == "navigate_tool":
        return navigate_tool(args.get("target"))
    else:
        return f"Error: Herramienta '{name}' no encontrada."
