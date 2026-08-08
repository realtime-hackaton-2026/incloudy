import json
import time

import pytest
from beanie import init_beanie
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient

from app.models import (
    Case,
    CaseEvent,
    CaseScenario,
    Collaborator,
    CollaboratorRole,
    Invitation,
    JourneyTemplate,
    Notification,
    PortalComment,
    StationOption,
    Student,
    TemplateStation,
    TeacherNote,
    User,
)
from app.routers import cases as cases_router
from app.schemas import (
    CaseJoinRequest,
    ForixShareRequest,
    StationResponseRequest,
    TeacherNoteCreateRequest,
    UnexpectedEventResponseRequest,
)
from app.services.cases import get_editable_case
from app.services.seeds import ensure_alex_case_for_user, ensure_seed_content
from app.services.webhooks import process_portal_webhook


@pytest.mark.asyncio
async def test_teacher_can_join_existing_case_with_room_code() -> None:
    client = AsyncMongoMockClient()
    await init_beanie(
        database=client.test_join_code,
        document_models=[
            User,
            JourneyTemplate,
            CaseScenario,
            Case,
            Invitation,
            CaseEvent,
            Notification,
            PortalComment,
            TeacherNote,
        ],
    )
    owner = User(nombre="María", email="owner@example.com", hashed_password="hash")
    guest = User(nombre="Luis", email="guest@example.com", hashed_password="hash")
    await owner.insert()
    await guest.insert()
    case = Case(
        profesor_id=str(owner.id),
        join_code="TEAM42",
        forix_shared=True,
        alumno=Student(nombre="Caso compartido"),
    )
    await case.insert()

    joined = await cases_router.join_case(CaseJoinRequest(code="team42"), guest)
    joined_again = await cases_router.join_case(CaseJoinRequest(code="TEAM42"), guest)

    assert joined.id == case.id
    assert joined_again.id == case.id
    assert [item.user_id for item in joined_again.colaboradores] == [str(guest.id)]
    assert joined_again.colaboradores[0].role == CollaboratorRole.commenter

    unshared = await cases_router.set_forix_share(
        str(case.id), ForixShareRequest(shared=False), owner
    )
    assert not unshared.forix_shared


@pytest.mark.asyncio
async def test_complete_collaborative_case_flow_persists(monkeypatch) -> None:
    client = AsyncMongoMockClient()
    await init_beanie(
        database=client.test_incloudy,
        document_models=[
            User,
            JourneyTemplate,
            CaseScenario,
            Case,
            Invitation,
            CaseEvent,
            Notification,
            PortalComment,
            TeacherNote,
        ],
    )
    owner = User(
        nombre="María",
        email="maria@example.com",
        hashed_password="hash",
    )
    editor = User(
        nombre="Luis",
        email="luis@example.com",
        hashed_password="hash",
    )
    await owner.insert()
    await editor.insert()
    template = JourneyTemplate(
        nombre="Recorrido",
        version=1,
        created_by=str(owner.id),
        estaciones=[
            TemplateStation(
                id="observar",
                orden=1,
                titulo="Observar",
                opciones=[StationOption(id="atencion", texto="Atención")],
            )
        ],
    )
    await template.insert()
    case = Case(
        profesor_id=str(owner.id),
        colaboradores=[
            Collaborator(user_id=str(editor.id), role=CollaboratorRole.editor)
        ],
        template_id=str(template.id),
        template_version=template.version,
        alumno=Student(nombre="Caso A"),
        progreso={"completadas": 0, "total": 1, "porcentaje": 0},
    )
    await case.insert()

    editable = await get_editable_case(str(case.id), editor)
    assert editable.id == case.id

    answered = await cases_router.answer_station(
        str(case.id),
        1,
        StationResponseRequest(
            opciones_seleccionadas=["atencion"],
            comentario="Mejora con instrucciones breves",
        ),
        editor,
    )
    assert answered.progreso.porcentaje == 100

    async def fake_summary(_case: Case, _template: JourneyTemplate) -> str:
        return "Resumen pedagógico simulado"

    monkeypatch.setattr(cases_router, "generate_case_summary", fake_summary)
    completed = await cases_router.complete_case(str(case.id), owner)
    assert completed.resumen_final.contenido == "Resumen pedagógico simulado"
    assert completed.status.value == "completado"

    webhook = {
        "id": "message-1",
        "type": "message.published",
        "timestamp": int(time.time() * 1000),
        "channelId": f"case-{case.id}",
        "data": {
            "id": "message-1",
            "content": {"text": "Comentario de seguimiento"},
            "sender": {"id": str(editor.id), "anon": False},
            "timestamp": int(time.time() * 1000),
        },
    }
    await process_portal_webhook(json.dumps(webhook).encode())

    stored = await Case.get(case.id)
    events = await CaseEvent.find(CaseEvent.case_id == str(case.id)).to_list()
    notifications = await Notification.find(
        Notification.user_id == str(owner.id)
    ).to_list()
    comments = await PortalComment.find(
        PortalComment.case_id == str(case.id)
    ).to_list()

    assert stored is not None
    assert stored.progreso.porcentaje == 100
    assert {event.event for event in events} >= {
        "estacion_respondida",
        "caso_completado",
        "comentario_portal",
    }
    assert notifications
    assert comments[0].content == {"text": "Comentario de seguimiento"}


@pytest.mark.asyncio
async def test_alex_content_and_case_are_seeded_idempotently() -> None:
    client = AsyncMongoMockClient()
    await init_beanie(
        database=client.test_alex_seed,
        document_models=[
            User,
            JourneyTemplate,
            CaseScenario,
            Case,
            Invitation,
            CaseEvent,
            Notification,
            PortalComment,
            TeacherNote,
        ],
    )
    professor = User(
        nombre="Profesora Demo",
        email="demo@example.com",
        hashed_password="hash",
    )
    await professor.insert()

    await ensure_seed_content()
    await ensure_seed_content()
    await ensure_alex_case_for_user(professor)

    template = await JourneyTemplate.find_one(JourneyTemplate.activa == True)  # noqa: E712
    scenario = await CaseScenario.find_one(CaseScenario.slug == "caso-alex")
    cases = await Case.find(Case.profesor_id == str(professor.id)).to_list()

    assert template is not None
    assert [station.id for station in template.estaciones] == [
        "explorar",
        "orientar",
        "actuar",
        "acompanar",
        "compartir",
    ]
    assert template.estaciones[0].opciones[0].contenido["coste_dias"] == 1
    assert len(template.contenido["imprevistos"]) == 2
    assert template.contenido["cierre"]["niveles"][0]["min"] == 70
    assert scenario is not None
    assert scenario.alumno.nombre == "Alex"
    assert len(scenario.hipotesis) == 3
    assert len(cases) == 1
    assert cases[0].scenario_id == str(scenario.id)
    assert cases[0].estado_interactivo.dias_restantes == 7
    assert cases[0].progreso.total == 5

    with pytest.raises(HTTPException) as locked:
        await cases_router.answer_station(
            str(cases[0].id),
            2,
            StationResponseRequest(opciones_seleccionadas=["reto"]),
            professor,
        )
    assert locked.value.status_code == 409

    answers = [
        (1, ["observar_contextos"]),
        (2, ["reto"]),
        (3, ["reto_abierto"]),
        (4, ["mejorado"]),
        (5, ["tutor"]),
    ]
    for order, selected in answers[:2]:
        await cases_router.answer_station(
            str(cases[0].id),
            order,
            StationResponseRequest(opciones_seleccionadas=selected),
            professor,
        )
    await cases_router.answer_unexpected_event(
        str(cases[0].id),
        "llamada_familia",
        UnexpectedEventResponseRequest(opcion_id="atender_ahora"),
        professor,
    )
    for order, selected in answers[2:]:
        completed_route = await cases_router.answer_station(
            str(cases[0].id),
            order,
            StationResponseRequest(opciones_seleccionadas=selected),
            professor,
        )

    assert completed_route.progreso.porcentaje == 100
    assert completed_route.estado_interactivo.dias_restantes == 2
    assert completed_route.estado_interactivo.confianza_equipo == 83
    assert completed_route.estado_interactivo.xp_total == 500

    note = await cases_router.create_teacher_note(
        str(cases[0].id),
        TeacherNoteCreateRequest(contenido="Nota privada"),
        professor,
    )
    notes = await cases_router.list_teacher_notes(str(cases[0].id), professor)
    assert len(notes) == 1
    assert notes[0].id == note.id
    assert notes[0].contenido == "Nota privada"

    completed_case = await cases_router.complete_case(str(cases[0].id), professor)
    assert completed_case.resumen_final.contenido
    assert not completed_case.resumen_final.generado_por_ia
    report = await cases_router.download_case_report(str(cases[0].id), professor)
    assert report.body.startswith(b"%PDF")

    await completed_case.delete()
    await ensure_seed_content()
    recreated = await Case.find(Case.profesor_id == str(professor.id)).to_list()
    assert recreated == []
