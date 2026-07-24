import sys
import unittest
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.services.image_urls import normalize_public_image_url


class ImageUrlCompatibilityTests(unittest.TestCase):
    def test_rewrites_known_legacy_image_url(self):
        self.assertEqual(
            normalize_public_image_url(
                "https://images-services-ucb-commerce.vercel.app/images/abc_123",
            ),
            "/api/images/abc_123",
        )

    def test_leaves_untrusted_or_malformed_urls_unchanged(self):
        values = [
            "https://example.com/images/abc_123",
            "https://images-services-ucb-commerce.vercel.app/docs",
            "https://images-services-ucb-commerce.vercel.app/images/../admin",
            "/api/images/already-local",
        ]

        for value in values:
            with self.subTest(value=value):
                self.assertEqual(normalize_public_image_url(value), value)


if __name__ == "__main__":
    unittest.main()
