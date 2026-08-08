from typing import Iterable, Optional

from bson import ObjectId
from fastapi import HTTPException

from ..models import (
    Case,
    CaseEvent,
    CaseProgress,
    Collaborator,
    CollaboratorRole,
    JourneyTemplate,
    Notification,
    User,
)


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
    for user_id in participant_ids - {actor_id}:
        await create_notification(
            user_id=user_id,
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            case_id=str(case.id),
        )
