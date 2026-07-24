import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi import HTTPException

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.services.images import upload_image_and_get_url


class FakeUpload:
    filename = "product.svg"
    content_type = "image/svg+xml"

    def __init__(self, content: bytes = b"<svg/>"):
        self._content = content

    async def read(self, size: int = -1) -> bytes:
        if not self._content:
            return b""
        if size < 0:
            chunk, self._content = self._content, b""
            return chunk
        chunk, self._content = self._content[:size], self._content[size:]
        return chunk


class FakeClient:
    def __init__(self, response=None, error=None, **_kwargs):
        self.response = response
        self.error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, **_kwargs):
        if self.error:
            raise self.error
        return self.response


class ImageServiceErrorTests(unittest.IsolatedAsyncioTestCase):
    async def test_preserves_safe_validation_status_and_detail(self):
        request = httpx.Request("POST", "http://images/images/upload-image/")
        response = httpx.Response(
            415,
            request=request,
            json={"detail": "Solo se permiten imágenes JPEG, PNG o WebP"},
        )

        with patch(
            "app.services.images.httpx.AsyncClient",
            lambda **kwargs: FakeClient(response=response, **kwargs),
        ):
            with self.assertRaises(HTTPException) as raised:
                await upload_image_and_get_url(FakeUpload())

        self.assertEqual(raised.exception.status_code, 415)
        self.assertEqual(
            raised.exception.detail,
            "Solo se permiten imágenes JPEG, PNG o WebP",
        )

    async def test_translates_unexpected_upstream_failure_to_bad_gateway(self):
        request = httpx.Request("POST", "http://images/images/upload-image/")
        response = httpx.Response(500, request=request, text="secret traceback")

        with patch(
            "app.services.images.httpx.AsyncClient",
            lambda **kwargs: FakeClient(response=response, **kwargs),
        ):
            with self.assertRaises(HTTPException) as raised:
                await upload_image_and_get_url(FakeUpload())

        self.assertEqual(raised.exception.status_code, 502)
        self.assertNotIn("secret", raised.exception.detail)

    async def test_translates_connection_failure_to_bad_gateway(self):
        request = httpx.Request("POST", "http://images/images/upload-image/")
        error = httpx.ConnectError("connection refused", request=request)

        with patch(
            "app.services.images.httpx.AsyncClient",
            lambda **kwargs: FakeClient(error=error, **kwargs),
        ):
            with self.assertRaises(HTTPException) as raised:
                await upload_image_and_get_url(FakeUpload())

        self.assertEqual(raised.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
