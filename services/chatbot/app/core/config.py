import os

from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI
from supabase import Client, create_client

load_dotenv()


def _positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default))
    try:
        value = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"{name} debe ser un entero.") from exc
    if value <= 0:
        raise RuntimeError(f"{name} debe ser mayor a cero.")
    return value


def _non_negative_float(name: str, default: float = 0.0) -> float:
    raw_value = os.getenv(name, str(default))
    try:
        value = float(raw_value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"{name} debe ser un número.") from exc
    if value < 0:
        raise RuntimeError(f"{name} no puede ser negativo.")
    return value


def _reasoning_effort(name: str, default: str) -> str:
    value = os.getenv(name, default).strip().lower()
    supported_values = {"none", "low", "medium", "high", "xhigh", "max"}
    if value not in supported_values:
        supported = ", ".join(sorted(supported_values))
        raise RuntimeError(f"{name} debe ser uno de: {supported}.")
    return value


def _boolean(name: str, default: bool) -> bool:
    raw_value = os.getenv(name, str(default)).strip().lower()
    if raw_value in {"1", "true", "yes", "on"}:
        return True
    if raw_value in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} debe ser true o false.")


def cors_credentials_allowed(origins: list[str], configured: bool) -> bool:
    return configured and "*" not in origins


# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-5.6-terra")
OPENAI_REASONING_EFFORT = _reasoning_effort("OPENAI_REASONING_EFFORT", "low")
OPENAI_MAX_OUTPUT_TOKENS = _positive_int("OPENAI_MAX_OUTPUT_TOKENS", 1500)
OPENAI_INPUT_PRICE_PER_M = _non_negative_float("OPENAI_INPUT_PRICE_PER_M", 2.50)
OPENAI_CACHED_INPUT_PRICE_PER_M = _non_negative_float(
    "OPENAI_CACHED_INPUT_PRICE_PER_M",
    0.25,
)
OPENAI_OUTPUT_PRICE_PER_M = _non_negative_float("OPENAI_OUTPUT_PRICE_PER_M", 15.00)

# Servicios
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
PRODUCTS_API_URL = os.getenv(
    "PRODUCTS_API_URL",
    "http://localhost:8000",
).rstrip("/")
ORDERS_API_URL = os.getenv(
    "ORDERS_API_URL",
    "http://localhost:8001",
).rstrip("/")
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "__session")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "https://ucb-e-commerce.vercel.app,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = _boolean("CORS_ALLOW_CREDENTIALS", True)
CORS_ALLOW_CREDENTIALS = cors_credentials_allowed(
    ALLOWED_ORIGINS,
    CORS_ALLOW_CREDENTIALS,
)

missing_variables = [
    name
    for name, value in (
        ("OPENAI_API_KEY", OPENAI_API_KEY),
        ("SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE),
    )
    if not value
]
if missing_variables:
    raise RuntimeError(
        "Faltan variables de entorno requeridas: " + ", ".join(missing_variables)
    )

# El cliente asíncrono atiende el agente; el síncrono conserva el RAG existente.
# Los retries del agente se controlan explícitamente en agent_service.
openai_async_client = AsyncOpenAI(api_key=OPENAI_API_KEY, max_retries=0)
openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

# Parámetros de RAG. text-embedding-3-small produce vectores de 1536 dimensiones.
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MAX_CHUNKS = 200
EMBEDDING_DIM = 1536
