/**
 * Client for /cases — case CRUD plus the collaborator sub-resource.
 *
 * Wire shape note: Beanie serialises a Document's id as `_id` under
 * FastAPI's default `response_model_by_alias=True`, but nothing here has
 * been exercised against a live backend yet. `normalizeCase` accepts either
 * `_id` or `id` rather than assuming one and breaking silently if it's wrong.
 */

import { apiFetch, authHeaders, jsonHeaders } from '../lib/http'

export type CaseStatus = 'borrador' | 'publicado'

export interface Student {
  nombre: string
  edad?: number | null
  curso?: string | null
  descripcion: string
}

export interface StationRecord {
  orden: number
  titulo: string
  descripcion: string
  completado: boolean
}

export interface Case {
  id: string
  profesorId: string
  colaboradoresIds: string[]
  alumno: Student
  estaciones: StationRecord[]
  status: CaseStatus
  createdAt: string
  updatedAt: string
}

export interface CaseDraft {
  alumno: Student
  estaciones: StationRecord[]
}

export interface CollaboratorRecord {
  user_id: string
  email: string
}

interface CaseWire {
  _id?: string
  id?: string
  profesor_id: string
  colaboradores_ids: string[]
  alumno: Student
  estaciones: StationRecord[]
  status: CaseStatus
  created_at: string
  updated_at: string
}

function normalizeCase(wire: CaseWire): Case {
  const id = wire.id ?? wire._id
  if (!id) throw new Error('El caso llegó sin id.')
  return {
    id,
    profesorId: wire.profesor_id,
    colaboradoresIds: wire.colaboradores_ids,
    alumno: wire.alumno,
    estaciones: wire.estaciones,
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
    body: JSON.stringify(draft),
  })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function getCase(token: string, caseId: string): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}`, { headers: authHeaders(token) })
  return normalizeCase((await response.json()) as CaseWire)
}

export async function updateCase(
  token: string,
  caseId: string,
  patch: Partial<CaseDraft> & { status?: CaseStatus },
): Promise<Case> {
  const response = await apiFetch(`/cases/${caseId}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify(patch),
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
): Promise<CollaboratorRecord> {
  const response = await apiFetch(`/cases/${caseId}/collaborators`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ email }),
  })
  return (await response.json()) as CollaboratorRecord
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
