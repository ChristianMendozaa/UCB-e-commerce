import base64
import binascii
import hashlib
import logging
from typing import Annotated, Final
from urllib.parse import quote

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from starlette.concurrency import run_in_threadpool

from config import (
    FIREBASE_COLLECTION,
    IMAGE_VARIANT_CACHE_BYTES,
    IMAGE_VARIANT_WIDTHS,
    MAX_B64_BYTES,
    MAX_IMAGE_HEIGHT,
    MAX_IMAGE_PIXELS,
    MAX_IMAGE_WIDTH,
    MAX_ORIGINAL_IMAGE_BYTES,
    MAX_STORED_IMAGE_EDGE,
)
from firebase_client import db
from utils.upload_limits import UploadTooLargeError, read_upload_limited
from utils.utils import (
    EncodedImageTooLargeError,
    ImageDimensionsError,
    ImageValidationError,
    ProcessedImage,
    UnsupportedImageError,
    canonical_filename,
    encode_b64,
    process_image,
    sniffed_image_metadata,
)
from utils.variant_cache import VariantCache
from utils.variants import render_variant

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

IMAGE_SECURITY_HEADERS: Final[dict[str, str]] = {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
}

# Every stored image ID is immutable in practice: `services/products` always
# uploads a new ID on both create and update, and this service no longer
# exposes a mutating "replace at this ID" endpoint. That makes a year-long
# immutable cache honest.
_CACHE_CONTROL_IMMUTABLE: Final[str] = "public, max-age=31536000, immutable"

_variant_cache = VariantCache(max_bytes=IMAGE_VARIANT_CACHE_BYTES)


def _image_response_headers(
    filename: str,
    *,
    content_length: int | None = None,
    etag: str | None = None,
    cache_control: str | None = None,
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
    if etag is not None:
        headers["ETag"] = etag
    if cache_control is not None:
        headers["Cache-Control"] = cache_control
    return headers


def _image_etag(b64: str, width: int | None = None) -> str:
    """Strong ETag derived from the stored Base64 string (a bijection of the
    stored bytes), so it can be computed and compared before ever decoding.
    """
    digest = hashlib.blake2b(b64.encode("ascii"), digest_size=16).hexdigest()
    return f'"{digest}-w{width}"' if width else f'"{digest}"'


def _if_none_match_matches(header_value: str | None, etag: str) -> bool:
    if not header_value:
        return False
    for candidate in header_value.split(","):
        candidate = candidate.strip()
        if candidate == "*":
            return True
        if candidate.startswith("W/"):
            candidate = candidate[2:]
        if candidate == etag:
            return True
    return False


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
        return await run_in_threadpool(
            process_image,
            raw,
            original_filename=file.filename,
            convert_webp=convert_webp,
            max_b64_bytes=MAX_B64_BYTES,
            max_width=MAX_IMAGE_WIDTH,
            max_height=MAX_IMAGE_HEIGHT,
            max_pixels=MAX_IMAGE_PIXELS,
            max_edge=MAX_STORED_IMAGE_EDGE,
        )
    except (ImageDimensionsError, EncodedImageTooLargeError) as exc:
        raise HTTPException(413, str(exc)) from exc
    except UnsupportedImageError as exc:
        raise HTTPException(415, str(exc)) from exc
    except ImageValidationError as exc:
        raise HTTPException(400, str(exc)) from exc


def _persist_new_image(image: ProcessedImage) -> tuple[str, int]:
    b64_str = encode_b64(image.data)
    doc = {
        "filename": image.filename,
        "contentType": image.content_type,
        "b64": b64_str,
        "sizeB64": len(b64_str),
    }
    ref = db.collection(FIREBASE_COLLECTION).document()
    ref.set(doc)
    return ref.id, len(b64_str)


def _validated_stored_image(data: dict) -> tuple[bytes, str, str]:
    """Decode a stored doc's bytes and re-derive MIME/filename from them.

    Used on the passthrough (no `?w=`) read path. MIME and extension are
    never taken from the stored `contentType`/`filename` fields.
    """
    b64 = data.get("b64")
    filename = data.get("filename")
    if not isinstance(b64, str) or not b64 or not isinstance(filename, str):
        raise HTTPException(404, "Datos de imagen incompletos")

    try:
        raw = base64.b64decode(b64, validate=True)
        content_type, safe_filename = sniffed_image_metadata(raw, filename)
    except (binascii.Error, ImageValidationError) as exc:
        logger.warning("Se rechazó una imagen almacenada inválida: %s", exc)
        raise HTTPException(404, "Datos de imagen inválidos") from exc

    return raw, content_type, safe_filename


def _get_variant(
    image_id: str, b64: str, filename: str, width: int
) -> tuple[bytes, str, str]:
    """Return (data, content_type, output_filename) for a `?w=` request,
    using the shared in-process LRU cache to skip re-encoding on repeat hits.
    """
    etag = _image_etag(b64, width)
    cached = _variant_cache.get(image_id, width, etag)
    if cached is not None:
        return cached

    try:
        raw = base64.b64decode(b64, validate=True)
        encoded, content_type, output_format = render_variant(
            raw,
            width,
            max_width=MAX_IMAGE_WIDTH,
            max_height=MAX_IMAGE_HEIGHT,
            max_pixels=MAX_IMAGE_PIXELS,
        )
    except (binascii.Error, ImageValidationError) as exc:
        logger.warning("Se rechazó una imagen almacenada inválida: %s", exc)
        raise HTTPException(404, "Datos de imagen inválidos") from exc

    output_filename = canonical_filename(filename, output_format)
    _variant_cache.put(image_id, width, etag, encoded, content_type, output_filename)
    return encoded, content_type, output_filename


def _load_stored_doc(image_id: str) -> dict:
    doc_snap = db.collection(FIREBASE_COLLECTION).document(image_id).get()
    if not doc_snap.exists:
        raise HTTPException(404, "Imagen no encontrada")
    return doc_snap.to_dict() or {}


def _load_doc_and_etag(
    image_id: str, w: int | None
) -> tuple[dict, str, str, str]:
    """Validate `w`, load the Firestore doc, and compute its ETag.

    Deliberately does not decode any image bytes: this lets GET/HEAD answer
    `If-None-Match` with a 304 before paying for a Base64 decode or any
    Pillow work.

    Returns (doc_data, b64, filename, etag).
    """
    if w is not None and w not in IMAGE_VARIANT_WIDTHS:
        raise HTTPException(400, "Ancho solicitado no permitido")

    data = _load_stored_doc(image_id)
    b64 = data.get("b64")
    filename = data.get("filename")
    if not isinstance(b64, str) or not b64 or not isinstance(filename, str):
        raise HTTPException(404, "Datos de imagen incompletos")

    return data, b64, filename, _image_etag(b64, w)


@router.post("/upload-image/", summary="Crear (upload) una nueva imagen")
async def upload_image(
    file: Annotated[UploadFile, File()],
    convert_webp: bool = True,
):
    try:
        image = await _validated_upload(file, convert_webp=convert_webp)
        image_id, size_b64 = await run_in_threadpool(_persist_new_image, image)
        return {
            "id": image_id,
            "filename": image.filename,
            "size_b64": size_b64,
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
def list_images():
    """Devuelve id, filename, contentType y size_b64 de cada imagen.

    Uses a Firestore field-projection (`select`) so the (potentially large)
    `b64` payload of every image is never transferred just to report a size.
    Images written before `sizeB64` existed report 0 until the backfill
    script (`scripts/backfill_downscale.py`) rewrites them.
    """
    try:
        images = []
        query = db.collection(FIREBASE_COLLECTION).select(
            ["filename", "contentType", "sizeB64"]
        )
        for doc in query.stream():
            data = doc.to_dict() or {}
            images.append(
                {
                    "id": doc.id,
                    "filename": data.get("filename"),
                    "contentType": data.get("contentType"),
                    "size_b64": data.get("sizeB64", 0),
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
def head_image(
    image_id: str,
    request: Request,
    w: int | None = Query(default=None, description="Ancho deseado en px (allowlist)"),
):
    try:
        data, b64, filename, etag = _load_doc_and_etag(image_id, w)

        if _if_none_match_matches(request.headers.get("if-none-match"), etag):
            return Response(
                status_code=304,
                headers=_image_response_headers(
                    filename, etag=etag, cache_control=_CACHE_CONTROL_IMMUTABLE
                ),
            )

        if w is not None:
            raw, content_type, out_filename = _get_variant(image_id, b64, filename, w)
        else:
            raw, content_type, out_filename = _validated_stored_image(data)

        return Response(
            status_code=200,
            media_type=content_type,
            headers=_image_response_headers(
                out_filename,
                content_length=len(raw),
                etag=etag,
                cache_control=_CACHE_CONTROL_IMMUTABLE,
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
def get_image(
    image_id: str,
    request: Request,
    w: int | None = Query(default=None, description="Ancho deseado en px (allowlist)"),
):
    """
    Devuelve una imagen validada con MIME y nombre derivados de sus bytes.

    `?w=<ancho>` sirve una variante redimensionada en WebP desde una lista
    blanca de anchos (`IMAGE_VARIANT_WIDTHS`); sin el parámetro se sirve el
    original guardado.
    """
    try:
        data, b64, filename, etag = _load_doc_and_etag(image_id, w)

        if _if_none_match_matches(request.headers.get("if-none-match"), etag):
            return Response(
                status_code=304,
                headers=_image_response_headers(
                    filename, etag=etag, cache_control=_CACHE_CONTROL_IMMUTABLE
                ),
            )

        if w is not None:
            raw, content_type, out_filename = _get_variant(image_id, b64, filename, w)
        else:
            raw, content_type, out_filename = _validated_stored_image(data)

        return Response(
            content=raw,
            media_type=content_type,
            headers=_image_response_headers(
                out_filename,
                content_length=len(raw),
                etag=etag,
                cache_control=_CACHE_CONTROL_IMMUTABLE,
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


@router.delete("/{image_id}", summary="Eliminar imagen por ID")
def delete_image(image_id: str):
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
