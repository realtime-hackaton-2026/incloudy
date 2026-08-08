from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..schemas import PortalSessionResponse
from ..services.cases import get_accessible_case
from ..services.portal import create_case_session

router = APIRouter()


@router.post("/sessions/{case_id}", response_model=PortalSessionResponse)
async def create_session(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> PortalSessionResponse:
    case = await get_accessible_case(case_id, current_user)
    return await create_case_session(current_user, case)
