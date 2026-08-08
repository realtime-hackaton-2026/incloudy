import logging
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from ..config import settings
from ..models import Case, CaseStatus, User
from ..schemas import PortalSessionResponse
from .cases import user_role

logger = logging.getLogger(__name__)


def case_channel_id(case: Case) -> str:
    return f"case-{case.id}"


def is_portal_configured() -> bool:
    secret = settings.portal_secret_key.strip()
    publishable = settings.portal_publishable_key.strip()
    # Portal uses sk_* server credentials and pk_* browser credentials.
    # Rejecting a swapped/placeholder key here turns a silent realtime failure
    # into a useful 503 in the UI.
    return (
        secret.startswith("sk_")
        and publishable.startswith("pk_")
        and "reemplaza" not in secret.lower()
        and "tu_clave" not in secret.lower()
        and "reemplaza" not in publishable.lower()
        and "tu_clave" not in publishable.lower()
    )


def ensure_portal_configured() -> None:
    if not is_portal_configured():
        raise HTTPException(
            status_code=503,
            detail="Portal no está configurado en el servidor",
        )


async def portal_post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    ensure_portal_configured()
    try:
        async with httpx.AsyncClient(
            base_url=settings.portal_api_url,
            timeout=15,
            headers={
                "Authorization": f"Bearer {settings.portal_secret_key}",
                "Content-Type": "application/json",
            },
        ) as client:
            response = await client.post(path, json=payload)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.exception("Falló una solicitud a Portal: %s", error)
        raise HTTPException(
            status_code=502,
            detail="No se pudo contactar con Portal",
        ) from error


async def portal_delete(path: str) -> None:
    ensure_portal_configured()
    try:
        async with httpx.AsyncClient(
            base_url=settings.portal_api_url,
            timeout=15,
            headers={"Authorization": f"Bearer {settings.portal_secret_key}"},
        ) as client:
            response = await client.delete(path)
            if response.status_code != 404:
                response.raise_for_status()
    except httpx.HTTPError as error:
        logger.exception("Falló una solicitud a Portal: %s", error)
        raise HTTPException(
            status_code=502,
            detail="No se pudo contactar con Portal",
        ) from error


async def create_case_session(user: User, case: Case) -> PortalSessionResponse:
    channel_id = case_channel_id(case)
    user_id = str(user.id)
    role = user_role(case, user_id)
    if role is None:
        raise HTTPException(status_code=403, detail="No tienes acceso a la sala")
    if case.status == CaseStatus.archived:
        raise HTTPException(status_code=409, detail="El caso está archivado")
    can_publish = role != "lector" and case.status != CaseStatus.closed
    # Mirrored into claims, not just `grants`: grants gate the socket, but the
    # frontend reads `me.claims` back from the SDK and has no other way to
    # know its own permission before attempting to use it. Presentation-only,
    # per the SDK's own contract for claims — Portal still enforces `grants`
    # as the real authorization on every send.
    claims = {
        "email": str(user.email),
        "role": role,
        "username": user.nombre,
        "canPublish": can_publish,
    }
    grants = ["connect"]
    if can_publish:
        grants.append("publish")

    await portal_post(
        f"/v1/channels/{quote(channel_id, safe='')}/members",
        {"userId": user_id, "claims": claims},
    )
    token_data = await portal_post(
        "/v1/tokens",
        {
            "userId": user_id,
            "claims": claims,
            "channels": {channel_id: grants},
            "ttl": settings.portal_token_ttl,
        },
    )

    try:
        return PortalSessionResponse(
            token=token_data["token"],
            expires_at=token_data["expiresAt"],
            channel_id=channel_id,
            publishable_key=settings.portal_publishable_key,
        )
    except (KeyError, TypeError) as error:
        logger.exception("Portal devolvió una respuesta inesperada")
        raise HTTPException(
            status_code=502,
            detail="Portal devolvió una respuesta inválida",
        ) from error


async def remove_case_member(case: Case, user_id: str) -> None:
    channel_id = quote(case_channel_id(case), safe="")
    member_id = quote(user_id, safe="")
    await portal_delete(f"/v1/channels/{channel_id}/members/{member_id}")


async def create_user_session(user: User) -> PortalSessionResponse:
    """User-scoped Portal token for the inbox socket: identity, no channel
    grants — the inbox is per-user, and case channels stay case-scoped."""
    token_data = await portal_post(
        "/v1/tokens",
        {
            "userId": str(user.id),
            "claims": {"email": str(user.email), "username": user.nombre},
            "ttl": settings.portal_token_ttl,
        },
    )
    try:
        return PortalSessionResponse(
            token=token_data["token"],
            expires_at=token_data["expiresAt"],
            publishable_key=settings.portal_publishable_key,
        )
    except (KeyError, TypeError) as error:
        logger.exception("Portal devolvió una respuesta inesperada")
        raise HTTPException(
            status_code=502,
            detail="Portal devolvió una respuesta inválida",
        ) from error


async def send_user_notification(
    user_id: str,
    item_type: str,
    title: str,
    data: dict[str, Any] | None = None,
) -> None:
    """Best-effort push to the recipient's Portal inbox — a delivery failure
    must never break the case flow that produced the notification."""
    if not is_portal_configured():
        return
    try:
        await portal_post(
            f"/v1/users/{quote(user_id, safe='')}/notifications",
            {"type": item_type, "title": title, "data": data or {}},
        )
    except HTTPException:
        logger.exception("No se pudo entregar la notificación a %s por Portal", user_id)
