import sys
import unittest
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.services.upload_limits import UploadTooLargeError, read_upload_limited


class FakeUpload:
    def __init__(self, content: bytes, declared_size=None):
        self.content = content
        self.size = declared_size
        self.read_calls = []

    async def read(self, size: int) -> bytes:
        self.read_calls.append(size)
        return self.content[:size]


class UploadLimitTests(unittest.IsolatedAsyncioTestCase):
    async def test_rejects_declared_oversize_without_reading(self):
        upload = FakeUpload(b"", declared_size=5)

        with self.assertRaises(UploadTooLargeError):
            await read_upload_limited(upload, 4)

        self.assertEqual(upload.read_calls, [])

    async def test_rejects_unknown_size_with_bounded_read(self):
        upload = FakeUpload(b"12345")

        with self.assertRaises(UploadTooLargeError):
            await read_upload_limited(upload, 4)

        self.assertEqual(upload.read_calls, [5])

    async def test_accepts_exact_limit(self):
        upload = FakeUpload(b"1234", declared_size=4)

        content = await read_upload_limited(upload, 4)

        self.assertEqual(content, b"1234")
        self.assertEqual(upload.read_calls, [5])


if __name__ == "__main__":
    unittest.main()
