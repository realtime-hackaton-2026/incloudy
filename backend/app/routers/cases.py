from datetime import timedelta
import secrets
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..auth import get_current_user
from ..config import settings
from ..models import (
    Case,
    CaseEvent,
    CaseProgress,
    CaseScenario,
    CaseStatus,
    CollaboratorRole,
    FinalSummary,
    Invitation,
    InteractiveCaseState,
    JourneyTemplate,
    Notification,
    PortalComment,
    QuestionType,
    StationResponse,
    TeacherNote,
    User,
    utcnow,
)
from ..schemas import (
    CaseAnalysisResponse,
    CaseCreate,
    CaseJoinRequest,
    CaseParticipantResponse,
    CaseUpdate,
    CollaboratorRequest,
    CollaboratorResponse,
    FollowUpRequest,
    ForixShareRequest,
    StationResponseRequest,
    SummaryGenerateRequest,
    SummaryUpdateRequest,
    TeacherNoteCreateRequest,
    UnexpectedEventResponseRequest,
)
from ..services.ai import generate_case_analysis, generate_case_summary
from ..services.cases import (
    add_or_update_collaborator,
    calculate_interactive_state,
    calculate_progress,
    create_notification,
    get_accessible_case,
    get_case_template,
    get_commentable_case,
    get_editable_case,
    get_owned_case,
    ensure_station_is_unlocked,
    notify_case_participants,
    record_event,
    user_role,
)
from ..services.portal import is_portal_configured, remove_case_member
from ..services.reports import build_case_pdf
from ..ws import manager

router = APIRouter()

JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


async def new_join_code() -> str:
    while True:
        candidate = "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(6))
        if await Case.find_one(Case.join_code == candidate) is None:
            return candidate


async def ensure_join_code(case: Case) -> str:
    """Persist a stable, human-friendly room code, including for legacy cases."""
    if case.join_code:
        return case.join_code

    legacy_code = str(case.id)[-6:].upper()
    collision = await Case.find_one(Case.join_code == legacy_code)
    if collision is None or collision.id == case.id:
        case.join_code = legacy_code
        await case.save()
        return legacy_code

    case.join_code = await new_join_code()
    await case.save()
    return case.join_code


async def find_case_by_join_code(code: str) -> Case | None:
    case = await Case.find_one(Case.join_code == code)
    if case is not None:
        return case

    # Compatibility for codes displayed before join_code was persisted.
    legacy_cases = await Case.find({"join_code": None}).to_list()
    matches = [item for item in legacy_cases if str(item.id)[-6:].upper() == code]
    if len(matches) != 1:
        return None
    await ensure_join_code(matches[0])
    return matches[0]


def ensure_case_is_editable(case: Case) -> None:
    if case.status in {
        CaseStatus.published,
        CaseStatus.closed,
        CaseStatus.archived,
    }:
        raise HTTPException(
            status_code=409,
            detail="El caso está publicado, cerrado o archivado",
        )


async def resolve_template(template_id: str | None) -> JourneyTemplate:
    if template_id is not None:
        if not ObjectId.is_valid(template_id):
            raise HTTPException(status_code=404, detail="Plantilla no encontrada")
        template = await JourneyTemplate.get(template_id)
    else:
        template = await JourneyTemplate.find_one(
            JourneyTemplate.activa == True  # noqa: E712
        )
    if template is None or not template.activa:
        raise HTTPException(status_code=404, detail="Plantilla activa no encontrada")
    return template


async def save_generated_summary(
    case: Case,
    user: User,
    overwrite_manual: bool,
) -> Case:
    if case.resumen_final.editado_manualmente and not overwrite_manual:
        raise HTTPException(
            status_code=409,
            detail="El resumen fue editado manualmente; confirma la sobrescritura",
        )
    template = await get_case_template(case)
    content = await generate_case_summary(case, template)
    case.resumen_final = FinalSummary(
        contenido=content,
        generado_por_ia=bool(settings.gemini_api_key),
        editado_manualmente=False,
        actualizado_por=str(user.id),
        actualizado_en=utcnow(),
    )
    case.updated_at = utcnow()
    await case.save()
    await record_event(case, str(user.id), "resumen_generado")
    return case


@router.get("")
async def list_cases(current_user: User = Depends(get_current_user)) -> list[Case]:
    user_id = str(current_user.id)
    cases = await Case.find(
        {
            "$or": [
                {"profesor_id": user_id},
                {"colaboradores.user_id": user_id},
                {"colaboradores_ids": user_id},
            ]
        }
    ).sort("-updated_at").to_list()
    for case in cases:
        await ensure_join_code(case)
    return cases


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case(
    body: CaseCreate,
    current_user: User = Depends(get_current_user),
) -> Case:
    template = await resolve_template(body.template_id)
    total_required = sum(station.obligatoria for station in template.estaciones)
    case = Case(
        profesor_id=str(current_user.id),
        status=CaseStatus.in_progress,
        join_code=await new_join_code(),
        template_id=str(template.id),
        template_version=template.version,
        alumno=body.alumno,
        progreso={"completadas": 0, "total": total_required, "porcentaje": 0},
        retention_until=utcnow() + timedelta(days=settings.data_retention_days),
    )
    await case.insert()
    await record_event(
        case,
        str(current_user.id),
        "caso_creado",
        {"template_id": str(template.id), "template_version": template.version},
    )
    return case


@router.post("/join")
async def join_case(
    body: CaseJoinRequest,
    current_user: User = Depends(get_current_user),
) -> Case:
    code = body.code.strip().upper()
    case = await find_case_by_join_code(code)
    if case is None:
        raise HTTPException(status_code=404, detail="No existe una sala con ese código")
    if case.status in {CaseStatus.closed, CaseStatus.archived}:
        raise HTTPException(status_code=409, detail="Esta sala ya no acepta docentes")

    user_id = str(current_user.id)
    already_has_access = user_id == case.profesor_id or any(
        collaborator.user_id == user_id for collaborator in case.colaboradores
    ) or user_id in case.colaboradores_ids
    if not already_has_access and not case.forix_shared:
        raise HTTPException(
            status_code=409,
            detail="El propietario todavía no compartió este caso con Búrix",
        )
    if not already_has_access:
        add_or_update_collaborator(case, user_id, CollaboratorRole.commenter)
        case.updated_at = utcnow()
        await case.save()
        await record_event(
            case,
            user_id,
            "colaborador_unido_por_codigo",
            {"role": CollaboratorRole.commenter.value},
        )
        await create_notification(
            case.profesor_id,
            "colaborador_unido",
            "Un docente se unió al caso",
            f"{current_user.nombre} se unió al caso de {case.alumno.nombre}.",
            str(case.id),
        )
    return case


@router.put("/{case_id}/forix-share")
async def set_forix_share(
    case_id: str,
    body: ForixShareRequest,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_owned_case(case_id, current_user)
    if case.status == CaseStatus.archived:
        raise HTTPException(status_code=409, detail="No se puede compartir un caso archivado")
    await ensure_join_code(case)
    case.forix_shared = body.shared
    case.updated_at = utcnow()
    await case.save()
    await record_event(
        case,
        str(current_user.id),
        "caso_compartido_con_forix" if body.shared else "caso_retirado_de_forix",
    )
    return case


@router.get("/{case_id}")
async def get_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_accessible_case(case_id, current_user)
    await ensure_join_code(case)
    return case


@router.get("/{case_id}/participants", response_model=list[CaseParticipantResponse])
async def list_case_participants(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> list[CaseParticipantResponse]:
    """Resolve stable room identities from app users, not Portal fallbacks."""
    case = await get_accessible_case(case_id, current_user)
    participant_ids = [case.profesor_id]
    participant_ids.extend(item.user_id for item in case.colaboradores)
    participant_ids.extend(case.colaboradores_ids)
    participants: list[CaseParticipantResponse] = []
    for user_id in dict.fromkeys(participant_ids):
        if not ObjectId.is_valid(user_id):
            continue
        user = await User.get(user_id)
        if user is None:
            continue
        participants.append(
            CaseParticipantResponse(
                user_id=user_id,
                nombre=user.nombre,
                email=user.email,
                role=user_role(case, user_id) or "docente",
            )
        )
    return participants


@router.put("/{case_id}")
async def update_case(
    case_id: str,
    body: CaseUpdate,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_editable_case(case_id, current_user)
    ensure_case_is_editable(case)
    if body.alumno is not None:
        if not body.alumno.es_ficticio:
            raise HTTPException(
                status_code=422,
                detail="Solo se admiten alumnos ficticios o anonimizados",
            )
        case.alumno = body.alumno
    case.updated_at = utcnow()
    await case.save()
    await record_event(case, str(current_user.id), "caso_actualizado")
    return case


@router.put("/{case_id}/stations/{station_order}/response")
async def answer_station(
    case_id: str,
    station_order: int,
    body: StationResponseRequest,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_editable_case(case_id, current_user)
    ensure_case_is_editable(case)
    template = await get_case_template(case)
    station = next(
        (item for item in template.estaciones if item.orden == station_order),
        None,
    )
    if station is None:
        raise HTTPException(status_code=404, detail="Estación no encontrada")
    ensure_station_is_unlocked(case, template, station.orden)

    selected = body.opciones_seleccionadas
    valid_options = {option.id for option in station.opciones}
    if not set(selected).issubset(valid_options):
        raise HTTPException(status_code=422, detail="Se enviaron opciones inválidas")
    if station.obligatoria and not selected:
        raise HTTPException(status_code=422, detail="Debes seleccionar una opción")
    if station.tipo == QuestionType.single and len(selected) > 1:
        raise HTTPException(status_code=422, detail="La estación acepta una sola opción")
    if (
        station.id == "compartir"
        and case.estado_interactivo.dias_restantes == 0
        and len(selected) > 1
    ):
        raise HTTPException(
            status_code=422,
            detail="Con la semana agotada solo puedes elegir una persona",
        )

    response = StationResponse(
        estacion_id=station.id,
        opciones_seleccionadas=selected,
        comentario=body.comentario,
        respondido_por=str(current_user.id),
    )
    existing_index = next(
        (
            index
            for index, item in enumerate(case.respuestas)
            if item.estacion_id == station.id
        ),
        None,
    )
    if existing_index is None:
        case.respuestas.append(response)
    else:
        case.respuestas[existing_index] = response

    case.status = CaseStatus.in_progress
    case.progreso = calculate_progress(case, template)
    case.estado_interactivo = calculate_interactive_state(case, template)
    case.updated_at = utcnow()
    await case.save()
    await record_event(
        case,
        str(current_user.id),
        "estacion_respondida",
        {"estacion_id": station.id, "orden": station.orden},
    )
    await notify_case_participants(
        case,
        str(current_user.id),
        "estacion_respondida",
        "Recorrido actualizado",
        f"Se actualizó la estación {station.titulo}.",
    )
    return case


@router.put("/{case_id}/unexpected-events/{event_id}/response")
async def answer_unexpected_event(
    case_id: str,
    event_id: str,
    body: UnexpectedEventResponseRequest,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_editable_case(case_id, current_user)
    ensure_case_is_editable(case)
    template = await get_case_template(case)
    event = next(
        (
            item
            for item in template.contenido.get("imprevistos", [])
            if item.get("id") == event_id
        ),
        None,
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Imprevisto no encontrado")
    station = next(
        (
            item
            for item in template.estaciones
            if item.id == event.get("estacion_id")
        ),
        None,
    )
    if station is None:
        raise HTTPException(status_code=409, detail="Imprevisto sin estación válida")
    ensure_station_is_unlocked(case, template, station.orden)
    valid_options = {item["id"] for item in event.get("opciones", [])}
    if body.opcion_id not in valid_options:
        raise HTTPException(status_code=422, detail="Opción de imprevisto inválida")

    prefix = f"{event_id}:"
    case.estado_interactivo.imprevistos_resueltos = [
        item
        for item in case.estado_interactivo.imprevistos_resueltos
        if not item.startswith(prefix)
    ]
    case.estado_interactivo.imprevistos_resueltos.append(
        f"{event_id}:{body.opcion_id}"
    )
    case.estado_interactivo = calculate_interactive_state(case, template)
    case.updated_at = utcnow()
    await case.save()
    await record_event(
        case,
        str(current_user.id),
        "imprevisto_resuelto",
        {"event_id": event_id, "opcion_id": body.opcion_id},
    )
    return case


@router.post("/{case_id}/complete")
async def complete_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_editable_case(case_id, current_user)
    ensure_case_is_editable(case)
    template = await get_case_template(case)
    case.progreso = calculate_progress(case, template)
    if case.progreso.porcentaje != 100:
        raise HTTPException(
            status_code=409,
            detail="Debes completar todas las estaciones obligatorias",
        )
    if not (
        case.resumen_final.editado_manualmente
        and case.resumen_final.contenido
    ):
        case = await save_generated_summary(case, current_user, overwrite_manual=False)
    case.status = CaseStatus.completed
    case.updated_at = utcnow()
    await case.save()
    await record_event(case, str(current_user.id), "caso_completado")
    await notify_case_participants(
        case,
        str(current_user.id),
        "caso_completado",
        "Caso completado",
        f"El análisis de {case.alumno.nombre} está listo para revisión.",
    )
    return case


@router.post("/{case_id}/summary/generate")
async def regenerate_summary(
    case_id: str,
    body: SummaryGenerateRequest,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_editable_case(case_id, current_user)
    ensure_case_is_editable(case)
    if case.progreso.porcentaje != 100:
        raise HTTPException(status_code=409, detail="El recorrido no está completo")
    return await save_generated_summary(case, current_user, body.overwrite_manual)


@router.put("/{case_id}/summary")
async def update_summary(
    case_id: str,
    body: SummaryUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_editable_case(case_id, current_user)
    ensure_case_is_editable(case)
    case.resumen_final = FinalSummary(
        contenido=body.contenido,
        generado_por_ia=False,
        editado_manualmente=True,
        actualizado_por=str(current_user.id),
        actualizado_en=utcnow(),
    )
    case.updated_at = utcnow()
    await case.save()
    await record_event(case, str(current_user.id), "resumen_editado")
    await notify_case_participants(
        case,
        str(current_user.id),
        "resumen_editado",
        "Resumen actualizado",
        f"Se editó el resumen del caso de {case.alumno.nombre}.",
    )
    return case


@router.post("/{case_id}/publish")
async def publish_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_owned_case(case_id, current_user)
    if case.status != CaseStatus.completed:
        raise HTTPException(status_code=409, detail="El caso debe estar completado")
    if not case.resumen_final.contenido:
        raise HTTPException(status_code=409, detail="El caso necesita un resumen final")
    case.status = CaseStatus.published
    case.updated_at = utcnow()
    await case.save()
    await record_event(case, str(current_user.id), "caso_publicado")
    await manager.send_to_user(
        str(current_user.id),
        {"event": "case_published", "case_id": case_id},
    )
    await notify_case_participants(
        case,
        str(current_user.id),
        "caso_publicado",
        "Caso publicado",
        f"El análisis de {case.alumno.nombre} fue publicado.",
    )
    return case


@router.post("/{case_id}/close")
async def close_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_owned_case(case_id, current_user)
    if case.status not in {CaseStatus.completed, CaseStatus.published}:
        raise HTTPException(status_code=409, detail="El caso aún no puede cerrarse")
    case.status = CaseStatus.closed
    case.updated_at = utcnow()
    await case.save()
    await record_event(case, str(current_user.id), "caso_cerrado")
    return case


@router.post("/{case_id}/reopen")
async def reopen_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_owned_case(case_id, current_user)
    if case.status != CaseStatus.closed:
        raise HTTPException(status_code=409, detail="El caso no está cerrado")
    case.status = CaseStatus.completed
    case.updated_at = utcnow()
    await case.save()
    await record_event(case, str(current_user.id), "caso_reabierto")
    return case


@router.post("/{case_id}/archive")
async def archive_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_owned_case(case_id, current_user)
    case.status = CaseStatus.archived
    case.updated_at = utcnow()
    await case.save()
    await record_event(case, str(current_user.id), "caso_archivado")
    return case


@router.delete("/{case_id}", status_code=204)
async def delete_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    case = await get_owned_case(case_id, current_user)
    await record_event(case, str(current_user.id), "caso_eliminado")
    await Invitation.find(Invitation.case_id == case_id).delete()
    await CaseEvent.find(CaseEvent.case_id == case_id).delete()
    await TeacherNote.find(TeacherNote.case_id == case_id).delete()
    await PortalComment.find(PortalComment.case_id == case_id).delete()
    await Notification.find(Notification.case_id == case_id).delete()
    await case.delete()


@router.post("/{case_id}/collaborators", response_model=CollaboratorResponse)
async def add_collaborator(
    case_id: str,
    body: CollaboratorRequest,
    current_user: User = Depends(get_current_user),
) -> CollaboratorResponse:
    case = await get_owned_case(case_id, current_user)
    if case.status in {CaseStatus.closed, CaseStatus.archived}:
        raise HTTPException(status_code=409, detail="El caso no acepta colaboradores")
    collaborator = await User.find_one(User.email == body.email)
    if collaborator is None:
        raise HTTPException(
            status_code=404,
            detail="Profesor no encontrado; crea una invitación pendiente",
        )
    collaborator_id = str(collaborator.id)
    if collaborator_id == str(current_user.id):
        raise HTTPException(status_code=400, detail="El propietario ya tiene acceso")

    add_or_update_collaborator(case, collaborator_id, body.role)
    case.updated_at = utcnow()
    await case.save()
    await record_event(
        case,
        str(current_user.id),
        "colaborador_agregado",
        {"user_id": collaborator_id, "role": body.role.value},
    )
    await create_notification(
        collaborator_id,
        "invitacion_aceptada",
        "Acceso a un caso",
        f"Fuiste agregado al caso de {case.alumno.nombre}.",
        str(case.id),
    )
    return CollaboratorResponse(
        user_id=collaborator_id,
        email=collaborator.email,
        role=body.role,
    )


async def _remove_collaborator(
    case: Case,
    collaborator_id: str,
    actor: User,
    notify_owner: bool = False,
) -> None:
    case.colaboradores = [
        item for item in case.colaboradores if item.user_id != collaborator_id
    ]
    if collaborator_id in case.colaboradores_ids:
        case.colaboradores_ids.remove(collaborator_id)
    case.updated_at = utcnow()
    await case.save()
    if notify_owner:
        await create_notification(
            case.profesor_id,
            "colaborador_abandono",
            "Un colaborador salió",
            f"{actor.nombre} dejó el caso de {case.alumno.nombre}.",
            str(case.id),
        )
    else:
        await create_notification(
            collaborator_id,
            "acceso_retirado",
            "Acceso retirado",
            f"Tu acceso al caso de {case.alumno.nombre} fue retirado.",
            str(case.id),
        )
    if is_portal_configured():
        await remove_case_member(case, collaborator_id)
    await record_event(
        case,
        str(actor.id),
        "colaborador_eliminado",
        {"user_id": collaborator_id},
    )


@router.delete("/{case_id}/collaborators/{collaborator_id}", status_code=204)
async def remove_collaborator(
    case_id: str,
    collaborator_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    case = await get_owned_case(case_id, current_user)
    was_collaborator = any(
        item.user_id == collaborator_id for item in case.colaboradores
    ) or collaborator_id in case.colaboradores_ids
    if not was_collaborator:
        return
    await _remove_collaborator(case, collaborator_id, current_user)


@router.post("/{case_id}/leave", status_code=204)
async def leave_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    """A collaborator drops a shared case from their own list. The case
    itself, and the owner's copy of it, stay untouched."""
    case = await get_accessible_case(case_id, current_user)
    if case.profesor_id == str(current_user.id):
        raise HTTPException(
            status_code=400,
            detail="No puedes salir de tu propio caso",
        )
    await _remove_collaborator(
        case,
        str(current_user.id),
        current_user,
        notify_owner=True,
    )


@router.post("/{case_id}/follow-ups", status_code=status.HTTP_201_CREATED)
async def create_follow_up(
    case_id: str,
    body: FollowUpRequest,
    current_user: User = Depends(get_current_user),
) -> CaseEvent:
    case = await get_commentable_case(case_id, current_user)
    if case.status in {CaseStatus.closed, CaseStatus.archived}:
        raise HTTPException(status_code=409, detail="El caso ya no acepta seguimiento")
    event = await record_event(
        case,
        str(current_user.id),
        "seguimiento_agregado",
        {"observacion": body.observacion, "estacion_id": body.estacion_id},
    )
    await notify_case_participants(
        case,
        str(current_user.id),
        "seguimiento_agregado",
        "Nuevo seguimiento",
        body.observacion[:200],
    )
    return event


@router.get("/{case_id}/notes")
async def list_teacher_notes(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> list[TeacherNote]:
    case = await get_accessible_case(case_id, current_user)
    return await TeacherNote.find(
        TeacherNote.case_id == str(case.id),
        TeacherNote.user_id == str(current_user.id),
    ).sort("-creada_en").to_list()


@router.post("/{case_id}/notes", status_code=status.HTTP_201_CREATED)
async def create_teacher_note(
    case_id: str,
    body: TeacherNoteCreateRequest,
    current_user: User = Depends(get_current_user),
) -> TeacherNote:
    case = await get_accessible_case(case_id, current_user)
    note = TeacherNote(
        case_id=str(case.id),
        user_id=str(current_user.id),
        contenido=body.contenido,
        categoria=body.categoria,
    )
    await note.insert()
    return note


@router.delete("/{case_id}/notes/{note_id}", status_code=204)
async def delete_teacher_note(
    case_id: str,
    note_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    case = await get_accessible_case(case_id, current_user)
    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    note = await TeacherNote.get(note_id)
    if (
        note is None
        or note.case_id != str(case.id)
        or note.user_id != str(current_user.id)
    ):
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    await note.delete()


@router.post("/{case_id}/reset")
async def reset_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> Case:
    case = await get_owned_case(case_id, current_user)
    template = await get_case_template(case)
    initial_state = InteractiveCaseState()
    if case.scenario_id and ObjectId.is_valid(case.scenario_id):
        scenario = await CaseScenario.get(case.scenario_id)
        if scenario is not None:
            initial_state = scenario.estado_inicial.model_copy(deep=True)

    case.respuestas = []
    case.progreso = CaseProgress(
        completadas=0,
        total=sum(item.obligatoria for item in template.estaciones),
        porcentaje=0,
    )
    case.resumen_final = FinalSummary()
    case.estado_interactivo = initial_state
    case.status = CaseStatus.draft
    case.updated_at = utcnow()
    await case.save()
    await record_event(case, str(current_user.id), "caso_reiniciado")
    return case


@router.get("/{case_id}/report.pdf")
async def download_case_report(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> Response:
    case = await get_accessible_case(case_id, current_user)
    template = await get_case_template(case)
    return Response(
        content=build_case_pdf(case, template),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="informe-caso-alex.pdf"'
        },
    )


@router.get("/{case_id}/events")
async def list_case_events(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> list[CaseEvent]:
    case = await get_accessible_case(case_id, current_user)
    return await CaseEvent.find(CaseEvent.case_id == str(case.id)).sort(
        "-created_at"
    ).to_list()


@router.get("/{case_id}/comments")
async def list_case_comments(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> list[PortalComment]:
    case = await get_accessible_case(case_id, current_user)
    return await PortalComment.find(
        PortalComment.case_id == str(case.id),
        PortalComment.retracted == False,  # noqa: E712
    ).sort("portal_timestamp").to_list()


@router.post("/{case_id}/analysis", response_model=CaseAnalysisResponse)
async def analyze_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> CaseAnalysisResponse:
    case = await get_accessible_case(case_id, current_user)
    template = await get_case_template(case)
    comments = await PortalComment.find(
        PortalComment.case_id == str(case.id),
        PortalComment.retracted == False,  # noqa: E712
    ).sort("portal_timestamp").to_list()
    return CaseAnalysisResponse(
        analisis=await generate_case_analysis(case, template, comments),
        comentarios_analizados=len(comments),
    )
