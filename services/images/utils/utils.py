import base64
import re
import unicodedata
import warnings
from dataclasses import dataclass
from io import BytesIO
from typing import Final

from PIL import Image, ImageOps, UnidentifiedImageError

SUPPORTED_IMAGE_FORMATS: Final[dict[str, tuple[str, str]]] = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}

_PNG_SIGNATURE: Final[bytes] = b"\x89PNG\r\n\x1a\n"
_JPEG_SIGNATURE: Final[bytes] = b"\xff\xd8\xff"
_RIFF_SIGNATURE: Final[bytes] = b"RIFF"
_WEBP_SIGNATURE: Final[bytes] = b"WEBP"


class ImageValidationError(ValueError):
    """Base error for image data that is unsafe or unsupported."""


class UnsupportedImageError(ImageValidationError):
    """The uploaded bytes are not a supported static raster image."""


class ImageDimensionsError(ImageValidationError):
    """The decoded dimensions exceed the configured safety limits."""


class EncodedImageTooLargeError(ImageValidationError):
    """The normalized image cannot fit in the Firestore document budget."""


@dataclass(frozen=True)
class ProcessedImage:
    data: bytes
    content_type: str
    filename: str


def encode_b64(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")


def calc_b64_size(data: bytes) -> int:
    """Tamaño en bytes de la cadena Base64 sin construirla entera."""
    return ((len(data) + 2) // 3) * 4


def inspect_image_bytes(
    data: bytes,
    *,
    max_width: int,
    max_height: int,
    max_pixels: int,
) -> str:
    """Validate bytes with Pillow and return a trusted canonical format."""
    if not data:
        raise UnsupportedImageError("El archivo de imagen está vacío")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                image_format = (image.format or "").upper()
                if image_format not in SUPPORTED_IMAGE_FORMATS:
                    raise UnsupportedImageError(
                        "Solo se permiten imágenes JPEG, PNG o WebP"
                    )
                _validate_dimensions(
                    image.width,
                    image.height,
                    max_width=max_width,
                    max_height=max_height,
                    max_pixels=max_pixels,
                )
                if getattr(image, "n_frames", 1) != 1:
                    raise UnsupportedImageError("No se permiten imágenes animadas")
                image.verify()
                return image_format
    except ImageValidationError:
        raise
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
    ) as exc:
        raise UnsupportedImageError(
            "Los bytes no contienen una imagen JPEG, PNG o WebP válida"
        ) from exc


def process_image(
    data: bytes,
    *,
    original_filename: str | None,
    convert_webp: bool,
    max_b64_bytes: int,
    max_width: int,
    max_height: int,
    max_pixels: int,
    max_edge: int | None = None,
) -> ProcessedImage:
    """
    Decode and re-encode a supported image before storage.

    Re-encoding strips metadata and trailing payloads. MIME type and extension
    are derived from Pillow's byte-level detection rather than upload headers.

    Dimension limits (`max_width`/`max_height`/`max_pixels`) are enforced by
    `inspect_image_bytes` before anything is decoded, so an oversized upload is
    always rejected rather than silently shrunk. `max_edge`, if given, is a
    *storage* optimization applied only after that validation passes: it
    downscales already-accepted images so stored bytes stay small, it never
    upscales, and it never changes whether an upload is accepted.

    When `convert_webp` is true the image is always encoded as WebP (not just
    as a fallback once the JPEG/PNG re-encode overflows the budget) — WebP is
    consistently smaller for photographic product images, and every caller in
    this codebase already passes `convert_webp=True`.
    """
    image_format = inspect_image_bytes(
        data,
        max_width=max_width,
        max_height=max_height,
        max_pixels=max_pixels,
    )
    image = _decode_normalized_image(data)
    try:
        if max_edge and max(image.width, image.height) > max_edge:
            image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)

        if convert_webp:
            encoded = _encode_image(image, "WEBP", quality=85)
            output_format = "WEBP"
            if calc_b64_size(encoded) > max_b64_bytes:
                encoded = _encode_image(image, "WEBP", quality=80)
                if calc_b64_size(encoded) > max_b64_bytes:
                    raise EncodedImageTooLargeError(
                        "La imagen WebP supera el límite de almacenamiento"
                    )
        else:
            encoded = _encode_image(image, image_format)
            output_format = image_format
            if calc_b64_size(encoded) > max_b64_bytes:
                raise EncodedImageTooLargeError(
                    "La imagen normalizada supera el límite de almacenamiento"
                )
    finally:
        image.close()

    content_type, _ = SUPPORTED_IMAGE_FORMATS[output_format]
    return ProcessedImage(
        data=encoded,
        content_type=content_type,
        filename=canonical_filename(original_filename, output_format),
    )


def canonical_filename(filename: str | None, image_format: str) -> str:
    """Return a short ASCII filename with an extension matching the bytes."""
    _, extension = SUPPORTED_IMAGE_FORMATS[image_format]
    candidate = (filename or "image").replace("\\", "/").rsplit("/", 1)[-1]
    stem = candidate.rsplit(".", 1)[0]
    stem = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode("ascii")
    stem = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-_")
    return f"{(stem[:80] or 'image')}{extension}"


def trusted_image_metadata(
    data: bytes,
    filename: str | None,
    *,
    max_width: int,
    max_height: int,
    max_pixels: int,
) -> tuple[str, str]:
    """Derive safe response metadata for existing Firestore records."""
    image_format = inspect_image_bytes(
        data,
        max_width=max_width,
        max_height=max_height,
        max_pixels=max_pixels,
    )
    content_type, _ = SUPPORTED_IMAGE_FORMATS[image_format]
    return content_type, canonical_filename(filename, image_format)


def sniff_image_format(data: bytes) -> str:
    """Derive the canonical format from leading bytes only, without decoding.

    Cheap read-path counterpart to `inspect_image_bytes`/`trusted_image_metadata`.
    Still derives the format from the stored bytes, never from the stored
    `contentType` field — it just skips the full Pillow open/verify pass,
    which is safe here because the bytes were already fully validated by
    `process_image` at write time and are never re-decoded on a plain
    (non-resize) read.
    """
    if data.startswith(_PNG_SIGNATURE):
        return "PNG"
    if data.startswith(_JPEG_SIGNATURE):
        return "JPEG"
    if len(data) >= 12 and data[:4] == _RIFF_SIGNATURE and data[8:12] == _WEBP_SIGNATURE:
        return "WEBP"
    raise UnsupportedImageError("Los bytes almacenados no son JPEG, PNG ni WebP")


def sniffed_image_metadata(data: bytes, filename: str | None) -> tuple[str, str]:
    """Cheap read-path counterpart to `trusted_image_metadata`."""
    image_format = sniff_image_format(data)
    content_type, _ = SUPPORTED_IMAGE_FORMATS[image_format]
    return content_type, canonical_filename(filename, image_format)


def _validate_dimensions(
    width: int,
    height: int,
    *,
    max_width: int,
    max_height: int,
    max_pixels: int,
) -> None:
    if (
        width <= 0
        or height <= 0
        or width > max_width
        or height > max_height
        or width * height > max_pixels
    ):
        raise ImageDimensionsError(
            "Las dimensiones de la imagen superan el límite permitido"
        )


def _decode_normalized_image(data: bytes) -> Image.Image:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                source.load()
                transposed = ImageOps.exif_transpose(source)
                has_alpha = transposed.mode in {"RGBA", "LA"} or (
                    transposed.mode == "P" and "transparency" in transposed.info
                )
                return transposed.convert("RGBA" if has_alpha else "RGB")
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
    ) as exc:
        raise UnsupportedImageError("No se pudo decodificar la imagen") from exc


def _encode_image(
    image: Image.Image,
    image_format: str,
    *,
    quality: int = 85,
    method: int = 6,
) -> bytes:
    output = BytesIO()
    if image_format == "JPEG":
        image.convert("RGB").save(
            output,
            format="JPEG",
            quality=90,
            optimize=True,
            progressive=True,
        )
    elif image_format == "PNG":
        image.save(output, format="PNG", optimize=True)
    elif image_format == "WEBP":
        image.save(output, format="WEBP", quality=quality, method=method)
    else:
        raise UnsupportedImageError("Formato de imagen no permitido")
    return output.getvalue()
