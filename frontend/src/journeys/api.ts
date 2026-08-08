/*
 * frontend/src/journeys/api.ts // client for /journeys — the pedagogical
 * template a case's five stations and their options come from.
 */

import { apiFetch, authHeaders } from '../lib/http'

export type QuestionType = 'unica' | 'multiple'

export interface StationOption {
  id: string
  texto: string
  icono?: string | null
}

export interface TemplateStation {
  id: string
  orden: number
  titulo: string
  subtitulo: string
  descripcion: string
  tipo: QuestionType
  obligatoria: boolean
  opciones: StationOption[]
}

export interface JourneyTemplate {
  id: string
  nombre: string
  version: number
  estaciones: TemplateStation[]
}

interface TemplateWire {
  _id?: string
  id?: string
  nombre: string
  version: number
  estaciones: TemplateStation[]
}

function normalizeTemplate(wire: TemplateWire): JourneyTemplate {
  const id = wire.id ?? wire._id
  if (!id) throw new Error('La plantilla llegó sin id.')
  return { id, nombre: wire.nombre, version: wire.version, estaciones: wire.estaciones }
}

export async function getActiveTemplate(token: string): Promise<JourneyTemplate> {
  const response = await apiFetch('/journeys/templates/active', { headers: authHeaders(token) })
  return normalizeTemplate((await response.json()) as TemplateWire)
}

export async function getTemplate(token: string, templateId: string): Promise<JourneyTemplate> {
  const response = await apiFetch(`/journeys/templates/${templateId}`, {
    headers: authHeaders(token),
  })
  return normalizeTemplate((await response.json()) as TemplateWire)
}
