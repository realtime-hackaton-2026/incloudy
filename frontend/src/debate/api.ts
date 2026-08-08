/*
 * frontend/src/debate/api.ts // client for POST /cases/{id}/debate: one round
 * of Búrix/Tero turns, drawn from the case and the room's comments.
 */

import { apiFetch, jsonHeaders } from '../lib/http'

export type AgentId = 'burix' | 'tero'

export interface DebateTurn {
  agente: AgentId
  ronda: number
  argumento: string
  fortalezas: string[]
  riesgos: string[]
}

export interface DebateAgent {
  id: AgentId
  nombre: string
  postura: string
}

export interface DebateRound {
  turnos: DebateTurn[]
  agentes: DebateAgent[]
  rondasMaximas: number
  comentariosAnalizados: number
}

interface DebateRoundWire {
  turnos: DebateTurn[]
  agentes: DebateAgent[]
  rondas_maximas: number
  comentarios_analizados: number
}

export async function requestDebateRound(
  token: string,
  caseId: string,
  ronda: number,
  // Readonly: callers pass a derived, shared view of the debate so far; this
  // only serialises it and must not be able to mutate the caller's array.
  historial: readonly DebateTurn[],
): Promise<DebateRound> {
  const response = await apiFetch(`/cases/${encodeURIComponent(caseId)}/debate`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ ronda, historial }),
  })
  const wire = (await response.json()) as DebateRoundWire
  return {
    turnos: wire.turnos,
    agentes: wire.agentes,
    rondasMaximas: wire.rondas_maximas,
    comentariosAnalizados: wire.comentarios_analizados,
  }
}
