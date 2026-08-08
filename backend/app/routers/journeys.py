from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_user
from ..models import CaseScenario, JourneyTemplate, User
from ..schemas import JourneyTemplateCreate

router = APIRouter()


@router.get("/scenarios")
async def list_scenarios(
    current_user: User = Depends(get_current_user),
) -> list[CaseScenario]:
    return await CaseScenario.find(CaseScenario.activa == True).to_list()  # noqa: E712


@router.get("/scenarios/{slug}")
async def get_scenario(
    slug: str,
    current_user: User = Depends(get_current_user),
) -> CaseScenario:
    scenario = await CaseScenario.find_one(CaseScenario.slug == slug)
    if scenario is None or not scenario.activa:
        raise HTTPException(status_code=404, detail="Escenario no encontrado")
    return scenario


@router.get("/templates")
async def list_templates(
    current_user: User = Depends(get_current_user),
) -> list[JourneyTemplate]:
    return await JourneyTemplate.find_all().sort("-created_at").to_list()


@router.get("/templates/active")
async def get_active_template(
    current_user: User = Depends(get_current_user),
) -> JourneyTemplate:
    template = await JourneyTemplate.find_one(JourneyTemplate.activa == True)  # noqa: E712
    if template is None:
        raise HTTPException(status_code=404, detail="No existe una plantilla activa")
    return template


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
) -> JourneyTemplate:
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    template = await JourneyTemplate.get(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return template


@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_template(
    body: JourneyTemplateCreate,
    current_user: User = Depends(get_current_user),
) -> JourneyTemplate:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Solo un administrador puede gestionar plantillas",
        )
    existing = await JourneyTemplate.find_one(
        JourneyTemplate.nombre == body.nombre,
        JourneyTemplate.version == body.version,
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Ya existe esa versión de la plantilla",
        )
    if body.activa:
        active_templates = await JourneyTemplate.find(
            JourneyTemplate.activa == True  # noqa: E712
        ).to_list()
        for active in active_templates:
            active.activa = False
            await active.save()

    template = JourneyTemplate(
        nombre=body.nombre,
        version=body.version,
        activa=body.activa,
        estaciones=body.estaciones,
        contenido=body.contenido,
        created_by=str(current_user.id),
    )
    await template.insert()
    return template
