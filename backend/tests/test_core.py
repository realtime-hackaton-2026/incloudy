import asyncio
import hashlib
import hmac
import json
import time
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.auth import create_access_token, decode_access_token
from app.models import (
    CaseProgress,
    CaseStatus,
    Collaborator,
    CollaboratorRole,
    QuestionType,
    StationOption,
    StationResponse,
    Student,
    TemplateStation,
)
from app.schemas import CaseCreate, JourneyTemplateCreate, RegisterRequest
from app.services import portal as portal_service
from app.services.ai import build_case_context
from app.services.cases import calculate_progress
from app.services.webhooks import verify_portal_signature


def sample_stations() -> list[TemplateStation]:
    return [
        TemplateStation(
            id="observar",
            orden=1,
            titulo="Observar",
            tipo=QuestionType.single,
            opciones=[StationOption(id="atencion", texto="Dificultad de atención")],
        ),
        TemplateStation(
            id="actuar",
            orden=2,
            titulo="Actuar",
            tipo=QuestionType.multiple,
            opciones=[StationOption(id="rutina", texto="Usar rutina visual")],
        ),
    ]


def test_access_token_round_trip() -> None:
    token = create_access_token("profesor-123")
    assert decode_access_token(token) == "profesor-123"


def test_registration_requires_name_and_secure_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(nombre="", email="profesor@example.com", password="1234567")


def test_case_requires_fictional_student_and_privacy_confirmation() -> None:
    with pytest.raises(ValidationError):
        CaseCreate(
            alumno=Student(nombre="Ana", es_ficticio=False),
            privacy_acknowledged=True,
        )


def test_template_rejects_duplicate_station_order() -> None:
    stations = sample_stations()
    stations[1].orden = 1
    with pytest.raises(ValidationError):
        JourneyTemplateCreate(
            nombre="Recorrido",
            version=1,
            estaciones=stations,
        )


def test_progress_uses_required_station_responses() -> None:
    template = SimpleNamespace(estaciones=sample_stations())
    case = SimpleNamespace(
        respuestas=[
            StationResponse(
                estacion_id="observar",
                opciones_seleccionadas=["atencion"],
                respondido_por="user-1",
            )
        ]
    )
    assert calculate_progress(case, template) == CaseProgress(
        completadas=1,
        total=2,
        porcentaje=50,
    )


def test_ai_context_uses_selected_option_text() -> None:
    template = SimpleNamespace(estaciones=sample_stations())
    case = SimpleNamespace(
        alumno=Student(nombre="Ana", edad=10, curso="Quinto"),
        respuestas=[
            StationResponse(
                estacion_id="observar",
                opciones_seleccionadas=["atencion"],
                comentario="Sucede en tareas extensas",
                respondido_por="user-1",
            )
        ],
        estaciones=[],
    )
    context = build_case_context(case, template)
    assert "Dificultad de atención" in context
    assert "Sucede en tareas extensas" in context


def test_portal_reader_session_cannot_publish(monkeypatch) -> None:
    requests: list[tuple[str, dict]] = []

    async def fake_portal_post(path: str, payload: dict) -> dict:
        requests.append((path, payload))
        if path == "/v1/tokens":
            return {"token": "portal-jwt", "expiresAt": "2026-08-08T00:00:00Z"}
        return {"added": 1}

    monkeypatch.setattr(portal_service, "portal_post", fake_portal_post)
    monkeypatch.setattr(portal_service.settings, "portal_publishable_key", "pk_test")
    user = SimpleNamespace(id="user-1", email="reader@example.com", nombre="Reader")
    case = SimpleNamespace(
        id="case-1",
        profesor_id="owner",
        colaboradores=[
            Collaborator(user_id="user-1", role=CollaboratorRole.reader)
        ],
        colaboradores_ids=[],
        status=CaseStatus.draft,
    )

    asyncio.run(portal_service.create_case_session(user, case))

    assert requests[1][1]["channels"] == {"case-case-1": ["connect"]}


def test_portal_webhook_signature_is_verified(monkeypatch) -> None:
    secret = "whsec_test"
    body = json.dumps({"id": "event-1"}, separators=(",", ":")).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(
        secret.encode(),
        timestamp.encode() + b"." + body,
        hashlib.sha256,
    ).hexdigest()
    monkeypatch.setattr(
        "app.services.webhooks.settings.portal_webhook_secret",
        secret,
    )

    verify_portal_signature(body, f"t={timestamp},v1={signature}")
