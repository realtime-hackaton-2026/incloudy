from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..models import Case, CaseStatus, Station, User
from ..schemas import (
    CaseCreate,
    CaseUpdate,
    CollaboratorRequest,
    CollaboratorResponse,
    StationInput,
)
from ..services.cases import get_accessible_case, get_owned_case
from ..services.portal import is_portal_configured, remove_case_member
from ..ws import manager

router = APIRouter()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_station(item: StationInput) -> Station:
    return Station(
        orden=item.orden,
        titulo=item.titulo,
        descripcion=item.descripcion,
        completado=item.completado,
    )


@router.get("")
async def list_cases(current_user: User = Depends(get_current_user)) -> list[Case]:
    user_id = str(current_user.id)
    return await Case.find(
        {
            "$or": [
                {"profesor_id": user_id},
                {"colaboradores_ids": user_id},
            ]
        }
    ).sort("-updated_at").to_list()


@router.post("", status_code=201)
async def create_case(
    body: CaseCreate, current_user: User = Depends(get_current_user)
) -> Case:
    case = Case(
        profesor_id=str(current_user.id),
        alumno=body.alumno,
        estaciones=[to_station(s) for s in body.estaciones],
    )
    await case.insert()
    return case


@router.get("/{case_id}")
async def get_case(
    case_id: str, current_user: User = Depends(get_current_user)
) -> Case:
    return await get_accessible_case(case_id, current_user)


@router.put("/{case_id}")
async def update_case(
    case_id: str, body: CaseUpdate, current_user: User = Depends(get_current_user)
) -> Case:
    case = await get_owned_case(case_id, current_user)
    was_published = case.status == CaseStatus.published
    if body.alumno is not None:
        case.alumno = body.alumno
    if body.estaciones is not None:
        case.estaciones = [to_station(s) for s in body.estaciones]
    if body.status is not None:
        case.status = body.status
    case.updated_at = utcnow()
    await case.save()
    if not was_published and case.status == CaseStatus.published:
        await manager.send_to_user(
            str(current_user.id),
            {"event": "case_published", "case_id": case_id},
        )
    return case


@router.delete("/{case_id}", status_code=204)
async def delete_case(
    case_id: str, current_user: User = Depends(get_current_user)
) -> None:
    case = await get_owned_case(case_id, current_user)
    await case.delete()


@router.post(
    "/{case_id}/collaborators",
    response_model=CollaboratorResponse,
)
async def add_collaborator(
    case_id: str,
    body: CollaboratorRequest,
    current_user: User = Depends(get_current_user),
) -> CollaboratorResponse:
    case = await get_owned_case(case_id, current_user)
    collaborator = await User.find_one(User.email == body.email)
    if collaborator is None:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")

    collaborator_id = str(collaborator.id)
    if collaborator_id == str(current_user.id):
        raise HTTPException(
            status_code=400,
            detail="El propietario ya tiene acceso al caso",
        )
    if collaborator_id not in case.colaboradores_ids:
        case.colaboradores_ids.append(collaborator_id)
        case.updated_at = utcnow()
        await case.save()

    return CollaboratorResponse(
        user_id=collaborator_id,
        email=collaborator.email,
    )


@router.delete("/{case_id}/collaborators/{collaborator_id}", status_code=204)
async def remove_collaborator(
    case_id: str,
    collaborator_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    case = await get_owned_case(case_id, current_user)
    if collaborator_id in case.colaboradores_ids:
        case.colaboradores_ids.remove(collaborator_id)
        case.updated_at = utcnow()
        await case.save()
        if is_portal_configured():
            await remove_case_member(case, collaborator_id)
