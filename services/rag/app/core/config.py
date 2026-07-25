import os

from dotenv import load_dotenv
from openai import OpenAI
from supabase import Client, create_client

load_dotenv()

# OpenAI (sólo embeddings; el modelo de chat vive en el servicio chatbot)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Servicios
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN")

missing_variables = [
    name
    for name, value in (
        ("OPENAI_API_KEY", OPENAI_API_KEY),
        ("SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE),
        ("INTERNAL_API_TOKEN", INTERNAL_API_TOKEN),
    )
    if not value
]
if missing_variables:
    raise RuntimeError(
        "Faltan variables de entorno requeridas: " + ", ".join(missing_variables)
    )

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

# Parámetros de RAG. text-embedding-3-small produce vectores de 1536 dimensiones.
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MAX_CHUNKS = 200
EMBEDDING_DIM = 1536
