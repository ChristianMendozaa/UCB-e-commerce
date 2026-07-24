import base64
import binascii
import logging
from io import BytesIO
from typing import Annotated, Final
from urllib.parse import quote

from fastapi import APIRouter, File, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse

from config import (
    FIREBASE_COLLECTION,
    MAX_B64_BYTES,
    MAX_IMAGE_HEIGHT,
    MAX_IMAGE_PIXELS,
    MAX_IMAGE_WIDTH,
    MAX_ORIGINAL_IMAGE_BYTES,
)
from firebase_client import db
from utils.upload_limits import UploadTooLargeError, read_upload_limited
from utils.utils import (
    EncodedImageTooLargeError,
    ImageDimensionsError,
    ImageValidationError,
    ProcessedImage,
    UnsupportedImageError,
    encode_b64,
    process_image,
    trusted_image_metadata,
)

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

IMAGE_SECURITY_HEADERS: Final[dict[str, str]] = {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
}


def _image_response_headers(
    filename: str,
    *,
    content_length: int | None = None,
) -> dict[str, str]:
    ascii_filename = (
        filename.encode("ascii", "ignore")
        .decode("ascii")
        .replace("\\", "_")
        .replace('"', "_")
        .replace("\r", "_")
        .replace("\n", "_")
    ) or "image"
    utf8_filename_encoded = quote(filename, safe="")
    headers = {
        **IMAGE_SECURITY_HEADERS,
        "Content-Disposition": (
            f'inline; filename="{ascii_filename}"; '
            f"filename*=utf-8''{utf8_filename_encoded}"
        ),
    }
    if content_length is not None:
        headers["Content-Length"] = str(content_length)
    return headers


async def _validated_upload(
    file: UploadFile,
    *,
    convert_webp: bool,
) -> ProcessedImage:
    try:
        raw = await read_upload_limited(file, MAX_ORIGINAL_IMAGE_BYTES)
    except UploadTooLargeError as exc:
        raise HTTPException(
            413,
            "La imagen original no puede superar 4 MiB",
        ) from exc

    try:
        return process_image(
            raw,
            original_filename=file.filename,
            convert_webp=convert_webp,
            max_b64_bytes=MAX_B64_BYTES,
            max_width=MAX_IMAGE_WIDTH,
            max_height=MAX_IMAGE_HEIGHT,
            max_pixels=MAX_IMAGE_PIXELS,
        )
    except (ImageDimensionsError, EncodedImageTooLargeError) as exc:
        raise HTTPException(413, str(exc)) from exc
    except UnsupportedImageError as exc:
        raise HTTPException(415, str(exc)) from exc
    except ImageValidationError as exc:
        raise HTTPException(400, str(exc)) from exc


def _validated_stored_image(data: dict) -> tuple[bytes, str, str]:
    b64 = data.get("b64")
    filename = data.get("filename")
    if not isinstance(b64, str) or not b64 or not isinstance(filename, str):
        raise HTTPException(404, "Datos de imagen incompletos")

    try:
        raw = base64.b64decode(b64, validate=True)
        content_type, safe_filename = trusted_image_metadata(
            raw,
            filename,
            max_width=MAX_IMAGE_WIDTH,
            max_height=MAX_IMAGE_HEIGHT,
            max_pixels=MAX_IMAGE_PIXELS,
        )
    except (binascii.Error, ImageValidationError) as exc:
        logger.warning("Se rechazó una imagen almacenada inválida: %s", exc)
        raise HTTPException(404, "Datos de imagen inválidos") from exc

    return raw, content_type, safe_filename


@router.post("/upload-image/", summary="Crear (upload) una nueva imagen")
async def upload_image(
    file: Annotated[UploadFile, File()],
    convert_webp: bool = True,
):
    try:
        image = await _validated_upload(file, convert_webp=convert_webp)
        b64_str = encode_b64(image.data)
        doc = {
            "filename": image.filename,
            "contentType": image.content_type,
            "b64": b64_str,
        }
        ref = db.collection(FIREBASE_COLLECTION).document()
        ref.set(doc)

        return {
            "id": ref.id,
            "filename": image.filename,
            "size_b64": len(b64_str),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error en upload_image")
        raise HTTPException(
            500,
            detail="No se pudo guardar la imagen",
        ) from exc


@router.get("/", summary="Listar todas las imágenes (metadatos)")
async def list_images():
    """Devuelve id, filename, contentType y size_b64 de cada imagen."""
    try:
        images = []
        for doc in db.collection(FIREBASE_COLLECTION).stream():
            data = doc.to_dict() or {}
            b64 = data.get("b64", "")
            images.append(
                {
                    "id": doc.id,
                    "filename": data.get("filename"),
                    "contentType": data.get("contentType"),
                    "size_b64": len(b64),
                }
            )
        return images
    except Exception as exc:
        logger.exception("Error en list_images")
        raise HTTPException(
            500,
            detail="No se pudo listar las imágenes",
        ) from exc


@router.head("/{image_id}", include_in_schema=False)
async def head_image(image_id: str):
    try:
        doc_snap = db.collection(FIREBASE_COLLECTION).document(image_id).get()
        if not doc_snap.exists:
            raise HTTPException(404, "Imagen no encontrada")

        raw, content_type, filename = _validated_stored_image(doc_snap.to_dict() or {})
        return Response(
            status_code=200,
            media_type=content_type,
            headers=_image_response_headers(
                filename,
                content_length=len(raw),
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error en head_image")
        raise HTTPException(
            500,
            detail="No se pudo recuperar la imagen",
        ) from exc


@router.get("/{image_id}", summary="Descargar imagen (raw con extensión)")
async def get_image(image_id: str):
    """
    Devuelve una imagen validada con MIME y nombre derivados de sus bytes.
    """
    try:
        doc_snap = db.collection(FIREBASE_COLLECTION).document(image_id).get()
        if not doc_snap.exists:
            raise HTTPException(404, "Imagen no encontrada")

        raw, content_type, filename = _validated_stored_image(doc_snap.to_dict() or {})
        return StreamingResponse(
            BytesIO(raw),
            media_type=content_type,
            headers=_image_response_headers(
                filename,
                content_length=len(raw),
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error en get_image")
        raise HTTPException(
            500,
            detail="No se pudo recuperar la imagen",
        ) from exc


@router.put("/{image_id}", summary="Actualizar imagen existente")
async def update_image(
    image_id: str,
    file: Annotated[UploadFile, File()],
    convert_webp: bool = True,
):
    """
    Reemplaza la imagen almacenada aplicando la validación del upload.
    """
    try:
        ref = db.collection(FIREBASE_COLLECTION).document(image_id)
        if not ref.get().exists:
            raise HTTPException(404, "Imagen no encontrada")

        image = await _validated_upload(file, convert_webp=convert_webp)
        b64_str = encode_b64(image.data)
        ref.update(
            {
                "filename": image.filename,
                "contentType": image.content_type,
                "b64": b64_str,
            }
        )
        return {
            "id": image_id,
            "filename": image.filename,
            "size_b64": len(b64_str),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error en update_image")
        raise HTTPException(
            500,
            detail="No se pudo actualizar la imagen",
        ) from exc


@router.delete("/{image_id}", summary="Eliminar imagen por ID")
async def delete_image(image_id: str):
    """Borra el documento de Firestore con el ID dado."""
    try:
        ref = db.collection(FIREBASE_COLLECTION).document(image_id)
        if not ref.get().exists:
            raise HTTPException(404, "Imagen no encontrada")
        ref.delete()
        return {"id": image_id, "deleted": True}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error en delete_image")
        raise HTTPException(
            500,
            detail="No se pudo eliminar la imagen",
        ) from exc
