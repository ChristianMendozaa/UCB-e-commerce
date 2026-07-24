# Chatbot Service - UCB Commerce

Microservicio FastAPI para el asistente conversacional de UCB Commerce. El
agente usa OpenAI Responses API, herramientas locales y recuperación semántica
en Supabase.

## Arquitectura

- Chat y tool calling: `gpt-5.6-terra`.
- API: OpenAI Responses en modo stateless (`store=False`).
- Razonamiento: configurable, `low` por defecto.
- Embeddings: `text-embedding-3-small`, 1536 dimensiones.
- Base vectorial: Supabase con pgvector.
- Integraciones: Products Service y Orders Service.

El loop conserva todos los elementos de `response.output` y devuelve cada
resultado con su `call_id`. Las lecturas contiguas pueden ejecutarse en
paralelo. Como máximo se ejecuta una acción que modifique estado por ronda, y
el agente debe reevaluar su resultado antes de continuar. Cada consulta está
limitada a 6 pasos.

Las mutaciones requieren una confirmación independiente y vinculada a sus
argumentos: `Confirmo agregar PRODUCT_ID cantidad N` (1–20), `Confirmo quitar
PRODUCT_ID del carrito`, `Confirmo vaciar el carrito` o `Confirmo crear el
pedido`. El ID conserva mayúsculas/minúsculas y cada confirmación se consume
una sola vez, incluso si falla la llamada descendente.

## Endpoints

- `GET /`: estado básico del servicio.
- `GET /health`: liveness check.
- `POST /chat`: conserva el contrato del frontend.
- `POST /upload`: carga texto al índice RAG.

Ejemplo de entrada de `POST /chat`:

```json
{
  "question": "Busca una mochila y agrégala al carrito",
  "history": [
    {"sender": "user", "text": "Hola"},
    {"sender": "bot", "text": "¿En qué te ayudo?"}
  ],
  "current_page": "/catalog"
}
```

La respuesta mantiene:

```json
{
  "answer": "Respuesta para el usuario",
  "trace": [],
  "cost": 0.0
}
```

El trace solo contiene llamadas y resultados sanitizados de herramientas; no
expone razonamiento interno.

## Herramientas

- `rag_search_tool`
- `search_products_tool`
- `get_cart_tool`
- `add_to_cart_tool`
- `remove_from_cart_tool`
- `clear_cart_tool`
- `create_order_tool`
- `navigate_tool`

Las herramientas autenticadas detectan la cookie configurada mediante
`SESSION_COOKIE_NAME`.

## Configuración

Variables requeridas:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Variables opcionales:

- `OPENAI_CHAT_MODEL` (`gpt-5.6-terra` por defecto)
- `OPENAI_REASONING_EFFORT` (`low` por defecto)
- `OPENAI_MAX_OUTPUT_TOKENS` (1500 por defecto)
- `OPENAI_INPUT_PRICE_PER_M`
- `OPENAI_CACHED_INPUT_PRICE_PER_M`
- `OPENAI_OUTPUT_PRICE_PER_M`
- `PRODUCTS_API_URL`
- `ORDERS_API_URL`
- `SESSION_COOKIE_NAME`
- `ALLOWED_ORIGINS`
- `CORS_ALLOW_CREDENTIALS`

Las tarifas pueden sobreescribirse para mantener el campo `cost` alineado con
la cuenta y fecha de despliegue. El cálculo contempla lectura y escritura de
caché de prompts y el multiplicador de contexto largo del modelo configurado.
Si `ALLOWED_ORIGINS` contiene `*`, el servicio fuerza
`CORS_ALLOW_CREDENTIALS=false`.

## Desarrollo

```bash
python -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8004
pytest
```

Las pruebas usan clientes y respuestas simuladas; no realizan llamadas reales a
OpenAI, Supabase, Products ni Orders.
