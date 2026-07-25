import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# OpenAI (only embeddings; the chat model lives in services/chatbot).
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN")

# Firebase service-account credentials.
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_TYPE = os.getenv("FIREBASE_TYPE", "service_account")
FIREBASE_PRIVATE_KEY_ID = os.getenv("FIREBASE_PRIVATE_KEY_ID")
FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")
FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL")
FIREBASE_CLIENT_ID = os.getenv("FIREBASE_CLIENT_ID")
FIREBASE_AUTH_URI = os.getenv("FIREBASE_AUTH_URI")
FIREBASE_TOKEN_URI = os.getenv("FIREBASE_TOKEN_URI")
FIREBASE_AUTH_PROVIDER_X509_CERT_URL = os.getenv(
    "FIREBASE_AUTH_PROVIDER_X509_CERT_URL"
)
FIREBASE_CLIENT_X509_CERT_URL = os.getenv("FIREBASE_CLIENT_X509_CERT_URL")
FIREBASE_UNIVERSE_DOMAIN = os.getenv("FIREBASE_UNIVERSE_DOMAIN")

missing_variables = [
    name
    for name, value in (
        ("OPENAI_API_KEY", OPENAI_API_KEY),
        ("INTERNAL_API_TOKEN", INTERNAL_API_TOKEN),
        ("FIREBASE_PROJECT_ID", FIREBASE_PROJECT_ID),
        ("FIREBASE_PRIVATE_KEY_ID", FIREBASE_PRIVATE_KEY_ID),
        ("FIREBASE_PRIVATE_KEY", FIREBASE_PRIVATE_KEY),
        ("FIREBASE_CLIENT_EMAIL", FIREBASE_CLIENT_EMAIL),
        ("FIREBASE_CLIENT_ID", FIREBASE_CLIENT_ID),
        ("FIREBASE_AUTH_URI", FIREBASE_AUTH_URI),
        ("FIREBASE_TOKEN_URI", FIREBASE_TOKEN_URI),
        (
            "FIREBASE_AUTH_PROVIDER_X509_CERT_URL",
            FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        ),
        ("FIREBASE_CLIENT_X509_CERT_URL", FIREBASE_CLIENT_X509_CERT_URL),
        ("FIREBASE_UNIVERSE_DOMAIN", FIREBASE_UNIVERSE_DOMAIN),
    )
    if not value
]
if missing_variables:
    raise RuntimeError(
        "Faltan variables de entorno requeridas: " + ", ".join(missing_variables)
    )

openai_client = OpenAI(api_key=OPENAI_API_KEY)

# RAG parameters. text-embedding-3-small produces 1536-dimensional vectors.
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MAX_CHUNKS = 200
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
COSINE_DISTANCE_THRESHOLD = 0.7
RAG_CHUNKS_COLLECTION = "rag_chunks"
RAG_SOURCES_COLLECTION = "rag_sources"
PRODUCTS_COLLECTION = "products"
SOURCE_SEGMENT_CHARS = 100_000
