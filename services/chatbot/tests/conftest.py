import os
import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

# Valores exclusivamente de prueba. Evitan leer o usar credenciales locales.
os.environ["OPENAI_API_KEY"] = "test-openai-key"
os.environ["INTERNAL_API_TOKEN"] = "test-internal-token"
os.environ["RAG_API_URL"] = "http://rag.test"
os.environ["OPENAI_CHAT_MODEL"] = "gpt-5.6-terra"
os.environ["OPENAI_REASONING_EFFORT"] = "low"
os.environ["OPENAI_MAX_OUTPUT_TOKENS"] = "1500"
os.environ["OPENAI_INPUT_PRICE_PER_M"] = "2.50"
os.environ["OPENAI_CACHED_INPUT_PRICE_PER_M"] = "0.25"
os.environ["OPENAI_OUTPUT_PRICE_PER_M"] = "15.00"
