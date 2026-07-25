import os
import sys
from types import ModuleType
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

# Valores exclusivamente de prueba. Evitan leer o usar credenciales locales.
os.environ["OPENAI_API_KEY"] = "test-openai-key"
os.environ["INTERNAL_API_TOKEN"] = "test-internal-token"
os.environ["FIREBASE_PROJECT_ID"] = "test-project"
os.environ["FIREBASE_TYPE"] = "service_account"
os.environ["FIREBASE_PRIVATE_KEY_ID"] = "test-private-key-id"
os.environ["FIREBASE_PRIVATE_KEY"] = "test-private-key"
os.environ["FIREBASE_CLIENT_EMAIL"] = "test@example.test"
os.environ["FIREBASE_CLIENT_ID"] = "test-client-id"
os.environ["FIREBASE_AUTH_URI"] = "https://example.test/auth"
os.environ["FIREBASE_TOKEN_URI"] = "https://example.test/token"
os.environ["FIREBASE_AUTH_PROVIDER_X509_CERT_URL"] = "https://example.test/certs"
os.environ["FIREBASE_CLIENT_X509_CERT_URL"] = "https://example.test/client-cert"
os.environ["FIREBASE_UNIVERSE_DOMAIN"] = "googleapis.com"

# Unit tests replace this placeholder with an in-memory Firestore. This avoids
# initializing Firebase Admin or contacting a real project during test import.
fake_firebase_module = ModuleType("app.core.firebase")
fake_firebase_module.firestore_db = object()
sys.modules["app.core.firebase"] = fake_firebase_module
