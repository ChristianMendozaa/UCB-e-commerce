#!/usr/bin/env python3
import argparse
import json
import logging
import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.core.config import (  # noqa: E402
    PRODUCTS_COLLECTION,
    RAG_SOURCES_COLLECTION,
)
from app.core.firebase import firestore_db  # noqa: E402
from app.services.rag_service import (  # noqa: E402
    index_document,
    index_stored_source,
    process_upload,
    prune_orphan_chunks,
)


logger = logging.getLogger("rebuild_index")
SEED_SOURCE_ID = "institutional-knowledge"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reconstruye rag_chunks desde las fuentes persistidas en Firestore."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Cuenta las fuentes sin generar embeddings ni escribir en Firestore.",
    )
    parser.add_argument(
        "--seed-upload",
        type=Path,
        help="Guarda/reemplaza el documento institucional con un ID estable.",
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="Elimina chunks huérfanos si todas las fuentes se indexaron correctamente.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    products = list(firestore_db.collection(PRODUCTS_COLLECTION).stream())
    stored_sources = list(firestore_db.collection(RAG_SOURCES_COLLECTION).stream())

    if args.dry_run:
        existing_ids = {source.id for source in stored_sources}
        document_count = len(existing_ids)
        if args.seed_upload and SEED_SOURCE_ID not in existing_ids:
            document_count += 1
        print(
            json.dumps(
                {
                    "dry_run": True,
                    "products": len(products),
                    "documents": document_count,
                    "would_prune": args.prune,
                },
                ensure_ascii=False,
            )
        )
        return 0

    failures = []
    chunks_stored = 0
    valid_source_keys = set()

    if args.seed_upload:
        try:
            content = args.seed_upload.read_bytes()
            result = process_upload(
                args.seed_upload.name,
                content,
                source_id=SEED_SOURCE_ID,
                kind="seed",
            )
            chunks_stored += result["chunks_stored"]
            valid_source_keys.add(f"documents:{SEED_SOURCE_ID}")
        except Exception as exc:
            logger.exception("No se pudo indexar el documento institucional.")
            failures.append(
                {"namespace": "documents", "source_id": SEED_SOURCE_ID, "error": str(exc)}
            )

    for product in products:
        try:
            result = index_document("products", product.id)
            chunks_stored += result["chunks_stored"]
            valid_source_keys.add(f"products:{product.id}")
        except Exception as exc:
            logger.exception("No se pudo indexar el producto %s.", product.id)
            failures.append(
                {"namespace": "products", "source_id": product.id, "error": str(exc)}
            )

    stored_sources = list(firestore_db.collection(RAG_SOURCES_COLLECTION).stream())
    for source in stored_sources:
        if args.seed_upload and source.id == SEED_SOURCE_ID:
            continue
        try:
            result = index_stored_source(source.id)
            chunks_stored += result["chunks_stored"]
            valid_source_keys.add(f"documents:{source.id}")
        except Exception as exc:
            logger.exception("No se pudo indexar la fuente %s.", source.id)
            failures.append(
                {"namespace": "documents", "source_id": source.id, "error": str(exc)}
            )

    orphan_chunks_deleted = 0
    prune_skipped = False
    if args.prune:
        if failures:
            prune_skipped = True
        else:
            orphan_chunks_deleted = prune_orphan_chunks(valid_source_keys)

    summary = {
        "dry_run": False,
        "sources_attempted": len(products) + len(stored_sources),
        "sources_failed": len(failures),
        "chunks_stored": chunks_stored,
        "orphan_chunks_deleted": orphan_chunks_deleted,
        "prune_skipped": prune_skipped,
        "failures": failures,
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
