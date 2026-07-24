# app/services/images.py
import httpx
from fastapi import HTTPException, UploadFile, status

from app.config import (
    IMAGE_PUBLIC_BASE_PATH,
    IMAGE_SERVICE_BASE_URL,
    MAX_ORIGINAL_IMAGE_BYTES,
)
from app.services.upload_limits import UploadTooLargeError, read_upload_limited

_PASSTHROUGH_IMAGE_STATUSES = frozenset({400, 413, 415})


def _safe_upstream_detail(response: httpx.Response) -> str:
    fallback = "El archivo no es una imagen válida o admitida."
    try:
        detail = response.json().get("detail")
    except (ValueError, AttributeError):
        return fallback
    if not isinstance(detail, str):
        return fallback
    detail = "".join(character for character in detail if character.isprintable())
    return detail[:300] or fallback


async def upload_image_and_get_url(
    file: UploadFile,
    convert_webp: bool = True,
) -> str:
    """
    Sube la imagen al servicio externo y devuelve la URL pública final.
    """
    upload_url = IMAGE_SERVICE_BASE_URL.rstrip("/") + "/images/upload-image/"
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            content = await read_upload_limited(file, MAX_ORIGINAL_IMAGE_BYTES)
        except UploadTooLargeError:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="La imagen original no puede superar 4 MiB.",
            )
        files = {
            "file": (file.filename or "upload", content, file.content_type or "application/octet-stream")
        }
        data = {"convert_webp": "true" if convert_webp else "false"}

        try:
            resp = await client.post(upload_url, files=files, data=data)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in _PASSTHROUGH_IMAGE_STATUSES:
                raise HTTPException(
                    status_code=exc.response.status_code,
                    detail=_safe_upstream_detail(exc.response),
                ) from exc
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="El servicio de imágenes rechazó la solicitud.",
            ) from exc
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="El servicio de imágenes no está disponible.",
            ) from exc

        try:
            payload = resp.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="El servicio de imágenes devolvió una respuesta inválida.",
            ) from exc
        img_id = payload.get("id")
        if not isinstance(img_id, str) or not img_id:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="El servicio de imágenes no devolvió un identificador.",
            )

        return f"{IMAGE_PUBLIC_BASE_PATH}/{img_id}"
