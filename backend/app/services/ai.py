import logging
from typing import Optional

import httpx
from fastapi import HTTPException

from ..config import settings
from ..models import Case, JourneyTemplate

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models"


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
    state = getattr(case, "estado_interactivo", None)
    if state is not None:
        lines.extend(
            [
                f"Días restantes: {state.dias_restantes}",
                f"Confianza del equipo: {state.confianza_equipo}%",
                f"Hipótesis sostenida: {state.hipotesis_sostenida or 'sin definir'}",
                f"Estrategia elegida: {state.estrategia_elegida or 'sin definir'}",
                f"Seguimiento: {state.seguimiento_elegido or 'sin definir'}",
                f"Pistas: {', '.join(state.pistas_recogidas) or 'ninguna'}",
                "Imprevistos resueltos: "
                + (", ".join(state.imprevistos_resueltos) or "ninguno"),
            ]
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
                f"{GEMINI_URL}/{settings.gemini_model}:generateContent",
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
    if not settings.gemini_api_key:
        if case is None:
            return (
                "El asistente local está disponible. Selecciona un caso para recibir "
                "orientación basada en el recorrido guardado."
            )
        state = case.estado_interactivo
        return (
            f"Estado actual de {case.alumno.nombre}: progreso "
            f"{case.progreso.porcentaje}%, {state.dias_restantes} días restantes y "
            f"{state.confianza_equipo}% de confianza. Hipótesis: "
            f"{state.hipotesis_sostenida or 'todavía sin definir'}. "
            "Revisa las evidencias y completa la siguiente estación antes de cerrar "
            "el análisis."
        )
    prompt = (
        "Eres un asistente pedagógico. Analiza únicamente el caso ficticio o "
        "anonimizado proporcionado. Responde en español, evita diagnósticos médicos "
        "y ofrece recomendaciones educativas prudentes.\n\n"
        + build_prompt(message, case, template)
    )
    return await _generate(prompt)


async def generate_case_summary(case: Case, template: JourneyTemplate) -> str:
    if not settings.gemini_api_key:
        return generate_local_case_summary(case, template)
    prompt = f"""Eres un asistente pedagógico. Redacta un resumen estructurado del caso
ficticio usando exclusivamente la información proporcionada. Incluye fortalezas,
necesidades observadas, estrategias recomendadas y próximos pasos. No emitas un
diagnóstico médico. Escribe en español y utiliza un tono profesional y claro.

{build_case_context(case, template)}
"""
    return await _generate(prompt)


def generate_local_case_summary(case: Case, template: JourneyTemplate) -> str:
    stations = {station.id: station for station in template.estaciones}
    decisions: list[str] = []
    for response in case.respuestas:
        station = stations.get(response.estacion_id)
        if station is None:
            continue
        options = {item.id: item.texto for item in station.opciones}
        selected = [
            options[item]
            for item in response.opciones_seleccionadas
            if item in options
        ]
        decisions.append(f"{station.titulo}: {', '.join(selected)}")
    state = case.estado_interactivo
    return "\n".join(
        [
            f"Resumen pedagógico del caso ficticio de {case.alumno.nombre}",
            "",
            "Decisiones del recorrido:",
            *(f"- {item}" for item in decisions),
            "",
            f"Hipótesis de trabajo: {state.hipotesis_sostenida or 'sin definir'}.",
            f"Estrategia aplicada: {state.estrategia_elegida or 'sin definir'}.",
            f"Seguimiento observado: {state.seguimiento_elegido or 'sin definir'}.",
            f"Confianza final del equipo: {state.confianza_equipo}%.",
            "Próximo paso: revisar periódicamente los indicadores pedagógicos y "
            "ajustar la estrategia con el equipo colaborador.",
        ]
    )
