import unittest

from app.services.idempotency import idempotent_order_id


class IdempotencyTests(unittest.TestCase):
    def test_same_command_reuses_the_same_order_id(self):
        first = idempotent_order_id("user-1", "turn-1:create-order")
        second = idempotent_order_id("user-1", "turn-1:create-order")

        self.assertEqual(first, second)
        self.assertTrue(first.startswith("idem_"))
        self.assertEqual(len(first), 69)

    def test_order_id_is_scoped_to_user_and_key(self):
        baseline = idempotent_order_id("user-1", "key-1")

        self.assertNotEqual(baseline, idempotent_order_id("user-2", "key-1"))
        self.assertNotEqual(baseline, idempotent_order_id("user-1", "key-2"))

    def test_empty_values_are_rejected(self):
        with self.assertRaises(ValueError):
            idempotent_order_id("", "key")
        with self.assertRaises(ValueError):
            idempotent_order_id("user", "")
