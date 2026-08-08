/*
 * frontend/src/test/cases-api.test.ts // the /cases client against a mocked
 * fetch — pure request/response shape, no React. This is the layer that
 * broke silently last session (backend moved to a template-driven Case
 * shape; PUT /cases/{id} stopped accepting `estaciones`/`status`), so it
 * gets its own direct coverage rather than only being exercised indirectly
 * through components.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  answerStation,
  completeCase,
  createCase,
  generateSummary,
  getCase,
  joinCase,
  publishCase,
  setForixShare,
  updateStudent,
  updateSummary,
} from '../cases/api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * A typed `fetch` stub. Naming the signature here — rather than at each
 * `vi.fn(() => …)` call site — is what gives `.mock.calls[n]` its real
 * `[RequestInfo | URL, RequestInit?]` tuple type instead of `tsc` inferring
 * a zero-argument function from a handler that never reads its arguments.
 */
function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response) {
  const fn = vi.fn(handler)
  vi.stubGlobal('fetch', fn)
  return fn
}

const CASE_WIRE = {
  _id: 'case-1',
  profesor_id: 'u-1',
  join_code: 'ROOM42',
  forix_shared: true,
  colaboradores: [{ user_id: 'u-2', role: 'editor' }],
  colaboradores_ids: ['u-2'],
  template_id: 'tmpl-1',
  alumno: { nombre: 'Alex', edad: 9, curso: null, descripcion: '' },
  respuestas: [
    {
      estacion_id: 'explorar',
      opciones_seleccionadas: ['voz_alumno'],
      comentario: '',
      completado: true,
    },
  ],
  progreso: { completadas: 1, total: 5, porcentaje: 20 },
  resumen_final: { contenido: '', generado_por_ia: false, editado_manualmente: false },
  estado_interactivo: {
    estacion_actual: 'orientar',
    dias_totales: 7,
    dias_restantes: 6,
    confianza_equipo: 50,
    xp_total: 100,
    pistas_recogidas: ['voz_alumno'],
    imprevistos_resueltos: [],
    hipotesis_sostenida: null,
    estrategia_elegida: null,
    seguimiento_elegido: null,
  },
  status: 'en_progreso',
  created_at: '2026-08-08T00:00:00Z',
  updated_at: '2026-08-08T00:00:00Z',
}

describe('getCase', () => {
  it('normalizes the snake_case wire shape into the camelCase Case the app uses', async () => {
    mockFetch(() => jsonResponse(CASE_WIRE))
    const result = await getCase('tok', 'case-1')
    expect(result).toEqual({
      id: 'case-1',
      profesorId: 'u-1',
      joinCode: 'ROOM42',
      forixShared: true,
      colaboradores: [{ userId: 'u-2', role: 'editor' }],
      colaboradoresIds: ['u-2'],
      templateId: 'tmpl-1',
      alumno: { nombre: 'Alex', edad: 9, curso: null, descripcion: '' },
      respuestas: [
        {
          estacionId: 'explorar',
          opcionesSeleccionadas: ['voz_alumno'],
          comentario: '',
          completado: true,
        },
      ],
      progreso: { completadas: 1, total: 5, porcentaje: 20 },
      resumenFinal: { contenido: '', generadoPorIa: false, editadoManualmente: false },
      estadoInteractivo: {
        estacionActual: 'orientar',
        diasTotales: 7,
        diasRestantes: 6,
        confianzaEquipo: 50,
        xpTotal: 100,
        pistasRecogidas: ['voz_alumno'],
        imprevistosResueltos: [],
        hipotesisSostenida: null,
        estrategiaElegida: null,
        seguimientoElegido: null,
      },
      status: 'en_progreso',
      createdAt: '2026-08-08T00:00:00Z',
      updatedAt: '2026-08-08T00:00:00Z',
    })
  })

  it('also accepts an `id` field instead of `_id`', async () => {
    mockFetch(() => jsonResponse({ ...CASE_WIRE, _id: undefined, id: 'case-2' }))
    const result = await getCase('tok', 'case-2')
    expect(result.id).toBe('case-2')
  })
})

describe('joinCase', () => {
  it('normalizes and submits the six-character room code', async () => {
    const fetchMock = mockFetch(() => jsonResponse(CASE_WIRE))
    const joined = await joinCase('tok', 'room42')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/cases\/join$/)
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ code: 'ROOM42' })
    expect(joined.joinCode).toBe('ROOM42')
  })
})

describe('setForixShare', () => {
  it('updates whether the case appears in Forix', async () => {
    const fetchMock = mockFetch(() => jsonResponse(CASE_WIRE))
    await setForixShare('tok', 'case-1', true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/cases\/case-1\/forix-share$/)
    expect((init as RequestInit).method).toBe('PUT')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ shared: true })
  })
})

describe('createCase', () => {
  it('sends only alumno/template_id/privacy_acknowledged — CaseCreate has no estaciones field', async () => {
    const fetchMock = mockFetch(() => jsonResponse(CASE_WIRE))
    await createCase('tok', { alumno: { nombre: 'Alex', descripcion: '' } })
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({
      alumno: { nombre: 'Alex', descripcion: '' },
      template_id: null,
      privacy_acknowledged: true,
    })
  })
})

describe('updateStudent', () => {
  it('PUTs only { alumno } — CaseUpdate no longer accepts estaciones or status', async () => {
    const fetchMock = mockFetch(() => jsonResponse(CASE_WIRE))
    await updateStudent('tok', 'case-1', { nombre: 'Alex', descripcion: '' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/cases\/case-1$/)
    expect((init as RequestInit).method).toBe('PUT')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      alumno: { nombre: 'Alex', descripcion: '' },
    })
  })
})

describe('answerStation', () => {
  it('PUTs to the per-station endpoint with snake_case option ids', async () => {
    const fetchMock = mockFetch(() => jsonResponse(CASE_WIRE))
    await answerStation('tok', 'case-1', 2, {
      opcionesSeleccionadas: ['hipotesis_a'],
      comentario: 'Nota',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/cases\/case-1\/stations\/2\/response$/)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      opciones_seleccionadas: ['hipotesis_a'],
      comentario: 'Nota',
    })
  })
})

describe('the case lifecycle endpoints', () => {
  it('completeCase POSTs /complete', async () => {
    const fetchMock = mockFetch(() => jsonResponse(CASE_WIRE))
    await completeCase('tok', 'case-1')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/cases\/case-1\/complete$/)
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST')
  })

  it('publishCase POSTs /publish — a separate step from completing, matching the backend', async () => {
    const fetchMock = mockFetch(() => jsonResponse(CASE_WIRE))
    await publishCase('tok', 'case-1')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/cases\/case-1\/publish$/)
  })
})

describe('the AI summary endpoints', () => {
  it('generateSummary sends overwrite_manual', async () => {
    const fetchMock = mockFetch(() => jsonResponse(CASE_WIRE))
    await generateSummary('tok', 'case-1', true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/cases\/case-1\/summary\/generate$/)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ overwrite_manual: true })
  })

  it('updateSummary PUTs the edited content', async () => {
    const fetchMock = mockFetch(() => jsonResponse(CASE_WIRE))
    await updateSummary('tok', 'case-1', 'Texto final')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/cases\/case-1\/summary$/)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ contenido: 'Texto final' })
  })
})
