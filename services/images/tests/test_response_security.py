import base64
import sys
import types
import unittest
from io import BytesIO
from pathlib import Path

from PIL import Image

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.modules["firebase_client"] = types.SimpleNamespace(db=None)

from routers.images import (
    _image_response_headers,
    _validated_stored_image,
)


def make_png() -> bytes:
    image = Image.new("RGB", (2, 2), (120, 20, 40))
    output = BytesIO()
    image.save(output, format="PNG")
    image.close()
    return output.getvalue()


class ImageResponseSecurityTests(unittest.TestCase):
    def test_response_headers_prevent_sniffing_and_cross_origin_embedding(self):
        headers = _image_response_headers(
            'product"\r\nX-Injected: yes.png',
            content_length=42,
        )

        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(
            headers["Content-Security-Policy"],
            "default-src 'none'; sandbox",
        )
        self.assertEqual(
            headers["Cross-Origin-Resource-Policy"],
            "same-origin",
        )
        self.assertEqual(headers["Content-Length"], "42")
        self.assertNotIn("\r", headers["Content-Disposition"])
        self.assertNotIn("\n", headers["Content-Disposition"])

    def test_stored_mime_and_extension_are_not_trusted(self):
        raw = make_png()
        returned_raw, content_type, filename = _validated_stored_image(
            {
                "b64": base64.b64encode(raw).decode("ascii"),
                "contentType": "text/html",
                "filename": "payload.svg",
            }
        )

        self.assertEqual(returned_raw, raw)
        self.assertEqual(content_type, "image/png")
        self.assertEqual(filename, "payload.png")


if __name__ == "__main__":
    unittest.main()
