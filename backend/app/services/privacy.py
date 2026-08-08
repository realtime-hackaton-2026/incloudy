from ..models import Case, CaseStatus, utcnow


async def archive_expired_cases() -> int:
    """Archiva casos al terminar su periodo activo; nunca borra datos silenciosamente."""
    expired = await Case.find(
        {
            "retention_until": {"$lte": utcnow()},
            "status": {"$ne": CaseStatus.archived.value},
        }
    ).to_list()
    for case in expired:
        case.status = CaseStatus.archived
        case.updated_at = utcnow()
        await case.save()
    return len(expired)
