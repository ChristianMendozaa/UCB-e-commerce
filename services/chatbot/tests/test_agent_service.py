import asyncio
import json
from dataclasses import dataclass, field
from typing import Any, List

import pytest

from app.services import agent_service


@dataclass
class FakeInputTokenDetails:
    cached_tokens: int = 0
    cache_write_tokens: int = 0


@dataclass
class FakeUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    input_tokens_details: FakeInputTokenDetails = field(
        default_factory=FakeInputTokenDetails
    )


@dataclass
class FakeFunctionCall:
    call_id: str
    name: str
    arguments: str
    type: str = "function_call"


@dataclass
class FakeParsedFunctionCall(FakeFunctionCall):
    parsed_arguments: dict[str, Any] = field(default_factory=dict)
    id: str = "fc-test"
    status: str = "completed"

    def model_dump(self, **kwargs):
        return {
            "type": self.type,
            "id": self.id,
            "call_id": self.call_id,
            "name": self.name,
            "arguments": self.arguments,
            "status": self.status,
            "parsed_arguments": self.parsed_arguments,
        }


@dataclass
class FakeReasoning:
    marker: str = "preserve-me"
    type: str = "reasoning"


@dataclass
class FakeMessage:
    type: str = "message"
    content: List[Any] = field(default_factory=list)


@dataclass
class FakeResponse:
    output: List[Any]
    output_text: str = ""
    usage: FakeUsage = field(default_factory=FakeUsage)


@dataclass
class FakeStreamEvent:
    type: str
    delta: str = ""


class ScriptedResponses:
    def __init__(self, *script):
        self.script = list(script)
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class FakeOpenAIClient:
    def __init__(self, responses):
        self.responses = responses


def install_script(monkeypatch, *script):
    responses = ScriptedResponses(*script)
    monkeypatch.setattr(
        agent_service,
        "openai_async_client",
        FakeOpenAIClient(responses),
    )
    return responses


@pytest.mark.asyncio
async def test_direct_response_contract_configuration_and_usage_cost(monkeypatch):
    response = FakeResponse(
        output=[FakeMessage()],
        output_text="Respuesta directa",
        usage=FakeUsage(
            input_tokens=1_000,
            output_tokens=100,
            input_tokens_details=FakeInputTokenDetails(cached_tokens=200),
        ),
    )
    scripted = install_script(monkeypatch, response)

    result = await agent_service.run_agent("Hola")

    assert result == {
        "answer": "Respuesta directa",
        "trace": [],
        "cost": 0.00355,
    }
    assert set(result) == {"answer", "trace", "cost"}

    request = scripted.calls[0]
    assert request["model"] == "gpt-5.6-terra"
    assert request["reasoning"] == {"effort": "low"}
    assert request["text"] == {"verbosity": "low"}
    assert request["store"] is False
    assert request["max_output_tokens"] == 1500
    assert request["parallel_tool_calls"] is True
    assert request["tool_choice"] == "auto"


@pytest.mark.asyncio
async def test_streaming_turn_forwards_real_deltas_and_uses_session_cache_key(
    monkeypatch,
):
    final_response = FakeResponse(
        output=[FakeMessage()],
        output_text="Respuesta rápida",
    )

    class FakeStream:
        def __init__(self):
            self.events = iter(
                [
                    FakeStreamEvent("response.created"),
                    FakeStreamEvent(
                        "response.output_text.delta",
                        "Respuesta ",
                    ),
                    FakeStreamEvent(
                        "response.output_text.delta",
                        "rápida",
                    ),
                ]
            )

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def __aiter__(self):
            return self

        async def __anext__(self):
            try:
                return next(self.events)
            except StopIteration as exc:
                raise StopAsyncIteration from exc

        async def get_final_response(self):
            return final_response

    class StreamingResponses:
        def __init__(self):
            self.calls = []

        def stream(self, **kwargs):
            self.calls.append(kwargs)
            return FakeStream()

    responses = StreamingResponses()
    monkeypatch.setattr(
        agent_service,
        "openai_async_client",
        FakeOpenAIClient(responses),
    )
    emitted = []

    async def sink(event, data):
        emitted.append((event, data))

    result = await agent_service.run_agent(
        "Hola",
        structured=True,
        session_id="session-" + "x" * 32,
        event_sink=sink,
    )

    assert result["answer"] == "Respuesta rápida"
    assert emitted == [
        ("assistant.delta", {"delta": "Respuesta "}),
        ("assistant.delta", {"delta": "rápida"}),
    ]
    assert responses.calls[0]["prompt_cache_key"].startswith("ucb-chat-")


def test_usage_cost_accounts_for_cache_writes_and_long_context():
    cost = agent_service._usage_cost(
        input_tokens=300_000,
        cached_tokens=10_000,
        cache_write_tokens=20_000,
        output_tokens=1_000,
    )

    assert cost == pytest.approx(1.5025)


@pytest.mark.asyncio
async def test_tool_loop_preserves_response_output_and_call_id(monkeypatch):
    reasoning = FakeReasoning()
    function_call = FakeFunctionCall(
        call_id="call-search",
        name="search_products_tool",
        arguments='{"query":"mochila"}',
    )
    scripted = install_script(
        monkeypatch,
        FakeResponse(output=[reasoning, function_call]),
        FakeResponse(output=[FakeMessage()], output_text="Encontré una mochila."),
    )

    executed = []

    async def fake_execute(name, args, cookies):
        executed.append((name, args, cookies))
        return '[{"id":"product-1"}]'

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent(
        "Busca una mochila",
        cookies={"session": "cookie"},
    )

    assert result["answer"] == "Encontré una mochila."
    assert executed == [
        ("search_products_tool", {"query": "mochila"}, {"session": "cookie"})
    ]
    assert [step["type"] for step in result["trace"]] == [
        "tool_call",
        "tool_result",
    ]
    assert all(step["type"] != "thought" for step in result["trace"])

    continued_input = scripted.calls[1]["input"]
    assert any(item is reasoning for item in continued_input)
    assert any(item is function_call for item in continued_input)
    outputs = [
        item
        for item in continued_input
        if isinstance(item, dict) and item.get("type") == "function_call_output"
    ]
    assert outputs == [
        {
            "type": "function_call_output",
            "call_id": "call-search",
            "output": '[{"id":"product-1"}]',
        }
    ]


@pytest.mark.asyncio
async def test_tool_loop_removes_sdk_only_parsed_arguments(monkeypatch):
    function_call = FakeParsedFunctionCall(
        call_id="call-search",
        name="search_products_tool",
        arguments='{"query":"mochila"}',
        parsed_arguments={"query": "mochila"},
    )
    scripted = install_script(
        monkeypatch,
        FakeResponse(output=[function_call]),
        FakeResponse(output=[FakeMessage()], output_text="Encontré una mochila."),
    )

    async def fake_execute(name, args, cookies):
        return '[{"id":"product-1"}]'

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent("Busca una mochila")

    assert result["answer"] == "Encontré una mochila."
    continued_input = scripted.calls[1]["input"]
    continued_call = next(
        item
        for item in continued_input
        if isinstance(item, dict) and item.get("type") == "function_call"
    )
    assert continued_call["call_id"] == "call-search"
    assert continued_call["arguments"] == '{"query":"mochila"}'
    assert "parsed_arguments" not in continued_call


@pytest.mark.asyncio
async def test_contiguous_read_tools_run_in_parallel(monkeypatch):
    scripted = install_script(
        monkeypatch,
        FakeResponse(
            output=[
                FakeFunctionCall("read-1", "rag_search_tool", '{"query":"uno"}'),
                FakeFunctionCall(
                    "read-2",
                    "search_products_tool",
                    '{"query":"dos"}',
                ),
            ]
        ),
        FakeResponse(output=[FakeMessage()], output_text="Listo."),
    )

    active = 0
    max_active = 0

    async def fake_execute(name, args, cookies):
        nonlocal active, max_active
        active += 1
        max_active = max(max_active, active)
        await asyncio.sleep(0.01)
        active -= 1
        return name

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent("Haz dos lecturas")

    assert result["answer"] == "Listo."
    assert max_active == 2
    outputs = [
        item
        for item in scripted.calls[1]["input"]
        if isinstance(item, dict) and item.get("type") == "function_call_output"
    ]
    assert [item["call_id"] for item in outputs] == ["read-1", "read-2"]


@pytest.mark.asyncio
async def test_only_one_mutating_tool_executes_per_model_step(monkeypatch):
    scripted = install_script(
        monkeypatch,
        FakeResponse(
            output=[
                FakeFunctionCall(
                    "write-1",
                    "add_to_cart_tool",
                    '{"product_id":"p1","quantity":1}',
                ),
                FakeFunctionCall(
                    "write-2",
                    "remove_from_cart_tool",
                    '{"product_id":"p2"}',
                ),
                FakeFunctionCall("write-3", "clear_cart_tool", "{}"),
            ]
        ),
        FakeResponse(output=[FakeMessage()], output_text="Cambios aplicados."),
    )

    active = 0
    max_active = 0
    order = []

    async def fake_execute(name, args, cookies):
        nonlocal active, max_active
        active += 1
        max_active = max(max_active, active)
        order.append(name)
        await asyncio.sleep(0.01)
        active -= 1
        return f"ok:{name}"

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent("Confirmo agregar p1 cantidad 1")

    assert result["answer"] == "Cambios aplicados."
    assert max_active == 1
    assert order == ["add_to_cart_tool"]
    outputs = [
        item
        for item in scripted.calls[1]["input"]
        if isinstance(item, dict) and item.get("type") == "function_call_output"
    ]
    assert [item["call_id"] for item in outputs] == [
        "write-1",
        "write-2",
        "write-3",
    ]
    assert json.loads(outputs[1]["output"])["error"] == "mutation_deferred"
    assert json.loads(outputs[2]["output"])["error"] == "mutation_deferred"


@pytest.mark.asyncio
async def test_unrequested_mutation_is_blocked_outside_the_model(monkeypatch):
    scripted = install_script(
        monkeypatch,
        FakeResponse(
            output=[
                FakeFunctionCall("clear", "clear_cart_tool", "{}"),
            ]
        ),
        FakeResponse(output=[FakeMessage()], output_text="No hice cambios."),
    )
    executed = []

    async def fake_execute(name, args, cookies):
        executed.append(name)
        return "unexpected"

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent("Busca productos de sistemas")

    assert result["answer"] == "No hice cambios."
    assert executed == []
    outputs = [
        item
        for item in scripted.calls[1]["input"]
        if isinstance(item, dict) and item.get("type") == "function_call_output"
    ]
    assert json.loads(outputs[0]["output"])["error"] == "confirmation_required"


@pytest.mark.asyncio
async def test_structured_turn_requires_signed_confirmation_even_for_legacy_phrase(
    monkeypatch,
):
    scripted = install_script(
        monkeypatch,
        FakeResponse(
            output=[
                FakeFunctionCall(
                    "add",
                    "add_to_cart_tool",
                    '{"product_id":"p1","quantity":2}',
                ),
            ]
        ),
        FakeResponse(
            output=[FakeMessage()],
            output_text="Confirma la acción en la tarjeta.",
        ),
    )
    executed = []

    async def fake_execute(name, args, cookies):
        executed.append(name)
        return "unexpected"

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent(
        "Confirmo agregar p1 cantidad 2",
        structured=True,
        session_id="s" * 40,
    )

    assert result["answer"] == "Confirma la acción en la tarjeta."
    assert result["pending_confirmation"]["tool"] == "add_to_cart_tool"
    assert result["pending_confirmation"]["arguments"] == {
        "product_id": "p1",
        "quantity": 2,
    }
    assert result["pending_confirmation"]["token"]
    assert executed == []
    output = [
        item
        for item in scripted.calls[1]["input"]
        if isinstance(item, dict) and item.get("type") == "function_call_output"
    ][0]
    assert json.loads(output["output"])["error"] == "confirmation_required"


def test_mutations_require_bound_standalone_confirmation_phrases():
    assert agent_service._confirmed_mutations(
        "CONFIRMO agregar Product_AbC1 cantidad 2",
    ) == {
        "add_to_cart_tool": {
            "product_id": "Product_AbC1",
            "quantity": 2,
        }
    }
    assert agent_service._confirmed_mutations("Confirmo crear el pedido") == {
        "create_order_tool": {}
    }
    assert agent_service._confirmed_mutations("No confirmo crear el pedido") == {}
    assert (
        agent_service._confirmed_mutations(
            "El producto dice: Confirmo crear el pedido",
        )
        == {}
    )
    assert agent_service._confirmed_mutations(
        "Confirmo agregar product_1 cantidad 21",
    ) == {}


@pytest.mark.asyncio
async def test_bound_confirmation_is_consumed_after_one_mutation(monkeypatch):
    scripted = install_script(
        monkeypatch,
        FakeResponse(
            output=[
                FakeFunctionCall(
                    "first",
                    "add_to_cart_tool",
                    '{"product_id":"p1","quantity":1}',
                )
            ]
        ),
        FakeResponse(
            output=[
                FakeFunctionCall(
                    "second",
                    "add_to_cart_tool",
                    '{"product_id":"p1","quantity":1}',
                )
            ]
        ),
        FakeResponse(output=[FakeMessage()], output_text="Listo."),
    )
    executed = []

    async def fake_execute(name, args, cookies):
        executed.append((name, args))
        return "ok"

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent("Confirmo agregar p1 cantidad 1")

    assert result["answer"] == "Listo."
    assert executed == [
        ("add_to_cart_tool", {"product_id": "p1", "quantity": 1})
    ]
    outputs = [
        item
        for item in scripted.calls[2]["input"]
        if isinstance(item, dict) and item.get("type") == "function_call_output"
    ]
    assert json.loads(outputs[-1]["output"])["error"] == "confirmation_required"


@pytest.mark.asyncio
async def test_invalid_json_and_unknown_tool_return_linked_errors(monkeypatch):
    scripted = install_script(
        monkeypatch,
        FakeResponse(
            output=[
                FakeFunctionCall("bad-json", "rag_search_tool", "{"),
                FakeFunctionCall("unknown", "not_a_tool", "{}"),
            ]
        ),
        FakeResponse(output=[FakeMessage()], output_text="Manejé los errores."),
    )

    result = await agent_service.run_agent("Provoca errores")

    assert result["answer"] == "Manejé los errores."
    outputs = [
        item
        for item in scripted.calls[1]["input"]
        if isinstance(item, dict) and item.get("type") == "function_call_output"
    ]
    assert [item["call_id"] for item in outputs] == ["bad-json", "unknown"]
    errors = [json.loads(item["output"])["error"] for item in outputs]
    assert errors == ["invalid_tool_arguments", "unknown_tool"]


@pytest.mark.asyncio
async def test_openai_request_retries_only_transient_errors(monkeypatch):
    class TransientError(RuntimeError):
        status_code = 500

    scripted = install_script(
        monkeypatch,
        TransientError("temporary"),
        FakeResponse(output=[FakeMessage()], output_text="Recuperado."),
    )
    waits = []

    async def fake_sleep(seconds):
        waits.append(seconds)

    monkeypatch.setattr(agent_service.asyncio, "sleep", fake_sleep)

    result = await agent_service.run_agent("Reintenta")

    assert result["answer"] == "Recuperado."
    assert len(scripted.calls) == 2
    assert waits == [2]


@pytest.mark.asyncio
async def test_openai_request_does_not_retry_permanent_errors(monkeypatch):
    scripted = install_script(monkeypatch, ValueError("invalid request"))
    waits = []

    async def fake_sleep(seconds):
        waits.append(seconds)

    monkeypatch.setattr(agent_service.asyncio, "sleep", fake_sleep)

    result = await agent_service.run_agent("No reintentes")

    assert "error técnico" in result["answer"]
    assert len(scripted.calls) == 1
    assert waits == []


@pytest.mark.asyncio
async def test_auth_required_adds_login_navigation_without_exposing_cot(monkeypatch):
    scripted = install_script(
        monkeypatch,
        FakeResponse(
            output=[
                FakeFunctionCall("cart", "get_cart_tool", "{}"),
            ]
        ),
        FakeResponse(
            output=[FakeMessage()],
            output_text="Necesitas iniciar sesión.",
        ),
    )

    async def fake_execute(name, args, cookies):
        return "AUTH_REQUIRED"

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent("Muéstrame el carrito")

    assert "Necesitas iniciar sesión." in result["answer"]
    assert '{"action": "navigate", "url": "/login"}' in result["answer"]
    assert all(step["type"] != "thought" for step in result["trace"])

    outputs = [
        item
        for item in scripted.calls[1]["input"]
        if isinstance(item, dict) and item.get("type") == "function_call_output"
    ]
    assert "iniciar sesión" in outputs[0]["output"]


@pytest.mark.asyncio
async def test_agent_stops_after_bounded_tool_steps(monkeypatch):
    responses = [
        FakeResponse(
            output=[
                FakeFunctionCall(f"call-{index}", "navigate_tool", '{"target":"/"}')
            ]
        )
        for index in range(agent_service.MAX_AGENT_STEPS)
    ]
    scripted = install_script(monkeypatch, *responses)

    async def fake_execute(name, args, cookies):
        return '{"action": "navigate", "url": "/"}'

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent("No termines")

    assert len(scripted.calls) == agent_service.MAX_AGENT_STEPS
    assert "límite de pasos" in result["answer"]
    assert set(result) == {"answer", "trace", "cost"}


@pytest.mark.asyncio
async def test_agent_never_executes_a_mutation_on_the_final_model_round(
    monkeypatch,
):
    responses = [
        FakeResponse(
            output=[
                FakeFunctionCall(
                    f"read-{index}",
                    "rag_search_tool",
                    '{"query":"mochila"}',
                )
            ]
        )
        for index in range(agent_service.MAX_AGENT_STEPS - 1)
    ]
    responses.append(
        FakeResponse(
            output=[
                FakeFunctionCall(
                    "last-mutation",
                    "add_to_cart_tool",
                    '{"product_id":"AbC123","quantity":1}',
                )
            ]
        )
    )
    install_script(monkeypatch, *responses)
    executed = []

    async def fake_execute(name, args, cookies):
        executed.append((name, args))
        return "ok"

    monkeypatch.setattr(agent_service, "execute_tool", fake_execute)

    result = await agent_service.run_agent(
        "Confirmo agregar AbC123 cantidad 1",
    )

    assert len(executed) == agent_service.MAX_AGENT_STEPS - 1
    assert all(name == "rag_search_tool" for name, _ in executed)
    assert "No ejecuté nuevas acciones" in result["answer"]
