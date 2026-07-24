# config.py
import os

from dotenv import load_dotenv

load_dotenv()


def _positive_int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a positive integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer")
    return value


ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = "*" not in ALLOWED_ORIGINS

# Nombre de la colección donde guardamos las imágenes
FIREBASE_COLLECTION = os.getenv("FIREBASE_COLLECTION", "images")

# Límite duro del archivo original antes de procesarlo
MAX_ORIGINAL_IMAGE_BYTES = 4 * 1024 * 1024

# Firestore caps a document at 1 MiB. Reserve 64 KiB for field names,
# metadata, and document encoding rather than allowing Base64 to consume it.
FIRESTORE_DOCUMENT_MAX_BYTES = 1 * 1024 * 1024
FIRESTORE_DOCUMENT_SAFETY_MARGIN_BYTES = 64 * 1024
MAX_SAFE_B64_BYTES = (
    FIRESTORE_DOCUMENT_MAX_BYTES - FIRESTORE_DOCUMENT_SAFETY_MARGIN_BYTES
)
MAX_B64_BYTES = min(
    _positive_int_env("MAX_B64_BYTES", MAX_SAFE_B64_BYTES),
    MAX_SAFE_B64_BYTES,
)

# Decode limits protect Pillow from oversized image dimensions/decompression.
MAX_IMAGE_WIDTH = _positive_int_env("MAX_IMAGE_WIDTH", 8192)
MAX_IMAGE_HEIGHT = _positive_int_env("MAX_IMAGE_HEIGHT", 8192)
MAX_IMAGE_PIXELS = _positive_int_env("MAX_IMAGE_PIXELS", 25_000_000)
