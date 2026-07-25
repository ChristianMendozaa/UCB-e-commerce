from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import app
from app.services import rag_service

AUTH_HEADERS = {"X-Internal-Token": "test-internal-token"}


class FakeDeleteChain:
    def __init__(self, recorder):
        self.recorder = recorder

    def eq(self, column, value):
        self.recorder.append(("delete_eq", column, value))
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class FakeInsertChain:
    def __init__(self, recorder, rows):
        self.recorder = recorder
        self.rows = rows

    def execute(self):
        self.recorder.append(("insert", self.rows))
        return SimpleNamespace(data=self.rows)


class FakeTable:
    def __init__(self, recorder):
        self.recorder = recorder

    def delete(self):
        return FakeDeleteChain(self.recorder)

    def insert(self, rows):
        return FakeInsertChain(self.recorder, rows)


class FakeSupabase:
    def __init__(self):
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return FakeTable(self.calls)


class FakeEmbeddings:
    def create(self, **kwargs):
        texts = kwargs["input"]
        return SimpleNamespace(
            data=[SimpleNamespace(embedding=[0.0] * 4) for _ in texts]
        )


def test_documents_endpoints_require_internal_token():
    with TestClient(app) as client:
        no_header = client.post(
            "/internal/rag/documents",
            json={"namespace": "products", "source_id": "p1", "text": "hola"},
        )
        wrong_header = client.post(
            "/internal/rag/documents",
            json={"namespace": "products", "source_id": "p1", "text": "hola"},
            headers={"X-Internal-Token": "not-the-token"},
        )

    assert no_header.status_code == 422  # header is required
    assert wrong_header.status_code == 401


def test_upsert_document_indexes_with_legacy_uuid_mapping(monkeypatch):
    fake_supabase = FakeSupabase()
    monkeypatch.setattr(rag_service, "supabase", fake_supabase)
    monkeypatch.setattr(
        rag_service, "openai_client", SimpleNamespace(embeddings=FakeEmbeddings())
    )

    with TestClient(app) as client:
        response = client.post(
            "/internal/rag/documents",
            json={
                "namespace": "products",
                "source_id": "test-product-123",
                "text": "Producto de prueba",
            },
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    # Valor precomputado con el algoritmo legacy de
    # products/app/core/rag_sync.py:get_deterministic_uuid antes de la
    # centralización: uuid5(uuid5(NAMESPACE_DNS, "ucb-commerce-products"), source_id).
    expected_uuid = "be7953f0-b340-5be2-a3b7-4a08f14c4554"
    assert response.json() == {"source_id": expected_uuid, "chunks_stored": 1}
    assert ("table", "rag_ucbcommerce_chunks") in fake_supabase.calls
    insert_calls = [call for call in fake_supabase.calls if call[0] == "insert"]
    assert len(insert_calls) == 1
    assert insert_calls[0][1][0]["source_id"] == expected_uuid


def test_delete_document_uses_same_uuid_mapping(monkeypatch):
    fake_supabase = FakeSupabase()
    monkeypatch.setattr(rag_service, "supabase", fake_supabase)

    with TestClient(app) as client:
        response = client.request(
            "DELETE",
            "/internal/rag/documents",
            json={"namespace": "products", "source_id": "test-product-123"},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    expected_uuid = "be7953f0-b340-5be2-a3b7-4a08f14c4554"
    assert response.json() == {"source_id": expected_uuid}
    assert ("delete_eq", "source_id", expected_uuid) in fake_supabase.calls


def test_unknown_namespace_is_rejected():
    with TestClient(app) as client:
        response = client.post(
            "/internal/rag/documents",
            json={"namespace": "careers", "source_id": "p1", "text": "hola"},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 422  # "careers" no está en el Literal permitido


def test_query_endpoint_requires_internal_token():
    with TestClient(app) as client:
        response = client.post("/internal/rag/query", json={"query": "hola"})

    assert response.status_code == 422  # header is required


def test_query_endpoint_returns_answer(monkeypatch):
    fake_supabase = SimpleNamespace(
        rpc=lambda *_args, **_kwargs: SimpleNamespace(
            execute=lambda: SimpleNamespace(data=[{"text": "Un producto de prueba"}])
        )
    )
    monkeypatch.setattr(rag_service, "supabase", fake_supabase)
    monkeypatch.setattr(
        rag_service, "openai_client", SimpleNamespace(embeddings=FakeEmbeddings())
    )

    with TestClient(app) as client:
        response = client.post(
            "/internal/rag/query",
            json={"query": "algo", "top_k": 3},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    body = response.json()
    assert "Un producto de prueba" in body["answer"]
    assert body["chunks_used"] == [{"text": "Un producto de prueba"}]
