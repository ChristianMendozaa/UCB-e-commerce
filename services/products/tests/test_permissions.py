import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))


class FakeHTTPException(Exception):
    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


fake_fastapi = types.ModuleType("fastapi")
fake_fastapi.HTTPException = FakeHTTPException
fake_fastapi.status = types.SimpleNamespace(HTTP_403_FORBIDDEN=403)
fake_firebase = types.ModuleType("app.core.firebase")
fake_firebase.firestore_db = object()
sys.modules.setdefault("fastapi", fake_fastapi)
sys.modules.setdefault("app.core.firebase", fake_firebase)

from app.deps import permissions


class PlatformAdminPermissionTests(unittest.TestCase):
    def test_accepts_platform_admin(self):
        with patch.object(
            permissions,
            "_read_roles_doc",
            return_value=(["student"], True, []),
        ):
            self.assertIsNone(
                permissions.require_platform_admin_or_403("platform-admin"),
            )

    def test_rejects_career_admin(self):
        with patch.object(
            permissions,
            "_read_roles_doc",
            return_value=(["admin"], False, ["SIS"]),
        ):
            with self.assertRaises(permissions.HTTPException) as raised:
                permissions.require_platform_admin_or_403("career-admin")

        self.assertEqual(raised.exception.status_code, 403)

    def test_product_move_requires_both_careers(self):
        with patch.object(
            permissions,
            "_read_roles_doc",
            return_value=(["admin"], False, ["B"]),
        ):
            with self.assertRaises(permissions.HTTPException) as raised:
                permissions.can_move_product_or_403("career-admin", "A", "B")

        self.assertEqual(raised.exception.status_code, 403)

    def test_product_move_accepts_admin_of_both_careers(self):
        with patch.object(
            permissions,
            "_read_roles_doc",
            return_value=(["admin"], False, ["A", "B"]),
        ):
            self.assertIsNone(
                permissions.can_move_product_or_403(
                    "multi-career-admin",
                    "A",
                    "B",
                ),
            )


if __name__ == "__main__":
    unittest.main()
