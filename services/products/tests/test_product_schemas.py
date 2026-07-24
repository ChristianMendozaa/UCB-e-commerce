import sys
import unittest
from pathlib import Path

from pydantic import ValidationError

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.schemas.products import ProductCreate, ProductUpdate


class ProductSchemaTests(unittest.TestCase):
    def test_create_strips_required_text_before_validating(self):
        product = ProductCreate(
            name="  Mochila  ",
            description="",
            price=10,
            category="  Accesorios ",
            career=" SIS ",
            stock=1,
        )

        self.assertEqual(product.name, "Mochila")
        self.assertEqual(product.category, "Accesorios")
        self.assertEqual(product.career, "SIS")

    def test_update_rejects_blank_career_and_negative_values(self):
        for values in (
            {"career": "   "},
            {"price": -1},
            {"stock": -1},
        ):
            with self.subTest(values=values), self.assertRaises(ValidationError):
                ProductUpdate(**values)


if __name__ == "__main__":
    unittest.main()
