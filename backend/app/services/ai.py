import logging
from typing import Optional

import httpx
from fastapi import HTTPException

from ..config import settings
from ..models import Case, JourneyTemplate, PortalComment

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models"
FALLBACK_STATUS_CODES = {404, 408, 429, 500, 502, 503, 504}


def _gemini_models() -> list[str]:
    configured = [settings.gemini_model, *settings.gemini_fallback_models.split(",")]
    models: list[str] = []
    for value in configured:
        model = value.strip().strip("\"'")
        if model and model not in models:
            models.append(model)
    return models


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

    last_error: Exception | None = None
    models = _gemini_models()
    async with httpx.AsyncClient(timeout=30) as client:
        for model in models:
            try:
                response = await client.post(
                    f"{GEMINI_URL}/{model}:generateContent",
                    params={"key": settings.gemini_api_key},
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
                response.raise_for_status()
                data = response.json()
                answer = data["candidates"][0]["content"]["parts"][0]["text"]
                if model != models[0]:
                    logger.warning("Gemini respondió usando el modelo de respaldo %s", model)
                return answer
            except httpx.HTTPStatusError as error:
                last_error = error
                status = error.response.status_code
                if status not in FALLBACK_STATUS_CODES:
                    logger.exception("Gemini rechazó la solicitud con %s", status)
                    raise HTTPException(
                        status_code=status,
                        detail="Gemini rechazó la configuración o la solicitud",
                    ) from error
                logger.warning("Gemini %s no está disponible (%s); probando respaldo", model, status)
            except (httpx.RequestError, KeyError, IndexError, TypeError) as error:
                last_error = error
                logger.warning("Falló Gemini %s; probando respaldo: %s", model, error)

    logger.error("Fallaron todos los modelos Gemini configurados: %s", last_error)
    raise HTTPException(
        status_code=502,
        detail="No se pudo contactar con ningún modelo de IA configurado",
    ) from last_error


async def ask_gemini(
    message: str,
    case: Optional[Case],
    template: Optional[JourneyTemplate] = None,
) -> str:
    if not settings.gemini_api_key:
        return _local_chat_response(case)
    prompt = (
        "Eres un asistente pedagógico. Analiza únicamente el caso ficticio o "
        "anonimizado proporcionado. Responde en español, evita diagnósticos médicos "
        "y ofrece recomendaciones educativas prudentes.\n\n"
        + build_prompt(message, case, template)
    )
    try:
        return await _generate(prompt)
    except HTTPException as error:
        if error.status_code != 502:
            raise
        logger.warning("Gemini no está disponible; se usará la orientación local")
        return _local_chat_response(case, provider_unavailable=True)


def _local_chat_response(
    case: Optional[Case], *, provider_unavailable: bool = False
) -> str:
    notice = (
        "Búrix está usando temporalmente la orientación local. "
        if provider_unavailable
        else ""
    )
    if case is None:
        return notice + (
            "Selecciona un caso para recibir orientación basada en el recorrido guardado."
        )
    state = case.estado_interactivo
    return (
        notice
        + f"Estado actual de {case.alumno.nombre}: progreso "
        f"{case.progreso.porcentaje}%, {state.dias_restantes} días restantes y "
        f"{state.confianza_equipo}% de confianza. Hipótesis: "
        f"{state.hipotesis_sostenida or 'todavía sin definir'}. "
        "Revisa las evidencias y completa la siguiente estación antes de cerrar "
        "el análisis."
    )


def build_comments_context(comments: list[PortalComment]) -> str:
    lines: list[str] = []
    for comment in comments:
        content = comment.content or {}
        text = (
            content.get("body")
            or content.get("text")
            or content.get("content")
            or str(content)
        )
        if not text:
            continue
        lines.append(f"- Docente {comment.author_id[-4:]}: {text}")
    return "\n".join(lines)


async def generate_case_analysis(
    case: Case,
    template: Optional[JourneyTemplate],
    comments: list[PortalComment],
) -> str:
    if not settings.gemini_api_key:
        return generate_local_case_analysis(case, template, comments)
    comments_text = build_comments_context(comments)
    prompt = f"""Eres Búrix, el búho guía de una sala docente que acompaña a un
estudiante ficticio. Analiza el caso y los comentarios que el equipo ha dejado en la
sala. Estructura tu respuesta en secciones claras:
- Diagnóstico hipotético (basado solo en las evidencias del caso)
- Lo que el equipo ha observado en la sala
- Puntos a considerar
- Próximos pasos sugeridos
Empieza directamente con la sección de diagnóstico: sin saludo, sin presentación y
sin despedida. No emitas un diagnóstico médico; el estudiante es ficticio o
anonimizado. Escribe en español, con tono profesional y cálido.

{build_case_context(case, template)}

Comentarios de la sala (tiempo real):
{comments_text or "Aún no hay comentarios del equipo."}
"""
    return await _generate(prompt)


def generate_local_case_analysis(
    case: Case,
    template: Optional[JourneyTemplate],
    comments: list[PortalComment],
) -> str:
    summary = (
        generate_local_case_summary(case, template)
        if template is not None
        else f"Estado actual de {case.alumno.nombre}: sin plantilla activa."
    )
    comments_text = build_comments_context(comments)
    room = (
        f"{len(comments)} comentario(s) de la sala:\n{comments_text}"
        if comments_text
        else "sin comentarios aún en la sala."
    )
    return "\n".join(
        [
            f"Análisis local de Búrix para el caso ficticio de {case.alumno.nombre}",
            "",
            summary,
            "",
            f"La sala dice: {room}",
            "",
            "Conecta GEMINI_API_KEY en el servidor para un análisis completo con IA.",
        ]
    )


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
