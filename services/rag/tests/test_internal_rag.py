from types import SimpleNamespace

from fastapi.testclient import TestClient
from google.cloud.firestore_v1.vector import Vector

from app.main import app
from app.services import rag_service


AUTH_HEADERS = {"X-Internal-Token": "test-internal-token"}


class FakeSnapshot:
    def __init__(self, reference, data=None):
        self.reference = reference
        self.id = reference.id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data or {})


class FakeDocumentReference:
    def __init__(self, database, path):
        self.database = database
        self.path = path
        self.id = path.rsplit("/", 1)[-1]

    def get(self):
        return FakeSnapshot(self, self.database.documents.get(self.path))

    def collection(self, name):
        return FakeCollection(self.database, f"{self.path}/{name}")


class FakeQuery:
    def __init__(self, collection, field_path, value):
        self.collection = collection
        self.field_path = field_path
        self.value = value

    def stream(self):
        return [
            snapshot
            for snapshot in self.collection.stream()
            if snapshot.to_dict().get(self.field_path) == self.value
        ]


class FakeVectorQuery:
    def __init__(self, database):
        self.database = database

    def stream(self):
        return list(self.database.vector_results)


class FakeCollection:
    def __init__(self, database, path):
        self.database = database
        self.path = path

    def document(self, document_id):
        return FakeDocumentReference(self.database, f"{self.path}/{document_id}")

    def where(self, *, filter):
        return FakeQuery(self, filter.field_path, filter.value)

    def stream(self):
        expected_parts = len(self.path.split("/")) + 1
        return [
            FakeSnapshot(FakeDocumentReference(self.database, path), data)
            for path, data in self.database.documents.items()
            if path.startswith(f"{self.path}/")
            and len(path.split("/")) == expected_parts
        ]

    def find_nearest(self, **kwargs):
        self.database.nearest_kwargs = kwargs
        return FakeVectorQuery(self.database)


class FakeBatch:
    def __init__(self, database):
        self.database = database
        self.operations = []

    def set(self, reference, data):
        self.operations.append(("set", reference, data))

    def delete(self, reference):
        self.operations.append(("delete", reference, None))

    def commit(self):
        for operation, reference, data in self.operations:
            if operation == "set":
                self.database.documents[reference.path] = dict(data)
            else:
                self.database.documents.pop(reference.path, None)
        self.database.commits.append(list(self.operations))


class FakeFirestore:
    def __init__(self):
        self.documents = {}
        self.vector_results = []
        self.nearest_kwargs = None
        self.commits = []

    def collection(self, name):
        return FakeCollection(self, name)

    def batch(self):
        return FakeBatch(self)

    def put(self, path, data):
        self.documents[path] = dict(data)


class FakeEmbeddings:
    def create(self, **kwargs):
        inputs = kwargs["input"]
        texts = inputs if isinstance(inputs, list) else [inputs]
        return SimpleNamespace(
            data=[
                SimpleNamespace(embedding=[float(index)] * rag_service.EMBEDDING_DIM)
                for index, _text in enumerate(texts)
            ]
        )


def install_fakes(monkeypatch):
    database = FakeFirestore()
    monkeypatch.setattr(rag_service, "firestore_db", database)
    monkeypatch.setattr(
        rag_service, "openai_client", SimpleNamespace(embeddings=FakeEmbeddings())
    )
    return database


def test_documents_endpoints_require_internal_token():
    with TestClient(app) as client:
        no_header = client.post(
            "/internal/rag/documents",
            json={"namespace": "products", "source_id": "p1"},
        )
        wrong_header = client.post(
            "/internal/rag/documents",
            json={"namespace": "products", "source_id": "p1"},
            headers={"X-Internal-Token": "not-the-token"},
        )

    assert no_header.status_code == 422
    assert wrong_header.status_code == 401


def test_upsert_reads_product_and_stores_firestore_vector(monkeypatch):
    database = install_fakes(monkeypatch)
    database.put(
        "products/prod-1",
        {
            "name": "Polera UCB",
            "description": "Polera oficial",
            "price": 80,
            "stock": 12,
            "category": "Ropa",
            "career": "SIS",
        },
    )

    with TestClient(app) as client:
        response = client.post(
            "/internal/rag/documents",
            json={"namespace": "products", "source_id": "prod-1"},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    assert response.json() == {"source_id": "prod-1", "chunks_stored": 1}
    chunks = database.collection("rag_chunks").stream()
    assert len(chunks) == 1
    stored = chunks[0].to_dict()
    assert stored["source_id"] == "prod-1"
    assert stored["source_key"] == "products:prod-1"
    assert "Polera UCB" in stored["text"]
    assert isinstance(stored["embedding"], Vector)


def test_upsert_rejects_missing_product(monkeypatch):
    install_fakes(monkeypatch)
    with TestClient(app) as client:
        response = client.post(
            "/internal/rag/documents",
            json={"namespace": "products", "source_id": "missing"},
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 404


def test_reindex_removes_stale_chunks_atomically(monkeypatch):
    database = install_fakes(monkeypatch)
    source_key = "products:prod-1"
    stale_id = rag_service._chunk_document_id("products", "prod-1", 1)
    database.put(
        f"rag_chunks/{stale_id}",
        {"source_key": source_key, "chunk_index": 1, "text": "stale"},
    )

    result = rag_service._index_text("products", "prod-1", "texto corto")

    assert result["chunks_stored"] == 1
    chunks = database.collection("rag_chunks").stream()
    assert len(chunks) == 1
    assert chunks[0].to_dict()["text"] == "texto corto"
    assert any(
        operation == "delete" and reference.id == stale_id
        for operation, reference, _data in database.commits[-1]
    )


def test_delete_document_removes_only_matching_source(monkeypatch):
    database = install_fakes(monkeypatch)
    database.put(
        "rag_chunks/a", {"source_key": "products:prod-1", "text": "delete"}
    )
    database.put(
        "rag_chunks/b", {"source_key": "products:prod-2", "text": "keep"}
    )

    with TestClient(app) as client:
        response = client.request(
            "DELETE",
            "/internal/rag/documents",
            json={"namespace": "products", "source_id": "prod-1"},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    assert response.json() == {"source_id": "prod-1", "chunks_deleted": 1}
    assert "rag_chunks/a" not in database.documents
    assert "rag_chunks/b" in database.documents


def test_upload_persists_source_segments_and_vectors(monkeypatch):
    database = install_fakes(monkeypatch)
    monkeypatch.setattr(rag_service, "SOURCE_SEGMENT_CHARS", 5)

    with TestClient(app) as client:
        response = client.post(
            "/internal/rag/uploads",
            files={"file": ("knowledge.txt", b"abcdefghijk", "text/plain")},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    source_id = response.json()["source_id"]
    source = database.documents[f"rag_sources/{source_id}"]
    assert source["filename"] == "knowledge.txt"
    assert source["segment_count"] == 3
    assert database.documents[
        f"rag_sources/{source_id}/segments/000002"
    ]["text"] == "k"
    chunk = database.collection("rag_chunks").stream()[0].to_dict()
    assert chunk["source_key"] == f"documents:{source_id}"


def test_query_uses_cosine_threshold_and_omits_embedding(monkeypatch):
    database = install_fakes(monkeypatch)
    result_ref = database.collection("rag_chunks").document("chunk-1")
    database.vector_results = [
        FakeSnapshot(
            result_ref,
            {
                "source_id": "prod-1",
                "namespace": "products",
                "chunk_index": 0,
                "text": "Un producto de prueba",
                "embedding": Vector([0.0] * rag_service.EMBEDDING_DIM),
                "vector_distance": 0.25,
            },
        )
    ]

    with TestClient(app) as client:
        response = client.post(
            "/internal/rag/query",
            json={"query": "algo", "top_k": 3},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    body = response.json()
    assert "Un producto de prueba" in body["answer"]
    assert body["chunks_used"][0]["similarity"] == 0.75
    assert "embedding" not in body["chunks_used"][0]
    assert database.nearest_kwargs["limit"] == 3
    assert database.nearest_kwargs["distance_measure"].name == "COSINE"
    assert database.nearest_kwargs["distance_threshold"] == 0.7


def test_unknown_namespace_is_rejected():
    with TestClient(app) as client:
        response = client.post(
            "/internal/rag/documents",
            json={"namespace": "careers", "source_id": "p1"},
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 422
