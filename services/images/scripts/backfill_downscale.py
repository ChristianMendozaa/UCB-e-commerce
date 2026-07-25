#!/usr/bin/env python3
"""One-off backfill: downscale + convert existing stored images to WebP.

Only new uploads go through `process_image`'s downscale-to-1600px /
always-WebP pipeline (see `utils/utils.py`). This script brings images
stored before that change up to the same shape, so their ETags rotate once
(the intended cache-bust) and their Firestore documents shrink.

Run locally against Firestore with the service account credentials from
`services/images/.env` — never expose this as an HTTP endpoint. This service
has no authentication of its own; a reprocessing endpoint would be an
unauthenticated mutation surface.

    cd services/images
    python scripts/backfill_downscale.py --dry-run   # preview, no writes
    python scripts/backfill_downscale.py              # apply

Idempotent: an image already at or below MAX_STORED_IMAGE_EDGE and already
WebP is left untouched, so re-running (e.g. after interrupting a previous
run) is safe and never re-compresses an already-converted image.
"""

import argparse
import base64
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from config import (  # noqa: E402
    FIREBASE_COLLECTION,
    MAX_B64_BYTES,
    MAX_IMAGE_HEIGHT,
    MAX_IMAGE_PIXELS,
    MAX_IMAGE_WIDTH,
    MAX_STORED_IMAGE_EDGE,
)
from firebase_client import db  # noqa: E402
from utils.utils import (  # noqa: E402
    ImageValidationError,
    encode_b64,
    process_image,
    sniff_image_format,
)


def _needs_reprocessing(raw: bytes) -> bool:
    """True if `raw` isn't already WebP at or below the target long edge."""
    try:
        image_format = sniff_image_format(raw)
    except ImageValidationError:
        return True  # unreadable/unexpected bytes — let process_image raise & log below

    if image_format != "WEBP":
        return True

    with Image.open(BytesIO(raw)) as image:
        return max(image.width, image.height) > MAX_STORED_IMAGE_EDGE


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would change without writing to Firestore",
    )
    args = parser.parse_args()

    collection = db.collection(FIREBASE_COLLECTION)
    scanned = reprocessed = skipped = failed = 0
    bytes_before = 0
    bytes_after = 0

    for doc in collection.stream():
        scanned += 1
        data = doc.to_dict() or {}
        b64 = data.get("b64")
        filename = data.get("filename")
        if not isinstance(b64, str) or not b64:
            failed += 1
            print(f"[skip] {doc.id}: missing/invalid b64 field")
            continue

        try:
            raw = base64.b64decode(b64, validate=True)
        except Exception as exc:  # binascii.Error is a ValueError subclass
            failed += 1
            print(f"[skip] {doc.id}: cannot decode stored b64 ({exc})")
            continue

        if not _needs_reprocessing(raw):
            skipped += 1
            continue

        try:
            result = process_image(
                raw,
                original_filename=filename,
                convert_webp=True,
                max_b64_bytes=MAX_B64_BYTES,
                max_width=MAX_IMAGE_WIDTH,
                max_height=MAX_IMAGE_HEIGHT,
                max_pixels=MAX_IMAGE_PIXELS,
                max_edge=MAX_STORED_IMAGE_EDGE,
            )
        except ImageValidationError as exc:
            failed += 1
            print(f"[skip] {doc.id}: {exc}")
            continue

        new_b64 = encode_b64(result.data)
        if len(new_b64) >= len(b64):
            # Re-encoding didn't actually shrink this one (e.g. a tiny image
            # where WebP container overhead loses to PNG) — leave it as is.
            skipped += 1
            continue

        reprocessed += 1
        bytes_before += len(b64)
        bytes_after += len(new_b64)
        action = "would rewrite" if args.dry_run else "rewrite"
        print(f"[{action}] {doc.id}: {len(b64)} -> {len(new_b64)} b64 bytes")

        if not args.dry_run:
            doc.reference.update(
                {
                    "filename": result.filename,
                    "contentType": result.content_type,
                    "b64": new_b64,
                    "sizeB64": len(new_b64),
                }
            )

    print(
        f"\nScanned {scanned}, reprocessed {reprocessed}, "
        f"skipped {skipped}, failed {failed}."
    )
    if reprocessed:
        saved = bytes_before - bytes_after
        pct = (saved / bytes_before * 100) if bytes_before else 0.0
        print(
            f"Base64 bytes: {bytes_before} -> {bytes_after} "
            f"(saved {saved}, {pct:.1f}%)"
        )
    if args.dry_run:
        print("Dry run: no documents were modified.")


if __name__ == "__main__":
    main()
