"""On-demand resize variants for stored images.

Unlike the passthrough read path (`utils.sniffed_image_metadata`), rendering
a variant decodes the image, so it must run the full validated
`inspect_image_bytes` — including the decompression-bomb guard — before
touching Pillow's decoder. The cheap magic-byte sniff is only safe for
passthrough because those bytes are never decoded.
"""

from PIL import Image

from .utils import (
    SUPPORTED_IMAGE_FORMATS,
    _decode_normalized_image,
    _encode_image,
    inspect_image_bytes,
    sniff_image_format,
)


def render_variant(
    raw: bytes,
    width: int,
    *,
    max_width: int,
    max_height: int,
    max_pixels: int,
) -> tuple[bytes, str, str]:
    """Return (encoded_bytes, content_type, output_format) for `raw` at `width`.

    Never upscales: if the stored image is already no wider than `width`, the
    original bytes and format are returned unchanged. Otherwise the image is
    downscaled and re-encoded as WebP (smaller than JPEG/PNG at equivalent
    quality, and this is a fresh compressed variant with no chain of prior
    resizes to protect).
    """
    inspect_image_bytes(
        raw, max_width=max_width, max_height=max_height, max_pixels=max_pixels
    )
    image = _decode_normalized_image(raw)
    try:
        if image.width <= width:
            output_format = sniff_image_format(raw)
            return raw, SUPPORTED_IMAGE_FORMATS[output_format][0], output_format

        image.thumbnail((width, image.height), Image.Resampling.LANCZOS)
        encoded = _encode_image(image, "WEBP", quality=80, method=4)
        return encoded, "image/webp", "WEBP"
    finally:
        image.close()
