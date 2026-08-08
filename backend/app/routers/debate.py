"""backend/app/routers/debate.py // POST /cases/{id}/debate generates one round
of turns; publishing them to the case's Portal channel is the client's job.
"""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..models import PortalComment, User
from ..services.cases import get_accessible_case, get_case_template
from ..services.debate import AGENTS, MAX_ROUNDS, run_debate_round

router = APIRouter()


class DebateTurn(BaseModel):
    agente: str
    ronda: int
    argumento: str
    fortalezas: list[str] = Field(default_factory=list)
    riesgos: list[str] = Field(default_factory=list)


class DebateRoundRequest(BaseModel):
    ronda: int = Field(default=1, ge=1, le=MAX_ROUNDS)
    historial: list[DebateTurn] = Field(default_factory=list)


class DebateAgent(BaseModel):
    id: str
    nombre: str
    postura: str


class DebateRoundResponse(BaseModel):
    turnos: list[DebateTurn]
    agentes: list[DebateAgent]
    rondas_maximas: int = MAX_ROUNDS
    comentarios_analizados: int


@router.post("/{case_id}/debate", response_model=DebateRoundResponse)
async def debate_round(
    case_id: str,
    body: DebateRoundRequest,
    current_user: User = Depends(get_current_user),
) -> DebateRoundResponse:
    case = await get_accessible_case(case_id, current_user)
    template = await get_case_template(case)
    comments = await PortalComment.find(
        PortalComment.case_id == str(case.id),
        PortalComment.retracted == False,  # noqa: E712
    ).sort("portal_timestamp").to_list()

    history: list[dict[str, Any]] = [turn.model_dump() for turn in body.historial]
    turns = await run_debate_round(case, template, comments, history, body.ronda)

    return DebateRoundResponse(
        turnos=[DebateTurn(**turn) for turn in turns],
        agentes=[
            DebateAgent(id=agent_id, nombre=meta["nombre"], postura=meta["postura"])
            for agent_id, meta in AGENTS.items()
        ],
        comentarios_analizados=len(comments),
    )
