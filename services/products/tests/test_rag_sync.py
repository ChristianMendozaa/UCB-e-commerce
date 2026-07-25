import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.core.rag_sync import (
    delete_product_from_rag,
    get_product_text_representation,
    sync_product_to_rag,
)

PRODUCT = {
    "id": "prod-1",
    "name": "Polera UCB",
    "description": "Polera oficial",
    "price": 80,
    "stock": 12,
    "category": "Ropa",
    "career": "Ingeniería",
}


class FakeClient:
    def __init__(self, response=None, error=None, calls=None, **_kwargs):
        self.response = response
        self.error = error
        self.calls = calls if calls is not None else []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        if self.error:
            raise self.error
        return self.response

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        if self.error:
            raise self.error
        return self.response


class RagSyncBestEffortTests(unittest.TestCase):
    def test_sync_sends_formatted_text_and_auth_header(self):
        calls = []
        request = httpx.Request("POST", "http://rag/internal/rag/documents")
        response = httpx.Response(200, request=request, json={"source_id": "u", "chunks_stored": 1})

        with patch(
            "app.core.rag_sync.httpx.Client",
            lambda **kwargs: FakeClient(response=response, calls=calls, **kwargs),
        ), patch("app.core.rag_sync.INTERNAL_API_TOKEN", "secret-token"):
            sync_product_to_rag(PRODUCT)

        self.assertEqual(len(calls), 1)
        method, url, kwargs = calls[0]
        self.assertEqual(method, "POST")
        self.assertTrue(url.endswith("/internal/rag/documents"))
        self.assertEqual(kwargs["headers"]["X-Internal-Token"], "secret-token")
        self.assertEqual(kwargs["json"]["namespace"], "products")
        self.assertEqual(kwargs["json"]["source_id"], "prod-1")
        self.assertEqual(kwargs["json"]["text"], get_product_text_representation(PRODUCT))

    def test_sync_swallows_connection_failures(self):
        error = httpx.ConnectError(
            "connection refused",
            request=httpx.Request("POST", "http://rag/internal/rag/documents"),
        )

        with patch(
            "app.core.rag_sync.httpx.Client",
            lambda **kwargs: FakeClient(error=error, **kwargs),
        ):
            # No debe lanzar: la escritura del producto ya ocurrió y no
            # debe fallar por una caída del servicio rag.
            sync_product_to_rag(PRODUCT)

    def test_sync_swallows_upstream_error_status(self):
        request = httpx.Request("POST", "http://rag/internal/rag/documents")
        response = httpx.Response(500, request=request, text="boom")

        with patch(
            "app.core.rag_sync.httpx.Client",
            lambda **kwargs: FakeClient(response=response, **kwargs),
        ):
            sync_product_to_rag(PRODUCT)

    def test_delete_sends_namespace_and_id_via_delete_method(self):
        calls = []
        request = httpx.Request("DELETE", "http://rag/internal/rag/documents")
        response = httpx.Response(200, request=request, json={"source_id": "u"})

        with patch(
            "app.core.rag_sync.httpx.Client",
            lambda **kwargs: FakeClient(response=response, calls=calls, **kwargs),
        ):
            delete_product_from_rag("prod-1")

        self.assertEqual(len(calls), 1)
        method, url, kwargs = calls[0]
        self.assertEqual(method, "DELETE")
        self.assertEqual(kwargs["json"], {"namespace": "products", "source_id": "prod-1"})

    def test_delete_swallows_connection_failures(self):
        error = httpx.ConnectError(
            "connection refused",
            request=httpx.Request("DELETE", "http://rag/internal/rag/documents"),
        )

        with patch(
            "app.core.rag_sync.httpx.Client",
            lambda **kwargs: FakeClient(error=error, **kwargs),
        ):
            delete_product_from_rag("prod-1")

    def test_missing_product_id_is_a_noop(self):
        calls = []
        with patch(
            "app.core.rag_sync.httpx.Client",
            lambda **kwargs: FakeClient(calls=calls, **kwargs),
        ):
            sync_product_to_rag({"name": "sin id"})
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
