import unittest

from app.services.idempotency import command_receipt_id


class IdempotencyTests(unittest.TestCase):
    def test_same_user_and_key_produce_same_receipt(self):
        first = command_receipt_id("user-1", "turn-1:add:product-1")
        second = command_receipt_id("user-1", "turn-1:add:product-1")

        self.assertEqual(first, second)
        self.assertEqual(len(first), 64)

    def test_receipt_is_scoped_to_user_and_key(self):
        baseline = command_receipt_id("user-1", "key-1")

        self.assertNotEqual(baseline, command_receipt_id("user-2", "key-1"))
        self.assertNotEqual(baseline, command_receipt_id("user-1", "key-2"))

    def test_empty_values_are_rejected(self):
        with self.assertRaises(ValueError):
            command_receipt_id("", "key")
        with self.assertRaises(ValueError):
            command_receipt_id("user", "")
