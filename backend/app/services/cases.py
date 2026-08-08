from typing import Iterable, Optional

from bson import ObjectId
from fastapi import HTTPException

from ..models import (
    Case,
    CaseEvent,
    CaseProgress,
    Collaborator,
    CollaboratorRole,
    InteractiveCaseState,
    JourneyTemplate,
    Notification,
    User,
)


def _selected_response(case: Case, station_id: str):
    return next(
        (
            response
            for response in case.respuestas
            if response.estacion_id == station_id and response.completado
        ),
        None,
    )


def ensure_station_is_unlocked(
    case: Case,
    template: JourneyTemplate,
    station_order: int,
) -> None:
    completed = {
        response.estacion_id
        for response in case.respuestas
        if response.completado
    }
    missing = [
        station.titulo
        for station in template.estaciones
        if station.obligatoria
        and station.orden < station_order
        and station.id not in completed
    ]
    if missing:
        raise HTTPException(
            status_code=409,
            detail=f"Completa primero la estación {missing[0]}",
        )


def calculate_interactive_state(
    case: Case,
    template: JourneyTemplate,
) -> InteractiveCaseState:
    previous = case.estado_interactivo
    state = InteractiveCaseState(
        imprevistos_resueltos=list(previous.imprevistos_resueltos),
    )
    stations = {station.id: station for station in template.estaciones}

    explore = _selected_response(case, "explorar")
    if explore is not None:
        state.pistas_recogidas = list(explore.opciones_seleccionadas)
        options = {item.id: item for item in stations["explorar"].opciones}
        state.dias_restantes -= sum(
            int(options[item].contenido.get("coste_dias", 0))
            for item in explore.opciones_seleccionadas
            if item in options
        )

    orient = _selected_response(case, "orientar")
    if orient is not None and orient.opciones_seleccionadas:
        state.hipotesis_sostenida = orient.opciones_seleccionadas[0]
        option = next(
            item
            for item in stations["orientar"].opciones
            if item.id == state.hipotesis_sostenida
        )
        state.dias_restantes -= int(option.contenido.get("coste_dias", 0))

    action = _selected_response(case, "actuar")
    if action is not None and action.opciones_seleccionadas:
        state.estrategia_elegida = action.opciones_seleccionadas[0]
        option = next(
            item
            for item in stations["actuar"].opciones
            if item.id == state.estrategia_elegida
        )
        state.dias_restantes -= int(option.contenido.get("coste_dias", 0))
        aligned = option.contenido.get("alineada_con") == state.hipotesis_sostenida
        confidence_key = "confianza_alineada" if aligned else "confianza_no_alineada"
        state.confianza_equipo += int(
            stations["actuar"].contenido.get(confidence_key, {}).get("cambio", 0)
        )

    follow_up = _selected_response(case, "acompanar")
    if follow_up is not None and follow_up.opciones_seleccionadas:
        state.seguimiento_elegido = follow_up.opciones_seleccionadas[0]
        option = next(
            item
            for item in stations["acompanar"].opciones
            if item.id == state.seguimiento_elegido
        )
        state.dias_restantes -= int(
            stations["acompanar"].contenido.get("coste_dias", 0)
        )
        state.confianza_equipo += int(option.contenido.get("confianza", 0))

    sharing = _selected_response(case, "compartir")
    if sharing is not None:
        state.compartido_con = list(sharing.opciones_seleccionadas)

    incidents = {
        item["id"]: item for item in template.contenido.get("imprevistos", [])
    }
    for decision in state.imprevistos_resueltos:
        event_id, _, option_id = decision.partition(":")
        event = incidents.get(event_id)
        if event is None:
            continue
        selected = next(
            (item for item in event.get("opciones", []) if item["id"] == option_id),
            None,
        )
        if selected is not None:
            state.dias_restantes -= int(selected.get("coste_dias", 0))
            state.confianza_equipo += int(selected.get("confianza", 0))

    state.dias_restantes = max(0, state.dias_restantes)
    state.confianza_equipo = max(0, min(100, state.confianza_equipo))
    completed = {
        response.estacion_id
        for response in case.respuestas
        if response.completado
    }
    ordered = sorted(template.estaciones, key=lambda item: item.orden)
    state.estacion_actual = next(
        (station.id for station in ordered if station.id not in completed),
        "completado",
    )
    state.xp_total = len(completed) * 100
    return state


def user_role(case: Case, user_id: str) -> Optional[str]:
    if case.profesor_id == user_id:
        return "propietario"
    for collaborator in case.colaboradores:
        if collaborator.user_id == user_id:
            return collaborator.role.value
    if user_id in case.colaboradores_ids:
        return CollaboratorRole.commenter.value
    return None


def require_roles(case: Case, user: User, roles: Iterable[str]) -> str:
    role = user_role(case, str(user.id))
    if role not in set(roles) | {"propietario"}:
        raise HTTPException(status_code=403, detail="No tienes permiso para esta acción")
    return role


async def _get_case(case_id: str) -> Case:
    if not ObjectId.is_valid(case_id):
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    case = await Case.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return case


async def get_owned_case(case_id: str, user: User) -> Case:
    case = await _get_case(case_id)
    if case.profesor_id != str(user.id):
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return case


async def get_accessible_case(case_id: str, user: User) -> Case:
    case = await _get_case(case_id)
    if user_role(case, str(user.id)) is None:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return case


async def get_editable_case(case_id: str, user: User) -> Case:
    case = await get_accessible_case(case_id, user)
    require_roles(case, user, [CollaboratorRole.editor.value])
    return case


async def get_commentable_case(case_id: str, user: User) -> Case:
    case = await get_accessible_case(case_id, user)
    require_roles(
        case,
        user,
        [CollaboratorRole.editor.value, CollaboratorRole.commenter.value],
    )
    return case


async def get_case_template(case: Case) -> JourneyTemplate:
    if case.template_id is None or not ObjectId.is_valid(case.template_id):
        raise HTTPException(status_code=409, detail="El caso no tiene una plantilla válida")
    template = await JourneyTemplate.get(case.template_id)
    if template is None or template.version != case.template_version:
        raise HTTPException(status_code=409, detail="La plantilla del caso no está disponible")
    return template


def calculate_progress(case: Case, template: JourneyTemplate) -> CaseProgress:
    required_ids = {station.id for station in template.estaciones if station.obligatoria}
    completed_ids = {
        response.estacion_id
        for response in case.respuestas
        if response.completado and response.estacion_id in required_ids
    }
    total = len(required_ids)
    completed = len(completed_ids)
    percentage = round(completed * 100 / total) if total else 100
    return CaseProgress(
        completadas=completed,
        total=total,
        porcentaje=percentage,
    )


def add_or_update_collaborator(
    case: Case,
    user_id: str,
    role: CollaboratorRole,
) -> None:
    for collaborator in case.colaboradores:
        if collaborator.user_id == user_id:
            collaborator.role = role
            break
    else:
        case.colaboradores.append(Collaborator(user_id=user_id, role=role))
    if user_id not in case.colaboradores_ids:
        case.colaboradores_ids.append(user_id)


async def record_event(
    case: Case,
    user_id: str,
    event: str,
    details: Optional[dict] = None,
) -> CaseEvent:
    item = CaseEvent(
        case_id=str(case.id),
        user_id=user_id,
        event=event,
        details=details or {},
    )
    await item.insert()
    return item


async def create_notification(
    user_id: str,
    tipo: str,
    titulo: str,
    mensaje: str,
    case_id: Optional[str] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        case_id=case_id,
    )
    await notification.insert()
    return notification


async def notify_case_participants(
    case: Case,
    actor_id: str,
    tipo: str,
    titulo: str,
    mensaje: str,
) -> None:
    participant_ids = {case.profesor_id}
    participant_ids.update(item.user_id for item in case.colaboradores)
    participant_ids.update(case.colaboradores_ids)
    # Deferred import: services.portal imports `user_role` from this module,
    # so a module-level import here would be the cycle portal→cases→portal.
    from ..services.portal import send_user_notification  # noqa: PLC0415
    for user_id in participant_ids - {actor_id}:
        await create_notification(
            user_id=user_id,
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            case_id=str(case.id),
        )
        await send_user_notification(
            user_id,
            tipo,
            titulo,
            {"caseId": str(case.id), "mensaje": mensaje},
        )
