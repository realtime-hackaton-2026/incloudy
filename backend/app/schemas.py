from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from .models import CollaboratorRole, Student, TemplateStation


class RegisterRequest(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    nombre: str
    email: EmailStr


class JourneyTemplateCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    version: int = Field(ge=1)
    activa: bool = True
    estaciones: list[TemplateStation] = Field(min_length=1)
    contenido: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_stations(self) -> "JourneyTemplateCreate":
        station_ids = [station.id for station in self.estaciones]
        orders = [station.orden for station in self.estaciones]
        if len(station_ids) != len(set(station_ids)):
            raise ValueError("Los identificadores de estación no pueden repetirse")
        if len(orders) != len(set(orders)):
            raise ValueError("El orden de las estaciones no puede repetirse")
        for station in self.estaciones:
            option_ids = [option.id for option in station.opciones]
            if len(option_ids) != len(set(option_ids)):
                raise ValueError(
                    f"Las opciones de la estación {station.id} no pueden repetirse"
                )
            if station.obligatoria and not station.opciones:
                raise ValueError(
                    f"La estación obligatoria {station.id} necesita opciones"
                )
        return self


class CaseCreate(BaseModel):
    alumno: Student
    template_id: Optional[str] = None
    privacy_acknowledged: Literal[True] = True

    @model_validator(mode="after")
    def validate_fictional_student(self) -> "CaseCreate":
        if not self.alumno.es_ficticio:
            raise ValueError("La hackatón solo admite alumnos ficticios o anonimizados")
        return self


class CaseUpdate(BaseModel):
    alumno: Optional[Student] = None


class CaseJoinRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^[A-Za-z0-9]{6}$")


class StationResponseRequest(BaseModel):
    opciones_seleccionadas: list[str] = Field(default_factory=list)
    comentario: str = Field(default="", max_length=2_000)

    @model_validator(mode="after")
    def validate_unique_options(self) -> "StationResponseRequest":
        if len(self.opciones_seleccionadas) != len(set(self.opciones_seleccionadas)):
            raise ValueError("Una opción no puede seleccionarse más de una vez")
        return self


class SummaryUpdateRequest(BaseModel):
    contenido: str = Field(min_length=1, max_length=20_000)


class SummaryGenerateRequest(BaseModel):
    overwrite_manual: bool = False


class ChatRequest(BaseModel):
    mensaje: str = Field(min_length=1, max_length=4_000)
    case_id: Optional[str] = None


class ChatResponse(BaseModel):
    respuesta: str


class CollaboratorRequest(BaseModel):
    email: EmailStr
    role: CollaboratorRole = CollaboratorRole.commenter


class CollaboratorResponse(BaseModel):
    user_id: str
    email: EmailStr
    role: CollaboratorRole


class InvitationCreateRequest(BaseModel):
    email: EmailStr
    role: CollaboratorRole = CollaboratorRole.commenter


class InvitationCreatedResponse(BaseModel):
    invitation_id: str
    token: str
    email: EmailStr
    role: CollaboratorRole
    expires_at: str


class InvitationAcceptResponse(BaseModel):
    case_id: str
    role: CollaboratorRole


class InvitationListItem(BaseModel):
    id: str
    email: EmailStr
    role: CollaboratorRole
    status: str
    expires_at: str


class FollowUpRequest(BaseModel):
    observacion: str = Field(min_length=1, max_length=4_000)
    estacion_id: Optional[str] = Field(default=None, max_length=80)


class UnexpectedEventResponseRequest(BaseModel):
    opcion_id: str = Field(min_length=1, max_length=80)


class TeacherNoteCreateRequest(BaseModel):
    contenido: str = Field(min_length=1, max_length=4_000)
    categoria: str = Field(default="general", min_length=1, max_length=80)


class PortalSessionResponse(BaseModel):
    token: str
    expires_at: str
    channel_id: str
    publishable_key: str
