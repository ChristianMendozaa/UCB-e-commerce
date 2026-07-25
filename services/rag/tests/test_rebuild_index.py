from pathlib import Path
from types import SimpleNamespace

from scripts import rebuild_index


class FakeCollection:
    def __init__(self, snapshots):
        self.snapshots = snapshots

    def stream(self):
        return list(self.snapshots)


class FakeFirestore:
    def __init__(self, products=None, sources=None):
        self.products = products or []
        self.sources = sources or []

    def collection(self, name):
        if name == rebuild_index.PRODUCTS_COLLECTION:
            return FakeCollection(self.products)
        if name == rebuild_index.RAG_SOURCES_COLLECTION:
            return FakeCollection(self.sources)
        raise AssertionError(f"Unexpected collection: {name}")


def test_dry_run_counts_sources_without_writes(monkeypatch, capsys):
    database = FakeFirestore(
        products=[SimpleNamespace(id="p1"), SimpleNamespace(id="p2")],
        sources=[SimpleNamespace(id="existing-document")],
    )
    monkeypatch.setattr(rebuild_index, "firestore_db", database)
    monkeypatch.setattr(
        rebuild_index,
        "parse_args",
        lambda: SimpleNamespace(
            dry_run=True,
            seed_upload=Path("seed.txt"),
            prune=True,
        ),
    )
    monkeypatch.setattr(
        rebuild_index,
        "process_upload",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("dry-run must not write")
        ),
    )

    assert rebuild_index.main() == 0
    output = capsys.readouterr().out
    assert '"products": 2' in output
    assert '"documents": 2' in output
    assert '"would_prune": true' in output


def test_failure_returns_nonzero_and_skips_prune(monkeypatch, capsys):
    database = FakeFirestore(products=[SimpleNamespace(id="p1")])
    monkeypatch.setattr(rebuild_index, "firestore_db", database)
    monkeypatch.setattr(
        rebuild_index,
        "parse_args",
        lambda: SimpleNamespace(dry_run=False, seed_upload=None, prune=True),
    )
    monkeypatch.setattr(
        rebuild_index,
        "index_document",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("embedding failed")),
    )
    prune_calls = []
    monkeypatch.setattr(
        rebuild_index,
        "prune_orphan_chunks",
        lambda keys: prune_calls.append(keys),
    )

    assert rebuild_index.main() == 1
    output = capsys.readouterr().out
    assert '"sources_failed": 1' in output
    assert '"prune_skipped": true' in output
    assert prune_calls == []
