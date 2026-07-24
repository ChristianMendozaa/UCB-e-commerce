import re
from typing import Any
from urllib.parse import unquote, urlsplit

from app.config import IMAGE_PUBLIC_BASE_PATH, LEGACY_IMAGE_HOSTS


_DOCUMENT_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def normalize_public_image_url(value: Any) -> Any:
    """
    Keep historical Firestore records working after the legacy Images
    deployment is retired. Only URLs from explicitly configured legacy hosts
    are rewritten; arbitrary external image URLs are left unchanged.
    """
    if not isinstance(value, str) or not value:
        return value

    try:
        parsed = urlsplit(value)
    except ValueError:
        return value

    if (
        parsed.scheme not in {"http", "https"}
        or (parsed.hostname or "").lower() not in LEGACY_IMAGE_HOSTS
        or parsed.query
        or parsed.fragment
    ):
        return value

    path_parts = [part for part in parsed.path.split("/") if part]
    if len(path_parts) != 2 or path_parts[0] != "images":
        return value

    image_id = unquote(path_parts[1])
    if not _DOCUMENT_ID.fullmatch(image_id):
        return value

    return f"{IMAGE_PUBLIC_BASE_PATH}/{image_id}"
