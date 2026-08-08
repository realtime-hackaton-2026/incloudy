import asyncio
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.auth import create_access_token, decode_access_token
from app.models import Student
from app.schemas import CaseCreate, RegisterRequest, StationInput
from app.services.ai import build_prompt
from app.services import portal as portal_service
from app.ws import ConnectionManager


def test_access_token_round_trip() -> None:
    token = create_access_token("profesor-123")
    assert decode_access_token(token) == "profesor-123"


def test_registration_requires_a_secure_minimum_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(email="profesor@example.com", password="1234567")


def test_case_rejects_duplicate_station_order() -> None:
    with pytest.raises(ValidationError):
        CaseCreate(
            alumno=Student(nombre="Ana"),
            estaciones=[
                StationInput(orden=1, titulo="Inicio"),
                StationInput(orden=1, titulo="Seguimiento"),
            ],
        )


def test_prompt_contains_case_context() -> None:
    case = SimpleNamespace(
        profesor_id="profesor-123",
        alumno=Student(nombre="Ana", edad=10, curso="Quinto"),
        estaciones=[SimpleNamespace(titulo="Observación")],
    )
    prompt = build_prompt("¿Cómo puedo ayudarla?", case)

    assert "Ana" in prompt
    assert "Observación" in prompt
    assert "¿Cómo puedo ayudarla?" in prompt


def test_websocket_message_is_private_to_its_user() -> None:
    class FakeWebSocket:
        def __init__(self) -> None:
            self.messages: list[dict] = []

        async def send_json(self, message: dict) -> None:
            self.messages.append(message)

    manager = ConnectionManager()
    first_user_socket = FakeWebSocket()
    second_user_socket = FakeWebSocket()
    manager.active_connections = {
        "user-1": [first_user_socket],
        "user-2": [second_user_socket],
    }

    asyncio.run(manager.send_to_user("user-1", {"event": "case_published"}))

    assert first_user_socket.messages == [{"event": "case_published"}]
    assert second_user_socket.messages == []


def test_portal_session_is_restricted_to_the_case_channel(monkeypatch) -> None:
    requests: list[tuple[str, dict]] = []

    async def fake_portal_post(path: str, payload: dict) -> dict:
        requests.append((path, payload))
        if path == "/v1/tokens":
            return {"token": "portal-jwt", "expiresAt": "2026-08-08T00:00:00Z"}
        return {"added": 1}

    monkeypatch.setattr(portal_service, "portal_post", fake_portal_post)
    monkeypatch.setattr(portal_service.settings, "portal_publishable_key", "pk_test")
    user = SimpleNamespace(id="user-1", email="teacher@example.com")
    case = SimpleNamespace(id="case-1")

    session = asyncio.run(portal_service.create_case_session(user, case))

    assert session.channel_id == "case-case-1"
    assert session.token == "portal-jwt"
    assert requests[0][0] == "/v1/channels/case-case-1/members"
    assert requests[1][1]["channels"] == {
        "case-case-1": ["connect", "publish"]
    }
