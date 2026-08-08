import logging
from typing import Optional

import httpx
from fastapi import HTTPException

from ..config import settings
from ..models import Case, JourneyTemplate

logger = logging.getLogger(__name__)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)


def build_case_context(case: Case, template: Optional[JourneyTemplate] = None) -> str:
    lines = [
        f"Alumno ficticio: {case.alumno.nombre}",
        f"Curso: {case.alumno.curso or 'sin curso'}",
        f"Edad: {case.alumno.edad or 'sin edad'}",
        f"Descripción: {case.alumno.descripcion or 'sin descripción'}",
    ]

    if template is not None:
        stations = {station.id: station for station in template.estaciones}
        lines.append("Respuestas del recorrido:")
        for response in case.respuestas:
            station = stations.get(response.estacion_id)
            if station is None:
                continue
            options = {option.id: option.texto for option in station.opciones}
            selected = [
                options[option_id]
                for option_id in response.opciones_seleccionadas
                if option_id in options
            ]
            lines.append(
                f"- {station.titulo}: {', '.join(selected) or 'sin selección'}; "
                f"comentario: {response.comentario or 'sin comentario'}"
            )
    elif case.estaciones:
        lines.append(
            "Estaciones: " + ", ".join(station.titulo for station in case.estaciones)
        )
    return "\n".join(lines)


def build_prompt(
    message: str,
    case: Optional[Case],
    template: Optional[JourneyTemplate] = None,
) -> str:
    if case is None:
        return message
    return f"{build_case_context(case, template)}\n\nPregunta del profesor: {message}"


async def _generate(prompt: str) -> str:
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini no está configurado en el servidor",
        )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                GEMINI_URL,
                params={"key": settings.gemini_api_key},
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except (httpx.HTTPError, KeyError, IndexError, TypeError) as error:
        logger.exception("Falló la solicitud a Gemini: %s", error)
        raise HTTPException(
            status_code=502,
            detail="No se pudo contactar con el servicio de IA",
        ) from error


async def ask_gemini(
    message: str,
    case: Optional[Case],
    template: Optional[JourneyTemplate] = None,
) -> str:
    prompt = (
        "Eres un asistente pedagógico. Analiza únicamente el caso ficticio o "
        "anonimizado proporcionado. Responde en español, evita diagnósticos médicos "
        "y ofrece recomendaciones educativas prudentes.\n\n"
        + build_prompt(message, case, template)
    )
    return await _generate(prompt)


async def generate_case_summary(case: Case, template: JourneyTemplate) -> str:
    prompt = f"""Eres un asistente pedagógico. Redacta un resumen estructurado del caso
ficticio usando exclusivamente la información proporcionada. Incluye fortalezas,
necesidades observadas, estrategias recomendadas y próximos pasos. No emitas un
diagnóstico médico. Escribe en español y utiliza un tono profesional y claro.

{build_case_context(case, template)}
"""
    return await _generate(prompt)
