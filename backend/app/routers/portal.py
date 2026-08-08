from fastapi import APIRouter, Depends, Header, Request

from ..auth import get_current_user
from ..models import User
from ..schemas import PortalSessionResponse
from ..services.cases import get_accessible_case
from ..services.portal import create_case_session, create_user_session
from ..services.webhooks import process_portal_webhook, verify_portal_signature

router = APIRouter()


@router.post("/sessions/{case_id}", response_model=PortalSessionResponse)
async def create_session(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> PortalSessionResponse:
    case = await get_accessible_case(case_id, current_user)
    return await create_case_session(current_user, case)


@router.post("/sessions", response_model=PortalSessionResponse)
async def create_inbox_session(
    current_user: User = Depends(get_current_user),
) -> PortalSessionResponse:
    return await create_user_session(current_user)


@router.post("/webhooks", status_code=204)
async def portal_webhook(
    request: Request,
    portal_signature: str | None = Header(default=None, alias="portal-signature"),
) -> None:
    raw_body = await request.body()
    verify_portal_signature(raw_body, portal_signature)
    await process_portal_webhook(raw_body)
