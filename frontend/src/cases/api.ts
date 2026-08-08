/*
 * frontend/src/cases/api.ts // client for /cases — a case now tracks a
 * template-driven journey (progreso, estado_interactivo, resumen_final)
 * rather than a freeform station checklist; CaseUpdate only accepts alumno.
 */

import { apiFetch, authHeaders, jsonHeaders } from '../lib/http'

export type CaseStatus =
  | 'borrador'
  | 'en_progreso'
  | 'completado'
  | 'publicado'
  | 'cerrado'
  | 'archivado'

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  borrador: 'Borrador',
  en_progreso: 'En progreso',
  completado: 'Completado',
  publicado: 'Publicado',
  cerrado: 'Cerrado',
  archivado: 'Archivado',
}

export type CollaboratorRole = 'editor' | 'comentarista' | 'lector'

export interface Student {
  nombre: string
  edad?: number | null
  curso?: string | null
  descripcion: string
}

export interface CaseProgress {
  completadas: number
  total: number
  porcentaje: number
}

export interface FinalSummary {
  contenido: string
  generadoPorIa: boolean
  editadoManualmente: boolean
}

export interface InteractiveState {
  /** One of the five map stages, or `"completado"` once every station is answered. */
  estacionActual: string
  diasTotales: number
  diasRestantes: number
  confianzaEquipo: number
  xpTotal: number
  pistasRecogidas: string[]
  hipotesisSostenida: string | null
  estrategiaElegida: string | null
  seguimientoElegido: string | null
  /** Each entry is `"{eventId}:{opcionId}"` — see answerUnexpectedEvent. */
  imprevistosResueltos: string[]
}

export interface StationAnswer {
  estacionId: string
  opcionesSeleccionadas: string[]
  comentario: string
  completado: boolean
}

export interface Collaborator {
  userId: string
  role: CollaboratorRole
}

export interface Case {
  id: string
  profesorId: string
  joinCode: string
  forixShared: boolean
  colaboradores: Collaborator[]
  colaboradoresIds: string[]
  templateId: string | null
  alumno: Student
  respuestas: StationAnswer[]
  progreso: CaseProgress
  resumenFinal: FinalSummary
  estadoInteractivo: InteractiveState
  status: CaseStatus
  createdAt: string
  updatedAt: string
}

export interface CaseDraft {
  alumno: Student
  templateId?: string
}

export interface CollaboratorRecord {
  userId: string
  email: string
  role: CollaboratorRole
}

interface CaseWire {
  _id?: string
  id?: string
  profesor_id: string
  join_code?: string | null
  forix_shared?: boolean
  colaboradores: { user_id: string; role: CollaboratorRole }[]
  colaboradores_ids: string[]
  template_id: string | null
  alumno: Student
  respuestas: {
    estacion_id: string
    opciones_seleccionadas: string[]
    comentario: string
    completado: boolean
  }[]
  progreso: CaseProgress
  resumen_final: {
    contenido: string
    generado_por_ia: boolean
    editado_manualmente: boolean
  }
  estado_interactivo: {
    estacion_actual: string
    dias_totales: number
    dias_restantes: number
    confianza_equipo: number
    xp_total: number
    pistas_recogidas: string[]
    hipotesis_sostenida: string | null
    estrategia_elegida: string | null
    seguimiento_elegido: string | null
    imprevistos_resueltos: string[]
  }
  status: CaseStatus
  created_at: string
  updated_at: string
}

interface CollaboratorWire {
  user_id: string
  email: string
  role: CollaboratorRole
}

function normalizeCase(wire: CaseWire): Case {
  const id = wire.id ?? wire._id
  if (!id) throw new Error('El caso llegó sin id.')
  return {
    id,
    profesorId: wire.profesor_id,
    joinCode: wire.join_code ?? id.slice(-6).toUpperCase(),
    forixShared: wire.forix_shared ?? false,
    colaboradores: wire.colaboradores.map((item) => ({ userId: item.user_id, role: item.role })),
    colaboradoresIds: wire.colaboradores_ids,
    templateId: wire.template_id,
    alumno: wire.alumno,
    respuestas: wire.respuestas.map((item) => ({
      estacionId: item.estacion_id,
      opcionesSeleccionadas: item.opciones_seleccionadas,
      comentario: item.comentario,
      completado: item.completado,
    })),
    progreso: wire.progreso,
    resumenFinal: {
      contenido: wire.resumen_final.contenido,
      generadoPorIa: wire.resumen_final.generado_por_ia,
      editadoManualmente: wire.resumen_final.editado_manualmente,
    },
    estadoInteractivo: {
      estacionActual: wire.estado_interactivo.estacion_actual,
      diasTotales: wire.estado_interactivo.dias_totales,
      diasRestantes: wire.estado_interactivo.dias_restantes,
      confianzaEquipo: wire.estado_interactivo.confianza_equipo,
      xpTotal: wire.estado_interactivo.xp_total,
      pistasRecogidas: wire.estado_interactivo.pistas_recogidas,
      hipotesisSostenida: wire.estado_interactivo.hipotesis_sostenida,
      estrategiaElegida: wire.estado_interactivo.estrategia_elegida,
      seguimientoElegido: wire.estado_interactivo.seguimiento_elegido,
      imprevistosResueltos: wire.estado_interactivo.imprevistos_resueltos,
    },
    status: wire.status,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  }
}

export async function listCases(token: string): Promise<Case[]> {
  const response = await apiFetch('/cases', { headers: authHeaders(token) })
  const wire = (await response.json()) as CaseWire[]
  return wire.map(normalizeCase)
}

export async function createCase(token: string, draft: CaseDraft): Promise<Case> {
  const response = await apiFetch('/cases', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      alumno: draft.alumno,
      template_id: draft.templateId ?? null,
      privacy_acknowledged: true,
    }),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function getCase(token: string, caseId: string): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}`, { headers: authHeaders(token) })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function joinCase(token: string, code: string): Promise<Case> {
  const response = await apiFetch('/cases/join', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function setForixShare(
  token: string,
  caseId: string,
  shared: boolean,
): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}/forix-share`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ shared }),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

/** The only field `PUT /cases/{id}` accepts — everything else has its own endpoint. */
export async function updateStudent(
  token: string,
  caseId: string,
  alumno: Student,
): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ alumno }),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function answerStation(
  token: string,
  caseId: string,
  orden: number,
  input: { opcionesSeleccionadas: string[]; comentario?: string },
): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}/stations/${orden}/response`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      opciones_seleccionadas: input.opcionesSeleccionadas,
      comentario: input.comentario ?? '',
    }),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function answerUnexpectedEvent(
  token: string,
  caseId: string,
  eventId: string,
  opcionId: string,
): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}/unexpected-events/${eventId}/response`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ opcion_id: opcionId }),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function completeCase(token: string, caseId: string): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}/complete`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function publishCase(token: string, caseId: string): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function resetCase(token: string, caseId: string): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}/reset`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function generateSummary(
  token: string,
  caseId: string,
  overwriteManual = false,
): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}/summary/generate`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ overwrite_manual: overwriteManual }),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function updateSummary(
  token: string,
  caseId: string,
  contenido: string,
): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}/summary`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ contenido }),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function deleteCase(token: string, caseId: string): Promise<void> {
  await apiFetch(`/cases/${caseId}`, { method: 'DELETE', headers: authHeaders(token) })
}

export async function addCollaborator(
  token: string,
  caseId: string,
  email: string,
  role: CollaboratorRole = 'comentarista',
): Promise<CollaboratorRecord> {
  const response = await apiFetch(`/cases/${caseId}/collaborators`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ email, role }),
  })
  const wire = (await response.json()) as CollaboratorWire
  return { userId: wire.user_id, email: wire.email, role: wire.role }
}

export async function removeCollaborator(
  token: string,
  caseId: string,
  collaboratorId: string,
): Promise<void> {
  await apiFetch(`/cases/${caseId}/collaborators/${collaboratorId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}
