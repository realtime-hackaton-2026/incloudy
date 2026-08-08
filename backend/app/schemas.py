from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from .models import CaseStatus, Student


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class StationInput(BaseModel):
    orden: int = Field(ge=1)
    titulo: str = Field(min_length=1, max_length=150)
    descripcion: str = Field(default="", max_length=2_000)
    completado: bool = False


class CaseCreate(BaseModel):
    alumno: Student
    estaciones: list[StationInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_unique_station_orders(self) -> "CaseCreate":
        orders = [station.orden for station in self.estaciones]
        if len(orders) != len(set(orders)):
            raise ValueError("El orden de las estaciones no puede repetirse")
        return self


class CaseUpdate(BaseModel):
    alumno: Optional[Student] = None
    estaciones: Optional[list[StationInput]] = None
    status: Optional[CaseStatus] = None

    @model_validator(mode="after")
    def validate_unique_station_orders(self) -> "CaseUpdate":
        if self.estaciones is None:
            return self
        orders = [station.orden for station in self.estaciones]
        if len(orders) != len(set(orders)):
            raise ValueError("El orden de las estaciones no puede repetirse")
        return self


class ChatRequest(BaseModel):
    mensaje: str = Field(min_length=1, max_length=4_000)
    case_id: Optional[str] = None


class ChatResponse(BaseModel):
    respuesta: str
