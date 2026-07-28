import pytest

from app.services.http_client import close_http_client, get_http_client


@pytest.mark.asyncio
async def test_http_client_is_reused_and_can_be_recreated_after_shutdown():
    first = get_http_client()
    second = get_http_client()

    assert first is second

    await close_http_client()
    replacement = get_http_client()

    assert replacement is not first
    await close_http_client()
