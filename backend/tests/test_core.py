import asyncio
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.auth import create_access_token, decode_access_token
from app.models import Student
from app.schemas import CaseCreate, RegisterRequest, StationInput
from app.services.ai import build_prompt
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
