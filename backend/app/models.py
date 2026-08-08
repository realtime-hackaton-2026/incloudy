from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from beanie import Document, Indexed
from pydantic import BaseModel, EmailStr, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CaseStatus(str, Enum):
    draft = "borrador"
    published = "publicado"


class Student(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    edad: Optional[int] = Field(default=None, ge=1, le=120)
    curso: Optional[str] = Field(default=None, max_length=100)
    descripcion: str = Field(default="", max_length=2_000)


class Station(BaseModel):
    orden: int = Field(ge=1)
    titulo: str = Field(min_length=1, max_length=150)
    descripcion: str = Field(default="", max_length=2_000)
    completado: bool = False


class User(Document):
    email: Indexed(EmailStr, unique=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=utcnow)


class Case(Document):
    profesor_id: str
    alumno: Student
    estaciones: list[Station] = Field(default_factory=list)
    status: CaseStatus = CaseStatus.draft
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
