from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import get_current_user
from ..config import settings
from ..models import Case, User

router = APIRouter()

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)


class ChatRequest(BaseModel):
    mensaje: str
    case_id: Optional[str] = None


class ChatResponse(BaseModel):
    respuesta: str


def build_prompt(mensaje: str, case: Optional[Case]) -> str:
    if case is None:
        return mensaje
    resumen = f"""
Contexto del caso:
- Alumno: {case.alumno.nombre} ({case.alumno.curso or 'sin curso'}, {case.alumno.edad or 'sin edad'})
- Descripción: {case.alumno.descripcion}
- Estaciones: {', '.join(s.titulo for s in case.estaciones) or 'ninguna'}

Pregunta del profesor: {mensaje}
"""
    return resumen


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest, current_user: User = Depends(get_current_user)
) -> ChatResponse:
    case = None
    if body.case_id is not None:
        case = await Case.get(body.case_id)
        if case is None or case.profesor_id != str(current_user.id):
            raise HTTPException(status_code=404, detail="Caso no encontrado")

    prompt = build_prompt(body.mensaje, case)

    if not settings.gemini_api_key:
        return ChatResponse(
            respuesta="El chat de IA no está configurado. Define GEMINI_API_KEY en el .env."
        )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                GEMINI_URL,
                params={"key": settings.gemini_api_key},
                json={
                    "contents": [
                        {
                            "parts": [
                                {
                                    "text": "Eres un asistente pedagógico que ayuda a un "
                                    "profesor a analizar el caso de un alumno con "
                                    "capacidades especiales. Responde en español.\n\n"
                                    + prompt
                                }
                            ]
                        }
                    ]
                },
            )
            response.raise_for_status()
            data = response.json()
        respuesta = data["candidates"][0]["content"]["parts"][0]["text"]
        return ChatResponse(respuesta=respuesta)
    except Exception:
        raise HTTPException(
            status_code=502, detail="No se pudo contactar con el servicio de IA"
        )
