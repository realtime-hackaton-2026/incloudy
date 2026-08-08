from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..schemas import ChatRequest, ChatResponse
from ..services.ai import ask_gemini
from ..services.cases import get_accessible_case, get_case_template

router = APIRouter()

@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest, current_user: User = Depends(get_current_user)
) -> ChatResponse:
    case = None
    template = None
    if body.case_id is not None:
        case = await get_accessible_case(body.case_id, current_user)
        template = await get_case_template(case)

    return ChatResponse(
        respuesta=await ask_gemini(body.mensaje, case, template)
    )
