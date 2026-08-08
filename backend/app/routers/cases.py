from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_user
from ..config import settings
from ..models import (
    Case,
    CaseEvent,
    CaseStatus,
    CollaboratorRole,
    FinalSummary,
    Invitation,
    JourneyTemplate,
    Notification,
    PortalComment,
    QuestionType,
    StationResponse,
    User,
    utcnow,
)
from ..schemas import (
    CaseCreate,
    CaseUpdate,
    CollaboratorRequest,
    CollaboratorResponse,
    FollowUpRequest,
    StationResponseRequest,
    SummaryGenerateRequest,
    SummaryUpdateRequest,
)
from ..services.ai import generate_case_summary
from ..services.cases import (
    add_or_update_collaborator,
    calculate_progress,
    create_notification,
    get_accessible_case,
    get_case_template,
    get_commentable_case,
    get_editable_case,
    get_owned_case,
    notify_case_participants,
    record_event,
)
from ..services.portal import is_portal_configured, remove_case_member
from ..ws import manager

router = APIRouter()


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
        generado_por_ia=True,
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
    return await Case.find(
        {
            "$or": [
                {"profesor_id": user_id},
                {"colaboradores.user_id": user_id},
                {"colaboradores_ids": user_id},
            ]
        }
    ).sort("-updated_at").to_list()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case(
    body: CaseCreate,
    current_user: User = Depends(get_current_user),
) -> Case:
    template = await resolve_template(body.template_id)
    total_required = sum(station.obligatoria for station in template.estaciones)
    case = Case(
        profesor_id=str(current_user.id),
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


@router.get("/{case_id}")
async def get_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> Case:
    return await get_accessible_case(case_id, current_user)


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

    selected = body.opciones_seleccionadas
    valid_options = {option.id for option in station.opciones}
    if not set(selected).issubset(valid_options):
        raise HTTPException(status_code=422, detail="Se enviaron opciones inválidas")
    if station.obligatoria and not selected:
        raise HTTPException(status_code=422, detail="Debes seleccionar una opción")
    if station.tipo == QuestionType.single and len(selected) > 1:
        raise HTTPException(status_code=422, detail="La estación acepta una sola opción")

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
    case.colaboradores = [
        item for item in case.colaboradores if item.user_id != collaborator_id
    ]
    if collaborator_id in case.colaboradores_ids:
        case.colaboradores_ids.remove(collaborator_id)
    case.updated_at = utcnow()
    await case.save()
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
        str(current_user.id),
        "colaborador_eliminado",
        {"user_id": collaborator_id},
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
