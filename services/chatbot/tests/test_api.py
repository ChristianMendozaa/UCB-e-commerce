import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import chat as chat_router


def test_chat_preserves_request_and_response_contract(monkeypatch):
    captured = {}

    async def fake_run_agent(question, cookies, history, current_page):
        captured.update(
            {
                "question": question,
                "cookies": dict(cookies),
                "history": history,
                "current_page": current_page,
            }
        )
        return {
            "answer": "Respuesta",
            "trace": [{"type": "tool_result", "step": 1}],
            "cost": 0.001,
        }

    monkeypatch.setattr(chat_router, "run_agent", fake_run_agent)

    with TestClient(app) as client:
        client.cookies.set("custom_session", "test-cookie")
        response = client.post(
            "/chat",
            json={
                "question": "Hola",
                "history": [{"sender": "user", "text": "Antes"}],
                "current_page": "/catalog",
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "answer": "Respuesta",
        "trace": [{"type": "tool_result", "step": 1}],
        "cost": 0.001,
    }
    assert captured == {
        "question": "Hola",
        "cookies": {"custom_session": "test-cookie"},
        "history": [{"sender": "user", "text": "Antes"}],
        "current_page": "/catalog",
    }


def test_chat_requires_question():
    with TestClient(app) as client:
        response = client.post("/chat", json={})

    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"question": 123},
        {"question": "   "},
        {"question": "Hola", "unexpected": True},
        {"question": "Hola", "history": "not-a-list"},
        {
            "question": "Hola",
            "history": [{"sender": "assistant", "text": "No permitido"}],
        },
        {
            "question": "Hola",
            "history": [{"sender": "user", "text": "Bien", "extra": "no"}],
        },
        {"question": "Hola", "current_page": "https://evil.example/catalog"},
        {"question": "Hola", "current_page": "//evil.example/catalog"},
        {"question": "Hola", "current_page": "/products/%2e%2e"},
        {"question": "Hola", "current_page": "/unknown"},
    ],
)
def test_chat_rejects_non_strict_or_unsafe_payloads(payload):
    with TestClient(app) as client:
        response = client.post("/chat", json=payload)

    assert response.status_code == 422


def test_chat_enforces_question_and_history_bounds():
    with TestClient(app) as client:
        question_response = client.post(
            "/chat",
            json={"question": "x" * 2_001},
        )
        history_response = client.post(
            "/chat",
            json={
                "question": "Hola",
                "history": [
                    {"sender": "user", "text": f"Mensaje {index}"}
                    for index in range(21)
                ],
            },
        )

    assert question_response.status_code == 422
    assert history_response.status_code == 422


def test_chat_allows_known_admin_current_page(monkeypatch):
    captured = {}

    async def fake_run_agent(question, cookies, history, current_page):
        captured["current_page"] = current_page
        return {"answer": "Respuesta", "trace": [], "cost": 0}

    monkeypatch.setattr(chat_router, "run_agent", fake_run_agent)

    with TestClient(app) as client:
        response = client.post(
            "/chat",
            json={"question": "Hola", "current_page": "/admin"},
        )

    assert response.status_code == 200
    assert captured["current_page"] == "/admin"


def test_health():
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_v2_turn_streams_structured_events(monkeypatch):
    async def fake_run_agent(*args, **kwargs):
        assert kwargs["structured"] is True
        assert kwargs["session_id"]
        assert kwargs["page_context"]["surface"] == "catalog"
        await kwargs["event_sink"](
            "tool.status",
            {
                "phase": "started",
                "step": 1,
                "tools": ["search_products_tool"],
                "message": "Consultando el catálogo actual…",
            },
        )
        await kwargs["event_sink"](
            "assistant.delta",
            {"delta": "Encontré opciones."},
        )
        return {
            "answer": "Encontré opciones.",
            "trace": [],
            "cost": 0.001,
            "ui_actions": [
                {
                    "id": "action-1",
                    "version": 1,
                    "type": "catalog.apply_filters",
                    "payload": {"filters": {"query": "mochila"}},
                }
            ],
            "renderables": [],
            "pending_confirmation": None,
        }

    monkeypatch.setattr(chat_router, "run_agent", fake_run_agent)

    with TestClient(app) as client:
        response = client.post(
            "/chat/turns",
            json={
                "question": "Busca una mochila",
                "page_context": {
                    "route": "/catalog",
                    "surface": "catalog",
                    "revision": 1,
                    "capabilities": ["catalog.apply_filters"],
                    "state": {},
                },
            },
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: turn.started" in response.text
    assert "event: assistant.delta" in response.text
    assert "event: tool.status" in response.text
    assert "event: ui.action" in response.text
    assert "event: turn.completed" in response.text
    assert response.cookies.get("ucb_chat_session")
