import hashlib
import secrets
from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_user
from ..config import settings
from ..models import Case, CaseStatus, Invitation, InvitationStatus, User, utcnow
from ..schemas import (
    InvitationAcceptResponse,
    InvitationCreateRequest,
    InvitationCreatedResponse,
    InvitationListItem,
)
from ..services.cases import (
    add_or_update_collaborator,
    create_notification,
    get_owned_case,
    record_event,
)

router = APIRouter()


def hash_invitation_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.post(
    "/cases/{case_id}/invitations",
    response_model=InvitationCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    case_id: str,
    body: InvitationCreateRequest,
    current_user: User = Depends(get_current_user),
) -> InvitationCreatedResponse:
    case = await get_owned_case(case_id, current_user)
    if case.status in {CaseStatus.closed, CaseStatus.archived}:
        raise HTTPException(status_code=409, detail="El caso no acepta invitaciones")
    if body.email == current_user.email:
        raise HTTPException(status_code=400, detail="No puedes invitarte a ti mismo")

    existing = await Invitation.find_one(
        Invitation.case_id == case_id,
        Invitation.email == body.email,
        Invitation.status == InvitationStatus.pending,
    )
    if existing is not None and existing.expires_at > utcnow():
        raise HTTPException(status_code=409, detail="Ya existe una invitación pendiente")

    raw_token = secrets.token_urlsafe(32)
    invitation = Invitation(
        case_id=case_id,
        email=body.email,
        role=body.role,
        invited_by=str(current_user.id),
        token_hash=hash_invitation_token(raw_token),
        expires_at=utcnow() + timedelta(hours=settings.invitation_expire_hours),
    )
    await invitation.insert()
    await record_event(
        case,
        str(current_user.id),
        "invitacion_creada",
        {"email": str(body.email), "role": body.role.value},
    )

    invited_user = await User.find_one(User.email == body.email)
    if invited_user is not None:
        await create_notification(
            str(invited_user.id),
            "invitacion_pendiente",
            "Invitación a colaborar",
            f"Te invitaron al caso de {case.alumno.nombre}.",
            case_id,
        )

    return InvitationCreatedResponse(
        invitation_id=str(invitation.id),
        token=raw_token,
        email=invitation.email,
        role=invitation.role,
        expires_at=invitation.expires_at.isoformat(),
    )


@router.get(
    "/cases/{case_id}/invitations",
    response_model=list[InvitationListItem],
)
async def list_invitations(
    case_id: str,
    current_user: User = Depends(get_current_user),
) -> list[InvitationListItem]:
    await get_owned_case(case_id, current_user)
    items = await Invitation.find(Invitation.case_id == case_id).sort(
        "-created_at"
    ).to_list()
    return [
        InvitationListItem(
            id=str(item.id),
            email=item.email,
            role=item.role,
            status=item.status.value,
            expires_at=item.expires_at.isoformat(),
        )
        for item in items
    ]


@router.post(
    "/invitations/{token}/accept",
    response_model=InvitationAcceptResponse,
)
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
) -> InvitationAcceptResponse:
    invitation = await Invitation.find_one(
        Invitation.token_hash == hash_invitation_token(token)
    )
    if invitation is None or invitation.status != InvitationStatus.pending:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if invitation.expires_at <= utcnow():
        invitation.status = InvitationStatus.expired
        await invitation.save()
        raise HTTPException(status_code=410, detail="La invitación expiró")
    if invitation.email != current_user.email:
        raise HTTPException(status_code=403, detail="La invitación pertenece a otro correo")
    if not ObjectId.is_valid(invitation.case_id):
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    case = await Case.get(invitation.case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    if case.status in {CaseStatus.closed, CaseStatus.archived}:
        raise HTTPException(status_code=409, detail="El caso ya no acepta colaboradores")

    add_or_update_collaborator(case, str(current_user.id), invitation.role)
    case.updated_at = utcnow()
    invitation.status = InvitationStatus.accepted
    invitation.accepted_by = str(current_user.id)
    await case.save()
    await invitation.save()
    await record_event(
        case,
        str(current_user.id),
        "invitacion_aceptada",
        {"role": invitation.role.value},
    )
    await create_notification(
        case.profesor_id,
        "invitacion_aceptada",
        "Invitación aceptada",
        f"{current_user.nombre} aceptó la invitación.",
        str(case.id),
    )
    return InvitationAcceptResponse(case_id=str(case.id), role=invitation.role)


@router.delete("/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    invitation_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    if not ObjectId.is_valid(invitation_id):
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    invitation = await Invitation.get(invitation_id)
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    case = await get_owned_case(invitation.case_id, current_user)
    invitation.status = InvitationStatus.revoked
    await invitation.save()
    await record_event(
        case,
        str(current_user.id),
        "invitacion_revocada",
        {"email": str(invitation.email)},
    )
