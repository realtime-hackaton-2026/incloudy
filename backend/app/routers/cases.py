from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import Case, CaseStatus, Station, User
from ..schemas import CaseCreate, CaseUpdate, StationInput
from ..services.cases import get_owned_case
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
    return await Case.find(Case.profesor_id == str(current_user.id)).sort(
        "-updated_at"
    ).to_list()


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
    return await get_owned_case(case_id, current_user)


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
