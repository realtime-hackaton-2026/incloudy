from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from beanie import Document, Indexed
from pydantic import BaseModel, EmailStr, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class CaseStatus(str, Enum):
    draft = "borrador"
    in_progress = "en_progreso"
    completed = "completado"
    published = "publicado"
    closed = "cerrado"
    archived = "archivado"


class QuestionType(str, Enum):
    single = "unica"
    multiple = "multiple"


class CollaboratorRole(str, Enum):
    editor = "editor"
    commenter = "comentarista"
    reader = "lector"


class InvitationStatus(str, Enum):
    pending = "pendiente"
    accepted = "aceptada"
    revoked = "revocada"
    expired = "expirada"


class Student(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    edad: Optional[int] = Field(default=None, ge=1, le=120)
    curso: Optional[str] = Field(default=None, max_length=100)
    descripcion: str = Field(default="", max_length=2_000)
    es_ficticio: bool = True

    def titulo_caso(self) -> str:
        return f"Caso de {self.nombre}"


class StationOption(BaseModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9_-]+$")
    texto: str = Field(min_length=1, max_length=500)
    icono: Optional[str] = Field(default=None, max_length=20)
    contenido: dict[str, Any] = Field(default_factory=dict)


class TemplateStation(BaseModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9_-]+$")
    orden: int = Field(ge=1)
    titulo: str = Field(min_length=1, max_length=150)
    subtitulo: str = Field(default="", max_length=200)
    descripcion: str = Field(default="", max_length=2_000)
    tipo: QuestionType = QuestionType.single
    obligatoria: bool = True
    opciones: list[StationOption] = Field(default_factory=list)
    contenido: dict[str, Any] = Field(default_factory=dict)


class Station(BaseModel):
    """Formato anterior conservado para leer casos creados antes de las plantillas."""

    orden: int = Field(ge=1)
    titulo: str = Field(min_length=1, max_length=150)
    descripcion: str = Field(default="", max_length=2_000)
    completado: bool = False


class StationResponse(BaseModel):
    estacion_id: str
    opciones_seleccionadas: list[str] = Field(default_factory=list)
    comentario: str = Field(default="", max_length=2_000)
    completado: bool = True
    respondido_por: str
    respondido_en: datetime = Field(default_factory=utcnow)


class CaseProgress(BaseModel):
    completadas: int = 0
    total: int = 0
    porcentaje: int = Field(default=0, ge=0, le=100)


class FinalSummary(BaseModel):
    contenido: str = Field(default="", max_length=20_000)
    generado_por_ia: bool = False
    editado_manualmente: bool = False
    actualizado_por: Optional[str] = None
    actualizado_en: Optional[datetime] = None


class Collaborator(BaseModel):
    user_id: str
    role: CollaboratorRole = CollaboratorRole.commenter
    added_at: datetime = Field(default_factory=utcnow)


class TeacherNote(Document):
    case_id: str
    user_id: str
    contenido: str = Field(min_length=1, max_length=4_000)
    categoria: str = Field(default="general", max_length=80)
    creada_en: datetime = Field(default_factory=utcnow)


class InteractiveCaseState(BaseModel):
    estacion_actual: str = "explorar"
    dias_totales: int = Field(default=7, ge=0)
    dias_restantes: int = Field(default=7, ge=0)
    confianza_equipo: int = Field(default=50, ge=0, le=100)
    xp_total: int = Field(default=0, ge=0)
    pistas_recogidas: list[str] = Field(default_factory=list)
    hipotesis_sostenida: Optional[str] = None
    estrategia_elegida: Optional[str] = None
    seguimiento_elegido: Optional[str] = None
    compartido_con: list[str] = Field(default_factory=list)
    imprevistos_resueltos: list[str] = Field(default_factory=list)


class User(Document):
    nombre: str = Field(default="Profesor", min_length=1, max_length=100)
    email: Indexed(EmailStr, unique=True)
    hashed_password: str
    is_admin: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class JourneyTemplate(Document):
    nombre: str = Field(min_length=1, max_length=150)
    version: int = Field(ge=1)
    activa: bool = True
    estaciones: list[TemplateStation] = Field(min_length=1)
    contenido: dict[str, Any] = Field(default_factory=dict)
    created_by: str
    created_at: datetime = Field(default_factory=utcnow)


class CaseScenario(Document):
    slug: Indexed(str, unique=True)
    nombre: str = Field(min_length=1, max_length=150)
    template_id: str
    template_version: int = Field(ge=1)
    alumno: Student
    presentacion: str = Field(max_length=4_000)
    hipotesis: list[StationOption] = Field(default_factory=list)
    estado_inicial: InteractiveCaseState = Field(default_factory=InteractiveCaseState)
    contenido: dict[str, Any] = Field(default_factory=dict)
    activa: bool = True
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Case(Document):
    profesor_id: str
    # Short room code shared between teachers. Older documents may not have
    # one yet; the cases router assigns it lazily when they are read.
    join_code: Optional[str] = Field(default=None, min_length=6, max_length=6)
    colaboradores: list[Collaborator] = Field(default_factory=list)
    colaboradores_ids: list[str] = Field(default_factory=list)
    template_id: Optional[str] = None
    template_version: Optional[int] = None
    scenario_id: Optional[str] = None
    alumno: Student
    respuestas: list[StationResponse] = Field(default_factory=list)
    progreso: CaseProgress = Field(default_factory=CaseProgress)
    resumen_final: FinalSummary = Field(default_factory=FinalSummary)
    estaciones: list[Station] = Field(default_factory=list)
    estado_interactivo: InteractiveCaseState = Field(default_factory=InteractiveCaseState)
    status: CaseStatus = CaseStatus.draft
    retention_until: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Invitation(Document):
    case_id: str
    email: EmailStr
    role: CollaboratorRole
    invited_by: str
    token_hash: Indexed(str, unique=True)
    status: InvitationStatus = InvitationStatus.pending
    expires_at: datetime
    accepted_by: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


class CaseEvent(Document):
    case_id: str
    user_id: str
    event: str
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)


class Notification(Document):
    user_id: str
    tipo: str
    titulo: str = Field(max_length=200)
    mensaje: str = Field(max_length=1_000)
    case_id: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)


class PortalComment(Document):
    event_id: Indexed(str, unique=True)
    message_id: str
    case_id: str
    channel_id: str
    author_id: str
    content: dict[str, Any] = Field(default_factory=dict)
    retracted: bool = False
    portal_timestamp: datetime
    created_at: datetime = Field(default_factory=utcnow)
