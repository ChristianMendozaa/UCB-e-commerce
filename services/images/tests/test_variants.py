import sys
import unittest
from io import BytesIO
from pathlib import Path

from PIL import Image

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from utils.variants import render_variant
from utils.variant_cache import VariantCache


def make_png_bytes(size: tuple[int, int]) -> bytes:
    image = Image.new("RGB", size, (20, 80, 140))
    output = BytesIO()
    image.save(output, format="PNG")
    image.close()
    return output.getvalue()


class RenderVariantTests(unittest.TestCase):
    def test_resizes_to_requested_width_and_returns_webp(self):
        raw = make_png_bytes((1600, 800))

        data, content_type, output_format = render_variant(
            raw, 320, max_width=8192, max_height=8192, max_pixels=25_000_000
        )

        self.assertEqual(content_type, "image/webp")
        self.assertEqual(output_format, "WEBP")
        with Image.open(BytesIO(data)) as decoded:
            self.assertEqual(decoded.size, (320, 160))

    def test_does_not_upscale_when_source_is_narrower_than_requested(self):
        raw = make_png_bytes((200, 100))

        data, content_type, output_format = render_variant(
            raw, 640, max_width=8192, max_height=8192, max_pixels=25_000_000
        )

        # Passthrough: original bytes and format returned unchanged.
        self.assertEqual(data, raw)
        self.assertEqual(content_type, "image/png")
        self.assertEqual(output_format, "PNG")

    def test_enforces_dimension_limits_before_decoding(self):
        raw = make_png_bytes((2000, 1000))

        from utils.utils import ImageDimensionsError

        with self.assertRaises(ImageDimensionsError):
            render_variant(raw, 320, max_width=100, max_height=100, max_pixels=10_000)


class VariantCacheTests(unittest.TestCase):
    def test_hit_returns_cached_payload(self):
        cache = VariantCache(max_bytes=10_000)
        cache.put("img1", 320, "etag-a", b"data", "image/webp", "img1.webp")

        cached = cache.get("img1", 320, "etag-a")

        self.assertEqual(cached, (b"data", "image/webp", "img1.webp"))

    def test_stale_etag_is_treated_as_a_miss_and_evicted(self):
        cache = VariantCache(max_bytes=10_000)
        cache.put("img1", 320, "etag-a", b"data", "image/webp", "img1.webp")

        self.assertIsNone(cache.get("img1", 320, "etag-b"))
        # A stale hit clears the stale entry rather than leaving it around.
        self.assertIsNone(cache.get("img1", 320, "etag-a"))

    def test_evicts_oldest_entries_once_over_the_byte_budget(self):
        cache = VariantCache(max_bytes=1000)
        cache.put("img1", 320, "etag-1", b"x" * 500, "image/webp", "a.webp")
        cache.put("img2", 320, "etag-2", b"y" * 600, "image/webp", "b.webp")

        self.assertIsNone(cache.get("img1", 320, "etag-1"))
        self.assertIsNotNone(cache.get("img2", 320, "etag-2"))

    def test_returns_bit_identical_bytes(self):
        cache = VariantCache(max_bytes=10_000)
        payload = bytes(range(256)) * 4
        cache.put("img1", 96, "etag-a", payload, "image/webp", "img1.webp")

        data, _, _ = cache.get("img1", 96, "etag-a")

        self.assertEqual(data, payload)


if __name__ == "__main__":
    unittest.main()
