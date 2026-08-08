from bson import ObjectId
from fastapi import HTTPException

from ..models import Case, User


async def get_owned_case(case_id: str, user: User) -> Case:
    """Obtiene un caso solo cuando existe y pertenece al profesor autenticado."""
    if not ObjectId.is_valid(case_id):
        raise HTTPException(status_code=404, detail="Caso no encontrado")

    case = await Case.get(case_id)
    if case is None or case.profesor_id != str(user.id):
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return case
