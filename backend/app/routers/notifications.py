from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..models import Notification, User, utcnow

router = APIRouter()


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
) -> list[Notification]:
    query: dict = {"user_id": str(current_user.id)}
    if unread_only:
        query["read_at"] = None
    return await Notification.find(query).sort("-created_at").limit(100).to_list()


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
) -> Notification:
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notification = await Notification.get(notification_id)
    if notification is None or notification.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notification.read_at = utcnow()
    await notification.save()
    return notification


@router.put("/read-all", status_code=204)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
) -> None:
    items = await Notification.find(
        Notification.user_id == str(current_user.id),
        Notification.read_at == None,  # noqa: E711
    ).to_list()
    for notification in items:
        notification.read_at = utcnow()
        await notification.save()
