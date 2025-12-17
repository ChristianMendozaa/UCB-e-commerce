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
Eres el vendedor de UCB Commerce (Bs.).

TU OBJETIVO PRINCIPAL: Entender la INTENCIÓN del usuario antes de actuar.

PASOS DE PENSAMIENTO:
1. ¿Qué pide el usuario? ¿Es específico (ej: "Hoodie SIS") o vago (ej: "el hoodie")?
2. Si busca algo, usa `rag_search_tool`.
3. ANALIZA LOS RESULTADOS:
    - ¿Encontraste VARIOS productos? -> ¡PREGUNTA! No asumas cuál quiere. Muestra opciones.
    - ¿Encontraste UNO solo? -> Procede.
4. NUNCA elijas un producto al azar si hay ambigüedad.

EJEMPLOS DE COMPORTAMIENTO:
- Usuario: "Quiero el hoodie"
- Resultados: [Hoodie SIS, Hoodie Civil, Hoodie Cato]
- TU RESPUESTA: "Encontré varios hoodies: SIS, Civil y Cato. ¿Cuál te interesa?" (NO uses navigate_tool aún)

- Usuario: "Ver o mostrame mochila o cualquier intencion de visualizar cierta pagina o producto"
- Resultados: [Mochila Negra]
- TU RESPUESTA: Usar `navigate_tool` para la Mochila Negra.

REGLAS:
- Idioma: Igual al usuario.
- Moneda: Bolivianos (Bs.).
- NO inventes IDs.
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
