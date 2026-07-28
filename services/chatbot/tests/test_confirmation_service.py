import pytest

from app.services.confirmation_service import (
    InvalidConfirmationToken,
    create_confirmation_token,
    verify_confirmation_token,
)


def test_confirmation_token_is_bound_to_session_arguments_and_idempotency():
    token, created = create_confirmation_token(
        session_id="a" * 40,
        tool="add_to_cart_tool",
        arguments={"product_id": "Product_1", "quantity": 2},
        now=1_000,
    )

    verified = verify_confirmation_token(
        token,
        session_id="a" * 40,
        now=1_001,
    )

    assert verified == created
    assert verified.arguments == {"product_id": "Product_1", "quantity": 2}
    assert verified.idempotency_key.startswith("chat:")


def test_confirmation_token_rejects_tampering_other_session_and_expiry():
    token, _ = create_confirmation_token(
        session_id="a" * 40,
        tool="create_order_tool",
        arguments={},
        now=1_000,
    )
    payload, signature = token.split(".", 1)

    with pytest.raises(InvalidConfirmationToken):
        verify_confirmation_token(
            f"{payload[:-1]}x.{signature}",
            session_id="a" * 40,
            now=1_001,
        )

    with pytest.raises(InvalidConfirmationToken):
        verify_confirmation_token(
            token,
            session_id="b" * 40,
            now=1_001,
        )

    with pytest.raises(InvalidConfirmationToken):
        verify_confirmation_token(
            token,
            session_id="a" * 40,
            now=1_300,
        )


def test_non_mutating_tool_cannot_be_signed_for_confirmation():
    with pytest.raises(ValueError):
        create_confirmation_token(
            session_id="a" * 40,
            tool="navigate_tool",
            arguments={"target": "/catalog"},
        )
