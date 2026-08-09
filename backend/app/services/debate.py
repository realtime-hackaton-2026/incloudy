"""backend/app/services/debate.py // two agents argue opposite sides of a case:
Búrix holds out for evidence, Tero for support that cannot wait.
"""

import json
import logging
from typing import Any, Optional

from ..config import settings
from ..models import Case, JourneyTemplate, PortalComment
from .ai import _generate, build_case_context, build_comments_context

logger = logging.getLogger(__name__)

# Ids travel to the client; `nombre` is what the room actually shows.
BURIX = "burix"
TERO = "tero"

AGENTS: dict[str, dict[str, str]] = {
    BURIX: {
        "nombre": "Búrix",
        "postura": "La evidencia primero",
        "encargo": (
            "Defiendes que el equipo no debe actuar más allá de lo que la "
            "evidencia recogida sostiene. Señalas qué es observación y qué es "
            "interpretación, y adviertes cuando una hipótesis se está "
            "convirtiendo en etiqueta. Reconoces el coste de tu propia "
            "postura: esperar también deja al alumno sin apoyo."
        ),
    },
    TERO: {
        "nombre": "Tero",
        "postura": "El apoyo no puede esperar",
        "encargo": (
            "Defiendes que un apoyo razonable y reversible aplicado hoy vale "
            "más que una certeza que llega tarde. Buscas la acción más "
            "pequeña que ya se puede sostener con lo que hay. Reconoces el "
            "coste de tu propia postura: actuar con poca evidencia puede "
            "encasillar al alumno."
        ),
    },
}

MAX_ROUNDS = 3


def _turn_schema_hint() -> str:
    return (
        '{"argumento": "2-3 frases dirigidas al equipo docente y al otro '
        'agente", "fortalezas": ["qué gana el caso si se sigue esta '
        'postura"], "riesgos": ["qué se arriesga si se sigue esta postura"]}'
    )


def _first_json_object(text: str) -> str | None:
    """Slice out the first balanced ``{...}``, ignoring braces inside strings.

    Models wrap the object in prose or leave a stray closing brace behind, and
    ``json.loads`` needs the *whole* string to be valid — so one extra ``}``
    used to dump the raw JSON on screen as if it were the argument.
    """
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return None


def _parse_turn(raw: str) -> dict[str, Any]:
    """Parse a turn, degrading to argument-only rather than raising.

    A malformed turn costs the gains/risks columns, not the whole debate.
    """
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1] if "```" in text[3:] else text.strip("`")
        text = text.removeprefix("json").strip()

    data: Any = None
    for candidate in (text, _first_json_object(text)):
        if not candidate:
            continue
        try:
            data = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue
        break

    if not isinstance(data, dict):
        return {"argumento": raw.strip(), "fortalezas": [], "riesgos": []}
    return {
        "argumento": str(data.get("argumento", "")).strip() or raw.strip(),
        "fortalezas": _string_list(data.get("fortalezas")),
        "riesgos": _string_list(data.get("riesgos")),
    }


def _string_list(value: Any) -> list[str]:
    """Up to three non-empty strings. A bare string is one item, not a list
    of characters, which is what iterating it directly would produce."""
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:3]


def _history_text(history: list[dict[str, Any]]) -> str:
    if not history:
        return "Todavía nadie ha hablado; abres tú el debate."
    lines = []
    for turn in history[-4:]:
        agent = AGENTS.get(str(turn.get("agente")), {}).get("nombre", "Agente")
        lines.append(f"{agent}: {turn.get('argumento', '')}")
    return "\n".join(lines)


async def _agent_turn(
    agent_id: str,
    case: Case,
    template: Optional[JourneyTemplate],
    comments: list[PortalComment],
    history: list[dict[str, Any]],
    ronda: int,
) -> dict[str, Any]:
    agent = AGENTS[agent_id]
    if not settings.gemini_api_key:
        return {"agente": agent_id, "ronda": ronda, **_local_turn(agent_id, case, comments)}

    prompt = f"""Eres {agent['nombre']}, uno de los dos guías de una sala docente que
analiza el caso de un estudiante ficticio o anonimizado.

Tu postura fija en este debate: "{agent['postura']}".
{agent['encargo']}

Reglas:
- Discutes con el otro guía, pero nunca lo descalificas: ambas posturas son
  defendibles y el equipo docente decide, no vosotros.
- Nunca emites un diagnóstico médico ni pones una etiqueta al alumno.
- Te apoyas en las evidencias del caso y en lo que el equipo ha escrito en la
  sala. Si algo no está en los datos, dilo en vez de inventarlo.
- Español, tono profesional y cálido, sin condescendencia.
- Responde SOLO con un JSON válido con esta forma: {_turn_schema_hint()}

Caso:
{build_case_context(case, template)}

Comentarios del equipo en la sala:
{build_comments_context(comments) or "Aún no hay comentarios del equipo."}

Debate hasta ahora:
{_history_text(history)}
"""
    raw = await _generate(prompt)
    return {"agente": agent_id, "ronda": ronda, **_parse_turn(raw)}


def _local_turn(agent_id: str, case: Case, comments: list[PortalComment]) -> dict[str, Any]:
    """Keep the debate demoable without GEMINI_API_KEY.

    Built from the case's real numbers, so the room shows a coherent
    exchange instead of an error — same call `generate_local_case_analysis`
    already makes.
    """
    state = case.estado_interactivo
    name = case.alumno.nombre
    said = len(comments)
    if agent_id == BURIX:
        return {
            "argumento": (
                f"Llevamos {state.dias_restantes} días y una hipótesis "
                f"{'sostenida' if state.hipotesis_sostenida else 'todavía sin fijar'}. "
                f"Antes de mover la intervención de {name}, separemos lo observado "
                f"de lo interpretado."
            ),
            "fortalezas": ["Evita etiquetar al alumno con evidencia fina"],
            "riesgos": ["Si esperamos demasiado, el apoyo llega tarde"],
        }
    return {
        "argumento": (
            f"Con {state.confianza_equipo}% de confianza del equipo y {said} "
            f"comentario(s) en la sala, ya hay base para un apoyo pequeño y "
            f"reversible para {name}. No hace falta certeza para empezar."
        ),
        "fortalezas": ["El alumno recibe apoyo mientras seguimos observando"],
        "riesgos": ["Actuar pronto puede encasillar al alumno si erramos"],
    }


async def run_debate_round(
    case: Case,
    template: Optional[JourneyTemplate],
    comments: list[PortalComment],
    history: list[dict[str, Any]],
    ronda: int,
) -> list[dict[str, Any]]:
    """One round is one turn each, in order.

    Tero runs with Búrix's turn already in its history, so the second turn
    answers the first — an exchange, not two monologues emitted in parallel.
    """
    turns: list[dict[str, Any]] = []
    running = list(history)
    for agent_id in (BURIX, TERO):
        turn = await _agent_turn(agent_id, case, template, comments, running, ronda)
        turns.append(turn)
        running.append(turn)
    return turns
