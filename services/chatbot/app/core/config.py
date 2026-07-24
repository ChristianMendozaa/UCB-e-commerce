import os
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI
from groq import Groq

load_dotenv()

# ============ CONFIG ===============

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

PRODUCTS_API_URL = os.getenv("PRODUCTS_API_URL", "http://localhost:8000")
ORDERS_API_URL = os.getenv("ORDERS_API_URL", "http://localhost:8001")

if not (OPENAI_API_KEY and GROQ_API_KEY and SUPABASE_URL and SUPABASE_SERVICE_ROLE):
    raise RuntimeError("Faltan variables en el .env")

openai_client = OpenAI(api_key=OPENAI_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

# Parámetros simples de RAG
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MAX_CHUNKS = 200
EMBEDDING_DIM = 1536
