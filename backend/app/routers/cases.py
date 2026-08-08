from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import get_current_user
from ..models import Case, CaseStatus, Station, Student, User
from ..ws import manager

router = APIRouter()


class StationInput(BaseModel):
    orden: int
    titulo: str
    descripcion: str = ""
    completado: bool = False


class CaseCreate(BaseModel):
    alumno: Student
    estaciones: list[StationInput] = []


class CaseUpdate(BaseModel):
    alumno: Optional[Student] = None
    estaciones: Optional[list[StationInput]] = None
    status: Optional[CaseStatus] = None


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
    if not ObjectId.is_valid(case_id):
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    case = await Case.get(case_id)
    if case is None or case.profesor_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return case


@router.put("/{case_id}")
async def update_case(
    case_id: str, body: CaseUpdate, current_user: User = Depends(get_current_user)
) -> Case:
    case = await get_case(case_id, current_user)
    if body.alumno is not None:
        case.alumno = body.alumno
    if body.estaciones is not None:
        case.estaciones = [to_station(s) for s in body.estaciones]
    if body.status is not None:
        case.status = body.status
    case.updated_at = utcnow()
    await case.save()
    if case.status == CaseStatus.published:
        await manager.broadcast({"event": "case_published", "case_id": case_id})
    return case


@router.delete("/{case_id}", status_code=204)
async def delete_case(
    case_id: str, current_user: User = Depends(get_current_user)
) -> None:
    case = await get_case(case_id, current_user)
    await case.delete()
