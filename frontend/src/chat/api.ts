/*
 * frontend/src/chat/api.ts // client for POST /chat — the Gemini assistant.
 * Stateless on the backend: each call rebuilds the case context from
 * scratch and returns one answer, with no server-side memory of earlier
 * turns. Conversation history is a client-side display concern only.
 */

import { apiFetch, jsonHeaders } from '../lib/http'

export async function askAssistant(
  token: string,
  mensaje: string,
  caseId?: string,
): Promise<string> {
  const response = await apiFetch('/chat', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ mensaje, case_id: caseId ?? null }),
  })
  const body = (await response.json()) as { respuesta: string }
  return body.respuesta
}

export interface CaseAnalysis {
  analisis: string
  comentarios_analizados: number
}

export async function requestCaseAnalysis(
  token: string,
  caseId: string,
): Promise<CaseAnalysis> {
  const response = await apiFetch(`/cases/${encodeURIComponent(caseId)}/analysis`, {
    method: 'POST',
    headers: jsonHeaders(token),
  })
  return (await response.json()) as CaseAnalysis
}
