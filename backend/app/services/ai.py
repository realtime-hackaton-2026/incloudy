import logging
from typing import Optional

import httpx
from fastapi import HTTPException

from ..config import settings
from ..models import Case

logger = logging.getLogger(__name__)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)


def build_prompt(message: str, case: Optional[Case]) -> str:
    if case is None:
        return message
    return f"""Contexto del caso:
- Alumno: {case.alumno.nombre} ({case.alumno.curso or 'sin curso'}, {case.alumno.edad or 'sin edad'})
- Descripción: {case.alumno.descripcion}
- Estaciones: {', '.join(station.titulo for station in case.estaciones) or 'ninguna'}

Pregunta del profesor: {message}
"""


async def ask_gemini(message: str, case: Optional[Case]) -> str:
    if not settings.gemini_api_key:
        return "El chat de IA no está configurado. Define GEMINI_API_KEY en el .env."

    prompt = build_prompt(message, case)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                GEMINI_URL,
                params={"key": settings.gemini_api_key},
                json={
                    "contents": [{"parts": [{"text": (
                        "Eres un asistente pedagógico que ayuda a un profesor a "
                        "analizar el caso de un alumno con capacidades especiales. "
                        "Responde en español.\n\n" + prompt
                    )}]}]
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except (httpx.HTTPError, KeyError, IndexError, TypeError) as error:
        logger.exception("Falló la solicitud a Gemini: %s", error)
        raise HTTPException(
            status_code=502, detail="No se pudo contactar con el servicio de IA"
        ) from error
