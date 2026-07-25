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

# Originals are downscaled to this long edge (px) before being encoded and
# stored. This does not change MAX_B64_BYTES/MAX_SAFE_B64_BYTES — it changes
# what lands inside that budget, so the WebP-fallback path is rarely needed
# and every stored image is much smaller to read, cache, and resize.
MAX_STORED_IMAGE_EDGE = _positive_int_env("MAX_STORED_IMAGE_EDGE", 1600)

# Threadpool tokens available to the sync path operations (blocking Firestore
# calls + Pillow work run via starlette's run_in_threadpool). Kept modest
# until images are downscaled at upload time (see MAX_STORED_IMAGE_EDGE), so
# a burst of concurrent requests can't hold too many full-size images in
# memory at once.
IMAGE_THREADPOOL_SIZE = _positive_int_env("IMAGE_THREADPOOL_SIZE", 24)

# Allowlisted on-demand resize widths for GET /images/{id}?w=<width>, and the
# byte budget for the in-process LRU cache of rendered variants.
IMAGE_VARIANT_WIDTHS = frozenset(
    int(w)
    for w in os.getenv("IMAGE_VARIANT_WIDTHS", "96,320,640").split(",")
    if w.strip()
)
IMAGE_VARIANT_CACHE_BYTES = _positive_int_env(
    "IMAGE_VARIANT_CACHE_BYTES", 32 * 1024 * 1024
)
