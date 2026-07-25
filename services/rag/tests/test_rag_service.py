from types import SimpleNamespace

from app.core import config
from app.services import rag_service


def test_embeddings_keep_model_and_dimension(monkeypatch):
    captured = {}

    class FakeEmbeddings:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                data=[SimpleNamespace(embedding=[0.0] * config.EMBEDDING_DIM)]
            )

    monkeypatch.setattr(
        rag_service,
        "openai_client",
        SimpleNamespace(embeddings=FakeEmbeddings()),
    )

    embedding = rag_service.embed_text("producto")

    assert captured == {
        "model": config.EMBEDDING_MODEL,
        "input": "producto",
    }
    assert config.EMBEDDING_DIM == 1536
    assert len(embedding) == 1536


def test_chunk_text_short_text_returns_single_chunk():
    assert rag_service.chunk_text("hola mundo") == ["hola mundo"]


def test_chunk_text_empty_text_returns_no_chunks():
    assert rag_service.chunk_text("   ") == []
