import asyncio
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.auth import create_access_token, decode_access_token
from app.models import (
    Case,
    CaseProgress,
    CaseStatus,
    Collaborator,
    CollaboratorRole,
    QuestionType,
    StationOption,
    StationResponse,
    Student,
    TemplateStation,
    ensure_utc,
)
from app.schemas import CaseCreate, JourneyTemplateCreate, RegisterRequest
from app.services import portal as portal_service
from app.services.ai import build_case_context, generate_local_case_summary
from app.services.cases import (
    calculate_interactive_state,
    calculate_progress,
    ensure_station_is_unlocked,
)
from app.services.reports import build_case_pdf
from app.services.seeds import build_stations, build_template_content
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
    # Round-tripped into claims too: the frontend reads `me.claims` back from
    # the SDK and has no other way to know its own permission before trying
    # to use it — grants alone gate the socket but never reach the client.
    assert requests[1][1]["claims"]["canPublish"] is False
    assert requests[0][1]["claims"]["canPublish"] is False


def test_portal_closed_case_session_cannot_publish(monkeypatch) -> None:
    # A `publish`-eligible role in a closed case is still refused (§ the
    # `role != "lector" and status != closed` rule in create_case_session) —
    # this is the second half of that rule, not covered by the reader test.
    requests: list[tuple[str, dict]] = []

    async def fake_portal_post(path: str, payload: dict) -> dict:
        requests.append((path, payload))
        if path == "/v1/tokens":
            return {"token": "portal-jwt", "expiresAt": "2026-08-08T00:00:00Z"}
        return {"added": 1}

    monkeypatch.setattr(portal_service, "portal_post", fake_portal_post)
    monkeypatch.setattr(portal_service.settings, "portal_publishable_key", "pk_test")
    user = SimpleNamespace(id="owner", email="owner@example.com", nombre="Owner")
    case = SimpleNamespace(
        id="case-1",
        profesor_id="owner",
        colaboradores=[],
        colaboradores_ids=[],
        status=CaseStatus.closed,
    )

    asyncio.run(portal_service.create_case_session(user, case))

    assert requests[1][1]["channels"] == {"case-case-1": ["connect"]}
    assert requests[1][1]["claims"]["canPublish"] is False


def test_portal_editor_session_can_publish(monkeypatch) -> None:
    requests: list[tuple[str, dict]] = []

    async def fake_portal_post(path: str, payload: dict) -> dict:
        requests.append((path, payload))
        if path == "/v1/tokens":
            return {"token": "portal-jwt", "expiresAt": "2026-08-08T00:00:00Z"}
        return {"added": 1}

    monkeypatch.setattr(portal_service, "portal_post", fake_portal_post)
    monkeypatch.setattr(portal_service.settings, "portal_publishable_key", "pk_test")
    user = SimpleNamespace(id="owner", email="owner@example.com", nombre="Owner")
    case = SimpleNamespace(
        id="case-1",
        profesor_id="owner",
        colaboradores=[],
        colaboradores_ids=[],
        status=CaseStatus.draft,
    )

    asyncio.run(portal_service.create_case_session(user, case))

    assert requests[1][1]["channels"] == {"case-case-1": ["connect", "publish"]}
    assert requests[1][1]["claims"]["canPublish"] is True


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


def test_create_user_session_mints_token_without_channel_grants(monkeypatch) -> None:
    requests: list[tuple[str, dict]] = []

    async def fake_portal_post(path: str, payload: dict) -> dict:
        requests.append((path, payload))
        return {"token": "portal-jwt", "expiresAt": "2026-08-08T00:00:00Z"}

    monkeypatch.setattr(portal_service, "portal_post", fake_portal_post)
    monkeypatch.setattr(portal_service.settings, "portal_publishable_key", "pk_test")
    user = SimpleNamespace(id="user-1", email="ana@example.com", nombre="Ana")

    session = asyncio.run(portal_service.create_user_session(user))

    assert requests == [
        (
            "/v1/tokens",
            {
                "userId": "user-1",
                "claims": {"email": "ana@example.com", "username": "Ana"},
                "ttl": portal_service.settings.portal_token_ttl,
            },
        )
    ]
    assert session.token == "portal-jwt"
    assert session.channel_id == ""


def test_send_user_notification_pushes_portal_inbox_item(monkeypatch) -> None:
    requests: list[tuple[str, dict]] = []

    async def fake_portal_post(path: str, payload: dict) -> dict:
        requests.append((path, payload))
        return {"id": "ntf_abc"}

    monkeypatch.setattr(portal_service, "portal_post", fake_portal_post)
    monkeypatch.setattr(portal_service.settings, "portal_secret_key", "sk_test")
    monkeypatch.setattr(portal_service.settings, "portal_publishable_key", "pk_test")

    asyncio.run(
        portal_service.send_user_notification(
            "user-1",
            "recorrido_actualizado",
            "Recorrido actualizado",
            {"caseId": "case-1", "mensaje": "Alex pasó de Explorar a Orientar."},
        )
    )

    assert requests[0][0] == "/v1/users/user-1/notifications"
    assert requests[0][1] == {
        "type": "recorrido_actualizado",
        "title": "Recorrido actualizado",
        "data": {"caseId": "case-1", "mensaje": "Alex pasó de Explorar a Orientar."},
    }


def test_send_user_notification_is_silent_without_portal_config(monkeypatch) -> None:
    async def should_not_be_called(*_args, **_kwargs) -> dict:  # pragma: no cover
        raise AssertionError("portal_post no debería llamarse sin configuración")

    monkeypatch.setattr(portal_service, "portal_post", should_not_be_called)
    monkeypatch.setattr(portal_service.settings, "portal_secret_key", "")
    monkeypatch.setattr(portal_service.settings, "portal_publishable_key", "")

    asyncio.run(portal_service.send_user_notification("user-1", "tipo", "Título"))


def test_interactive_state_calculates_days_confidence_xp_and_unlock() -> None:
    template = SimpleNamespace(
        estaciones=build_stations(),
        contenido=build_template_content(),
    )
    case = Case.model_construct(
        profesor_id="owner",
        alumno=Student(nombre="Alex"),
        respuestas=[
            StationResponse(
                estacion_id="explorar",
                opciones_seleccionadas=["observar_contextos", "hablar_alumno"],
                respondido_por="owner",
            ),
            StationResponse(
                estacion_id="orientar",
                opciones_seleccionadas=["reto"],
                respondido_por="owner",
            ),
            StationResponse(
                estacion_id="actuar",
                opciones_seleccionadas=["reto_abierto"],
                respondido_por="owner",
            ),
            StationResponse(
                estacion_id="acompanar",
                opciones_seleccionadas=["mejorado"],
                respondido_por="owner",
            ),
        ],
    )

    state = calculate_interactive_state(case, template)

    assert state.dias_restantes == 2
    assert state.confianza_equipo == 75
    assert state.xp_total == 400
    assert state.estacion_actual == "compartir"
    assert state.pistas_recogidas == ["observar_contextos", "hablar_alumno"]


def test_station_order_is_enforced() -> None:
    template = SimpleNamespace(estaciones=build_stations())
    case = SimpleNamespace(respuestas=[])
    with pytest.raises(HTTPException) as error:
        ensure_station_is_unlocked(case, template, 2)
    assert error.value.status_code == 409


def test_mongodb_naive_dates_are_normalized_to_utc() -> None:
    normalized = ensure_utc(datetime(2026, 8, 8, 12, 0, 0))
    assert normalized.tzinfo == timezone.utc


def test_local_summary_and_pdf_are_generated_without_external_services() -> None:
    template = SimpleNamespace(
        estaciones=build_stations(),
        contenido=build_template_content(),
    )
    case = Case.model_construct(
        profesor_id="owner",
        alumno=Student(nombre="Alex", descripcion="Caso ficticio"),
        progreso=CaseProgress(completadas=0, total=5, porcentaje=0),
    )
    assert "Alex" in generate_local_case_summary(case, template)
    assert build_case_pdf(case, template).startswith(b"%PDF")
