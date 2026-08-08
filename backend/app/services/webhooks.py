import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from ..config import settings
from ..models import Case, PortalComment
from .cases import notify_case_participants, record_event

SIGNATURE_TOLERANCE_SECONDS = 300


def verify_portal_signature(raw_body: bytes, signature_header: str | None) -> None:
    if not settings.portal_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook de Portal no configurado")
    if not signature_header:
        raise HTTPException(status_code=401, detail="Firma de Portal ausente")

    parts = dict(
        pair.split("=", 1)
        for pair in signature_header.split(",")
        if "=" in pair
    )
    timestamp = parts.get("t")
    signature = parts.get("v1")
    try:
        timestamp_number = int(timestamp or "")
    except ValueError as error:
        raise HTTPException(status_code=401, detail="Firma de Portal inválida") from error
    if not signature or abs(time.time() - timestamp_number) > SIGNATURE_TOLERANCE_SECONDS:
        raise HTTPException(status_code=401, detail="Firma de Portal expirada")

    signed_payload = str(timestamp_number).encode() + b"." + raw_body
    expected = hmac.new(
        settings.portal_webhook_secret.encode(),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Firma de Portal inválida")


async def process_portal_webhook(raw_body: bytes) -> None:
    try:
        event: dict[str, Any] = json.loads(raw_body)
        event_id = str(event["id"])
        event_type = str(event["type"])
        channel_id = str(event["channelId"])
        data = event["data"]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Evento de Portal inválido") from error

    if not channel_id.startswith("case-"):
        return
    case_id = channel_id.removeprefix("case-")
    if not ObjectId.is_valid(case_id):
        return
    case = await Case.get(case_id)
    if case is None:
        return

    existing = await PortalComment.find_one(PortalComment.event_id == event_id)
    if existing is not None:
        return

    message_id = str(data.get("id", event_id))
    if event_type == "message.retracted":
        comment = await PortalComment.find_one(PortalComment.message_id == message_id)
        if comment is not None:
            comment.retracted = True
            comment.content = {}
            await comment.save()
        marker = PortalComment(
            event_id=event_id,
            message_id=message_id,
            case_id=case_id,
            channel_id=channel_id,
            author_id=str(data.get("sender", {}).get("id", "portal")),
            content={},
            retracted=True,
            portal_timestamp=datetime.fromtimestamp(
                int(event.get("timestamp", 0)) / 1000,
                tz=timezone.utc,
            ),
        )
        try:
            await marker.insert()
        except DuplicateKeyError:
            return
        return

    if event_type != "message.published":
        return

    author_id = str(data.get("sender", {}).get("id", "portal"))
    comment = PortalComment(
        event_id=event_id,
        message_id=message_id,
        case_id=case_id,
        channel_id=channel_id,
        author_id=author_id,
        content=data.get("content") or {},
        portal_timestamp=datetime.fromtimestamp(
            int(data.get("timestamp", event.get("timestamp", 0))) / 1000,
            tz=timezone.utc,
        ),
    )
    try:
        await comment.insert()
    except DuplicateKeyError:
        return
    await record_event(
        case,
        author_id,
        "comentario_portal",
        {"message_id": message_id},
    )
    await notify_case_participants(
        case,
        author_id,
        "comentario_portal",
        "Nuevo comentario",
        "Hay un nuevo comentario en la sala compartida.",
    )
