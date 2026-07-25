import os
import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

# Valores exclusivamente de prueba. Evitan leer o usar credenciales locales.
os.environ["OPENAI_API_KEY"] = "test-openai-key"
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-supabase-key"
os.environ["INTERNAL_API_TOKEN"] = "test-internal-token"
