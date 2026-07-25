"""HTTP-layer tests for the read path's caching contract.

Unlike the rest of this suite, these exercise the FastAPI app end-to-end via
TestClient (new pattern here — see services/images/README.md). They cover
exactly the behaviors the CDN/browser caching contract depends on and that
no other test can see: a 200 carries an ETag and an immutable Cache-Control,
`If-None-Match` yields a bodyless 304 with no Content-Length, `?w=` serves an
allowlisted resized variant and rejects anything else, and HEAD reports
Content-Length without a body.

Firestore is faked at the `firebase_client` module boundary — the same
technique the rest of this suite uses — so no real Firebase is touched.
`firebase_client` must be stubbed *before* `main` (and therefore
`routers.images`) is imported, since `routers/images.py` does
`from firebase_client import db` at module scope.
"""

import base64
import sys
import types
import unittest
from io import BytesIO
from pathlib import Path

from PIL import Image

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))


def _make_webp_bytes(size: tuple[int, int]) -> bytes:
    image = Image.new("RGB", size, (10, 20, 30))
    output = BytesIO()
    image.save(output, format="WEBP")
    image.close()
    return output.getvalue()


class _FakeDocSnapshot:
    def __init__(self, doc_id: str, data: dict | None):
        self.id = doc_id
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict | None:
        return dict(self._data) if self._data is not None else None


class _FakeDocRef:
    def __init__(self, store: dict, doc_id: str):
        self._store = store
        self.id = doc_id

    def get(self) -> _FakeDocSnapshot:
        return _FakeDocSnapshot(self.id, self._store.get(self.id))

    def set(self, data: dict) -> None:
        self._store[self.id] = dict(data)

    def update(self, data: dict) -> None:
        self._store[self.id].update(data)

    def delete(self) -> None:
        self._store.pop(self.id, None)


class _FakeSelectQuery:
    def __init__(self, store: dict, fields: list[str]):
        self._store = store
        self._fields = fields

    def stream(self):
        for doc_id, data in self._store.items():
            yield _FakeDocSnapshot(doc_id, {field: data.get(field) for field in self._fields})


class _FakeCollection:
    def __init__(self):
        self._store: dict = {}
        self._auto_id = 0

    def document(self, doc_id: str | None = None) -> _FakeDocRef:
        if doc_id is None:
            self._auto_id += 1
            doc_id = f"generated-{self._auto_id}"
        return _FakeDocRef(self._store, doc_id)

    def select(self, fields: list[str]) -> _FakeSelectQuery:
        return _FakeSelectQuery(self._store, fields)

    def stream(self):
        for doc_id, data in self._store.items():
            yield _FakeDocSnapshot(doc_id, data)


class _FakeDb:
    def __init__(self):
        self._collections: dict[str, _FakeCollection] = {}

    def collection(self, name: str) -> _FakeCollection:
        return self._collections.setdefault(name, _FakeCollection())


_fake_db = _FakeDb()
sys.modules["firebase_client"] = types.SimpleNamespace(db=_fake_db)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from config import FIREBASE_COLLECTION, IMAGE_VARIANT_WIDTHS  # noqa: E402

client = TestClient(main.app)

_ALLOWED_WIDTH = sorted(IMAGE_VARIANT_WIDTHS)[0]
_DISALLOWED_WIDTH = max(IMAGE_VARIANT_WIDTHS) + 1


class ImageHttpCacheTests(unittest.TestCase):
    def setUp(self):
        raw = _make_webp_bytes((400, 300))
        b64 = base64.b64encode(raw).decode("ascii")
        self.doc_id = "test-image"
        _fake_db.collection(FIREBASE_COLLECTION).document(self.doc_id).set(
            {
                "filename": "product.webp",
                "contentType": "image/webp",
                "b64": b64,
                "sizeB64": len(b64),
            }
        )

    def test_get_returns_etag_and_immutable_cache_control(self):
        resp = client.get(f"/images/{self.doc_id}")

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.headers.get("etag"))
        self.assertEqual(
            resp.headers["cache-control"], "public, max-age=31536000, immutable"
        )
        self.assertEqual(resp.headers["content-type"], "image/webp")

    def test_if_none_match_returns_304_without_content_length(self):
        first = client.get(f"/images/{self.doc_id}")
        etag = first.headers["etag"]

        second = client.get(
            f"/images/{self.doc_id}", headers={"if-none-match": etag}
        )

        self.assertEqual(second.status_code, 304)
        self.assertNotIn("content-length", second.headers)
        self.assertEqual(second.headers["etag"], etag)
        self.assertEqual(second.content, b"")

    def test_variant_query_returns_resized_webp_with_a_different_etag(self):
        original = client.get(f"/images/{self.doc_id}")
        resp = client.get(f"/images/{self.doc_id}", params={"w": _ALLOWED_WIDTH})

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers["content-type"], "image/webp")
        self.assertNotEqual(resp.headers["etag"], original.headers["etag"])
        with Image.open(BytesIO(resp.content)) as decoded:
            self.assertLessEqual(decoded.width, _ALLOWED_WIDTH)

    def test_disallowed_width_is_rejected(self):
        resp = client.get(f"/images/{self.doc_id}", params={"w": _DISALLOWED_WIDTH})

        self.assertEqual(resp.status_code, 400)

    def test_head_reports_content_length_with_no_body(self):
        resp = client.head(f"/images/{self.doc_id}")

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.headers.get("content-length"))
        self.assertEqual(resp.content, b"")

    def test_missing_image_returns_404(self):
        resp = client.get("/images/does-not-exist")

        self.assertEqual(resp.status_code, 404)

    def test_put_endpoint_no_longer_exists(self):
        # Every caller in this codebase uploads a new image ID on both
        # create and update; a mutating "replace at this ID" endpoint would
        # make the immutable Cache-Control above dishonest, so it was
        # removed. Guard against it silently coming back.
        resp = client.put(f"/images/{self.doc_id}", files={"file": ("x.png", b"", "image/png")})

        self.assertEqual(resp.status_code, 405)


if __name__ == "__main__":
    unittest.main()
