import sys
import unittest
from io import BytesIO
from pathlib import Path

from PIL import Image
from PIL.PngImagePlugin import PngInfo

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from config import (
    FIRESTORE_DOCUMENT_MAX_BYTES,
    FIRESTORE_DOCUMENT_SAFETY_MARGIN_BYTES,
    MAX_B64_BYTES,
    MAX_SAFE_B64_BYTES,
)
from utils.utils import (
    EncodedImageTooLargeError,
    ImageDimensionsError,
    UnsupportedImageError,
    inspect_image_bytes,
    process_image,
    sniff_image_format,
    sniffed_image_metadata,
)


def make_image_bytes(
    image_format: str = "PNG",
    *,
    size: tuple[int, int] = (8, 6),
    metadata: bool = False,
) -> bytes:
    image = Image.new("RGBA", size, (20, 80, 140, 180))
    output = BytesIO()
    options = {}
    if image_format == "JPEG":
        image = image.convert("RGB")
    elif image_format == "PNG" and metadata:
        png_info = PngInfo()
        png_info.add_text("Comment", "untrusted-metadata")
        options["pnginfo"] = png_info
    image.save(output, format=image_format, **options)
    image.close()
    return output.getvalue()


class ImageProcessingTests(unittest.TestCase):
    def test_reencodes_png_and_derives_safe_metadata_from_bytes(self):
        attack_marker = b"<script>alert(1)</script>"
        uploaded = make_image_bytes("PNG", metadata=True) + attack_marker

        result = process_image(
            uploaded,
            original_filename='..\\folder\\bad"\r\n.svg',
            convert_webp=False,
            max_b64_bytes=10_000,
            max_width=100,
            max_height=100,
            max_pixels=10_000,
        )

        self.assertEqual(result.content_type, "image/png")
        self.assertEqual(result.filename, "bad.png")
        self.assertNotIn(attack_marker, result.data)
        self.assertNotIn(b"untrusted-metadata", result.data)
        self.assertEqual(
            inspect_image_bytes(
                result.data,
                max_width=100,
                max_height=100,
                max_pixels=10_000,
            ),
            "PNG",
        )

    def test_accepts_only_supported_raster_formats(self):
        for image_format, expected_mime, expected_extension in (
            ("JPEG", "image/jpeg", ".jpg"),
            ("PNG", "image/png", ".png"),
            ("WEBP", "image/webp", ".webp"),
        ):
            with self.subTest(image_format=image_format):
                result = process_image(
                    make_image_bytes(image_format),
                    original_filename="product.HTML",
                    convert_webp=False,
                    max_b64_bytes=20_000,
                    max_width=100,
                    max_height=100,
                    max_pixels=10_000,
                )
                self.assertEqual(result.content_type, expected_mime)
                self.assertTrue(result.filename.endswith(expected_extension))

    def test_rejects_svg_and_html_even_when_named_as_an_image(self):
        for payload in (
            b'<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',
            b"<html><script>alert(1)</script></html>",
        ):
            with (
                self.subTest(payload=payload[:5]),
                self.assertRaises(UnsupportedImageError),
            ):
                process_image(
                    payload,
                    original_filename="product.png",
                    convert_webp=True,
                    max_b64_bytes=20_000,
                    max_width=100,
                    max_height=100,
                    max_pixels=10_000,
                )

    def test_rejects_excessive_width_or_pixel_count(self):
        uploaded = make_image_bytes("PNG", size=(20, 10))

        with self.assertRaises(ImageDimensionsError):
            process_image(
                uploaded,
                original_filename="wide.png",
                convert_webp=False,
                max_b64_bytes=20_000,
                max_width=10,
                max_height=100,
                max_pixels=10_000,
            )

        with self.assertRaises(ImageDimensionsError):
            process_image(
                uploaded,
                original_filename="pixels.png",
                convert_webp=False,
                max_b64_bytes=20_000,
                max_width=100,
                max_height=100,
                max_pixels=100,
            )

    def test_rejects_normalized_payload_above_storage_budget(self):
        with self.assertRaises(EncodedImageTooLargeError):
            process_image(
                make_image_bytes("PNG"),
                original_filename="product.png",
                convert_webp=False,
                max_b64_bytes=1,
                max_width=100,
                max_height=100,
                max_pixels=10_000,
            )

    def test_downscales_long_edge_to_configured_maximum(self):
        uploaded = make_image_bytes("PNG", size=(2400, 1200))

        result = process_image(
            uploaded,
            original_filename="big.png",
            convert_webp=False,
            max_b64_bytes=200_000,
            max_width=8192,
            max_height=8192,
            max_pixels=25_000_000,
            max_edge=1600,
        )

        with Image.open(BytesIO(result.data)) as decoded:
            self.assertEqual(decoded.size, (1600, 800))

    def test_does_not_upscale_images_below_the_maximum(self):
        uploaded = make_image_bytes("PNG", size=(50, 40))

        result = process_image(
            uploaded,
            original_filename="small.png",
            convert_webp=False,
            max_b64_bytes=200_000,
            max_width=8192,
            max_height=8192,
            max_pixels=25_000_000,
            max_edge=1600,
        )

        with Image.open(BytesIO(result.data)) as decoded:
            self.assertEqual(decoded.size, (50, 40))

    def test_dimension_limits_are_enforced_before_downscaling(self):
        # An upload that exceeds the configured limits must still be
        # rejected outright, never silently shrunk to fit via max_edge.
        uploaded = make_image_bytes("PNG", size=(20, 10))

        with self.assertRaises(ImageDimensionsError):
            process_image(
                uploaded,
                original_filename="wide.png",
                convert_webp=False,
                max_b64_bytes=200_000,
                max_width=10,
                max_height=100,
                max_pixels=10_000,
                max_edge=1600,
            )

    def test_convert_webp_always_produces_webp(self):
        # convert_webp=True is no longer just a fallback for oversized
        # re-encodes — every source format is stored as WebP.
        for image_format in ("JPEG", "PNG", "WEBP"):
            with self.subTest(image_format=image_format):
                result = process_image(
                    make_image_bytes(image_format),
                    original_filename="product.png",
                    convert_webp=True,
                    max_b64_bytes=200_000,
                    max_width=100,
                    max_height=100,
                    max_pixels=10_000,
                )
                self.assertEqual(result.content_type, "image/webp")
                self.assertTrue(result.filename.endswith(".webp"))

    def test_sniff_derives_format_from_bytes_for_all_supported_types(self):
        for image_format, expected_mime, expected_extension in (
            ("JPEG", "image/jpeg", ".jpg"),
            ("PNG", "image/png", ".png"),
            ("WEBP", "image/webp", ".webp"),
        ):
            with self.subTest(image_format=image_format):
                raw = make_image_bytes(image_format)
                self.assertEqual(sniff_image_format(raw), image_format)

                content_type, filename = sniffed_image_metadata(raw, "stored.svg")
                self.assertEqual(content_type, expected_mime)
                self.assertTrue(filename.endswith(expected_extension))

    def test_sniff_rejects_bytes_without_a_known_image_signature(self):
        with self.assertRaises(UnsupportedImageError):
            sniff_image_format(b"<html><script>alert(1)</script></html>")

    def test_firestore_base64_budget_is_clamped_with_margin(self):
        self.assertEqual(
            MAX_SAFE_B64_BYTES,
            FIRESTORE_DOCUMENT_MAX_BYTES - FIRESTORE_DOCUMENT_SAFETY_MARGIN_BYTES,
        )
        self.assertLessEqual(MAX_B64_BYTES, MAX_SAFE_B64_BYTES)
        self.assertGreaterEqual(
            FIRESTORE_DOCUMENT_MAX_BYTES - MAX_B64_BYTES,
            FIRESTORE_DOCUMENT_SAFETY_MARGIN_BYTES,
        )


if __name__ == "__main__":
    unittest.main()
