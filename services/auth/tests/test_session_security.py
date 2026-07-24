import asyncio
import importlib.util
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from http.cookies import SimpleCookie
from pathlib import Path
from unittest.mock import Mock, call

import pytest
from app.deps import auth as auth_deps
from app.routers import auth as auth_router
from app.routers import users as users_router
from app.schemas.auth import GoogleIdpLogin
from fastapi import HTTPException, Response
from starlette.requests import Request

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def _request_with_cookie(value: str) -> Request:
    return Request(
        {
            "type": "http",
            "headers": [
                (
                    b"cookie",
                    f"{auth_router.SESSION_COOKIE_NAME}={value}".encode(),
                )
            ],
        }
    )


def _session_cookie(response: Response):
    headers = response.headers.getlist("set-cookie")
    assert len(headers) == 1
    parsed = SimpleCookie()
    parsed.load(headers[0])
    return parsed[auth_router.SESSION_COOKIE_NAME]


def _load_service_auth_helper(service: str):
    path = REPOSITORY_ROOT / "services" / service / "app" / "deps" / "auth.py"
    spec = importlib.util.spec_from_file_location(f"{service}_auth_helper", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_login_verification_checks_revocation(monkeypatch):
    verify = Mock(return_value={"uid": "user-1"})
    monkeypatch.setattr(auth_router.fb_auth, "verify_id_token", verify)

    assert auth_router._verify_id_token_with_skew("fresh-token") == {"uid": "user-1"}
    verify.assert_called_once_with("fresh-token", check_revoked=True)


def test_login_skew_retry_keeps_revocation_check(monkeypatch):
    verify = Mock(
        side_effect=[
            ValueError("Token used too early"),
            {"uid": "user-1"},
        ]
    )
    monkeypatch.setattr(auth_router.fb_auth, "verify_id_token", verify)

    assert auth_router._verify_id_token_with_skew("fresh-token", 15) == {
        "uid": "user-1"
    }
    assert verify.call_args_list == [
        call("fresh-token", check_revoked=True),
        call(
            "fresh-token",
            check_revoked=True,
            clock_skew_seconds=15,
        ),
    ]


def test_login_cookie_expires_with_the_firebase_session(monkeypatch):
    monkeypatch.setattr(
        auth_router,
        "_verify_id_token_with_skew",
        Mock(return_value={"uid": "user-1"}),
    )
    monkeypatch.setattr(
        auth_router.fb_auth,
        "create_session_cookie",
        Mock(return_value="signed-session"),
    )
    monkeypatch.setattr(auth_router, "best_effort_materialize", Mock())
    monkeypatch.setattr(auth_router, "ensure_default_student", Mock())
    response = Response()

    result = asyncio.run(
        auth_router.google_login_or_register(
            GoogleIdpLogin(provider_id_token="fresh-token"),
            response,
        )
    )

    assert result["ok"] is True
    cookie = _session_cookie(response)
    expected_seconds = int(auth_router.SESSION_EXPIRES_DELTA.total_seconds())
    assert int(cookie["max-age"]) == expected_seconds
    expires_at = parsedate_to_datetime(cookie["expires"])
    remaining = (expires_at - datetime.now(timezone.utc)).total_seconds()
    assert expected_seconds - 5 <= remaining <= expected_seconds + 5
    assert cookie["httponly"] is True
    assert cookie["samesite"] == "lax"


def test_login_rejects_provider_error_without_leaking_it(monkeypatch):
    monkeypatch.setattr(
        auth_router,
        "_verify_id_token_with_skew",
        Mock(side_effect=ValueError("private Firebase project detail")),
    )

    with pytest.raises(HTTPException) as captured:
        asyncio.run(
            auth_router.google_login_or_register(
                GoogleIdpLogin(provider_id_token="bad-token"),
                Response(),
            )
        )

    assert captured.value.status_code == 401
    assert captured.value.detail == "ID token inválido o revocado."


def test_logout_revokes_user_sessions_and_expires_exact_cookie(monkeypatch):
    verify = Mock(return_value={"uid": "user-1"})
    revoke = Mock()
    monkeypatch.setattr(auth_router.fb_auth, "verify_session_cookie", verify)
    monkeypatch.setattr(auth_router.fb_auth, "revoke_refresh_tokens", revoke)
    response = Response()

    result = auth_router.logout(response, _request_with_cookie("signed-session"))

    assert result == {"ok": True}
    verify.assert_called_once_with("signed-session", check_revoked=False)
    revoke.assert_called_once_with("user-1")
    cookie = _session_cookie(response)
    assert cookie.value == ""
    assert cookie["max-age"] == "0"
    assert cookie["path"] == "/"


def test_logout_still_expires_cookie_when_revocation_fails(monkeypatch):
    monkeypatch.setattr(
        auth_router.fb_auth,
        "verify_session_cookie",
        Mock(return_value={"uid": "user-1"}),
    )
    monkeypatch.setattr(
        auth_router.fb_auth,
        "revoke_refresh_tokens",
        Mock(side_effect=RuntimeError("temporary provider failure")),
    )
    response = Response()

    assert auth_router.logout(
        response,
        _request_with_cookie("signed-session"),
    ) == {"ok": True}
    assert _session_cookie(response)["max-age"] == "0"


def test_account_deletion_continues_when_predelete_revocation_fails(monkeypatch):
    revoke = Mock(side_effect=RuntimeError("temporary provider failure"))
    delete_user = Mock()
    delete_profile = Mock()
    role_document = Mock()
    firestore = Mock()
    firestore.collection.return_value.document.return_value = role_document
    monkeypatch.setattr(users_router.fb_auth, "revoke_refresh_tokens", revoke)
    monkeypatch.setattr(users_router.fb_auth, "delete_user", delete_user)
    monkeypatch.setattr(users_router, "delete_profile", delete_profile)
    monkeypatch.setattr(users_router, "firestore_db", firestore)
    response = Response()

    assert users_router.delete_my_account(
        response,
        current={"uid": "user-1"},
    ) == {"ok": True}

    delete_user.assert_called_once_with("user-1")
    delete_profile.assert_called_once_with("user-1")
    firestore.collection.assert_called_once_with("roles")
    role_document.delete.assert_called_once_with()
    cookie = _session_cookie(response)
    assert cookie["max-age"] == "0"


def test_account_deletion_attempts_roles_cleanup_when_profile_cleanup_fails(
    monkeypatch,
):
    role_document = Mock()
    firestore = Mock()
    firestore.collection.return_value.document.return_value = role_document
    monkeypatch.setattr(users_router.fb_auth, "revoke_refresh_tokens", Mock())
    monkeypatch.setattr(users_router.fb_auth, "delete_user", Mock())
    monkeypatch.setattr(
        users_router,
        "delete_profile",
        Mock(side_effect=RuntimeError("temporary Firestore failure")),
    )
    monkeypatch.setattr(users_router, "firestore_db", firestore)

    assert users_router.delete_my_account(
        Response(),
        current={"uid": "user-1"},
    ) == {"ok": True}
    role_document.delete.assert_called_once_with()


def test_account_deletion_does_not_leak_provider_errors(monkeypatch):
    monkeypatch.setattr(users_router.fb_auth, "revoke_refresh_tokens", Mock())
    monkeypatch.setattr(
        users_router.fb_auth,
        "delete_user",
        Mock(side_effect=RuntimeError("private Firebase project detail")),
    )

    with pytest.raises(HTTPException) as captured:
        users_router.delete_my_account(
            Response(),
            current={"uid": "user-1"},
        )

    assert captured.value.status_code == 502
    assert captured.value.detail == "No se pudo borrar la cuenta en Firebase Auth."


def test_auth_dependency_does_not_leak_verification_errors(monkeypatch):
    monkeypatch.setattr(
        auth_deps,
        "_verify_id_token_with_skew",
        Mock(side_effect=ValueError("private Firebase project detail")),
    )
    request = Request({"type": "http", "headers": []})

    with pytest.raises(HTTPException) as captured:
        asyncio.run(
            auth_deps.get_current_user(
                request,
                authorization="Bearer invalid-token",
            )
        )

    assert captured.value.status_code == 401
    assert captured.value.detail == "Token inválido o revocado."


def test_auth_dependency_helpers_check_revocation(monkeypatch):
    verify_session = Mock(return_value={"uid": "user-1"})
    verify_id_token = Mock(return_value={"uid": "user-1"})
    monkeypatch.setattr(
        auth_deps.fb_auth,
        "verify_session_cookie",
        verify_session,
    )
    monkeypatch.setattr(
        auth_deps.fb_auth,
        "verify_id_token",
        verify_id_token,
    )

    assert auth_deps._verify_session_with_skew("session") == {"uid": "user-1"}
    assert auth_deps._verify_id_token_with_skew("id-token") == {"uid": "user-1"}
    verify_session.assert_called_once_with("session", check_revoked=True)
    verify_id_token.assert_called_once_with("id-token", check_revoked=True)


@pytest.mark.parametrize("service", ["products", "orders"])
def test_downstream_auth_helpers_check_revocation(service, monkeypatch):
    helper = _load_service_auth_helper(service)
    verify_session = Mock(return_value={"uid": "user-1"})
    verify_id_token = Mock(return_value={"uid": "user-1"})
    monkeypatch.setattr(helper.fb_auth, "verify_session_cookie", verify_session)
    monkeypatch.setattr(helper.fb_auth, "verify_id_token", verify_id_token)

    assert helper._verify_session_with_skew("session") == {"uid": "user-1"}
    assert helper._verify_id_token_with_skew("id-token") == {"uid": "user-1"}
    verify_session.assert_called_once_with("session", check_revoked=True)
    verify_id_token.assert_called_once_with("id-token", check_revoked=True)
