from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from beanie import Document
from pydantic import BaseModel, EmailStr, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CaseStatus(str, Enum):
    draft = "borrador"
    published = "publicado"


class Student(BaseModel):
    nombre: str
    edad: Optional[int] = None
    curso: Optional[str] = None
    descripcion: str = ""


class Station(BaseModel):
    orden: int
    titulo: str
    descripcion: str = ""
    completado: bool = False


class User(Document):
    email: EmailStr = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=utcnow)


class Case(Document):
    profesor_id: str
    alumno: Student
    estaciones: list[Station] = []
    status: CaseStatus = CaseStatus.draft
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
