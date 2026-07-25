"""Bounded in-process LRU cache for on-demand image variants.

Keyed by (image_id, width); evicts by total stored bytes, not entry count,
since variant sizes differ a lot. Thread-safe: GET/HEAD handlers now run as
plain `def`s dispatched to starlette's threadpool, so multiple requests can
hit this concurrently.

A cache hit still costs the Firestore document read in the caller — this
only skips the Pillow decode/resize/encode, which is the expensive part.
Each entry carries the ETag it was built from, so a replaced/backfilled
image (new ETag) is treated as a miss rather than served stale.
"""

import threading
from collections import OrderedDict

_Entry = tuple[str, bytes, str, str]  # (etag, data, content_type, filename)


class VariantCache:
    def __init__(self, *, max_bytes: int) -> None:
        self._max_bytes = max_bytes
        self._lock = threading.Lock()
        self._entries: "OrderedDict[tuple[str, int], _Entry]" = OrderedDict()
        self._total_bytes = 0

    def get(
        self, image_id: str, width: int, etag: str
    ) -> tuple[bytes, str, str] | None:
        """Return (data, content_type, filename) for a fresh cache hit, else None."""
        key = (image_id, width)
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            cached_etag, data, content_type, filename = entry
            if cached_etag != etag:
                self._total_bytes -= len(data)
                del self._entries[key]
                return None
            self._entries.move_to_end(key)
            return data, content_type, filename

    def put(
        self,
        image_id: str,
        width: int,
        etag: str,
        data: bytes,
        content_type: str,
        filename: str,
    ) -> None:
        key = (image_id, width)
        with self._lock:
            existing = self._entries.pop(key, None)
            if existing is not None:
                self._total_bytes -= len(existing[1])
            self._entries[key] = (etag, data, content_type, filename)
            self._total_bytes += len(data)
            while self._total_bytes > self._max_bytes and self._entries:
                _, evicted = self._entries.popitem(last=False)
                self._total_bytes -= len(evicted[1])
