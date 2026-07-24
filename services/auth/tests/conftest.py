import sys
from pathlib import Path
from types import ModuleType

AUTH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AUTH_ROOT))

# Importing the auth modules should not initialize a real Firebase application
# during unit tests. The tested functions replace every provider call with mocks.
firebase_module = ModuleType("app.core.firebase")
firebase_module.firestore_db = object()
sys.modules["app.core.firebase"] = firebase_module
