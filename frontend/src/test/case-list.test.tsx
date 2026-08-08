/*
 * frontend/src/test/case-list.test.tsx // deleting is the owner's call: a
 * shared case offers no ✕ button, and a refused deletion must surface the
 * backend's message instead of closing in silence.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CaseList } from '../components/case-list'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function caseWire(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'case-1',
    profesor_id: 'u-1',
    join_code: 'ABC123',
    forix_shared: false,
    colaboradores: [],
    colaboradores_ids: [],
    template_id: 'tmpl-1',
    alumno: { nombre: 'Alex', edad: 9, curso: null, descripcion: '' },
    respuestas: [],
    progreso: { completadas: 0, total: 0, porcentaje: 0 },
    resumen_final: { contenido: '', generado_por_ia: false, editado_manualmente: false },
    estado_interactivo: {
      estacion_actual: 'explorar',
      dias_totales: 7,
      dias_restantes: 7,
      confianza_equipo: 0,
      xp_total: 0,
      pistas_recogidas: [],
      hipotesis_sostenida: null,
      estrategia_elegida: null,
      seguimiento_elegido: null,
      imprevistos_resueltos: [],
    },
    status: 'en_progreso',
    created_at: '2026-08-08T00:00:00Z',
    updated_at: '2026-08-08T00:00:00Z',
    ...overrides,
  }
}

function routedFetch(routes: Record<string, () => Response>) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x')
    const key = `${init?.method ?? 'GET'} ${url.pathname}`
    const handler = routes[key]
    if (!handler) {
      throw new Error(`No route mocked for ${key}`)
    }
    return Promise.resolve(handler())
  })
}

describe('CaseList — deletion is owner-only, shared cases can be dropped', () => {
  it('offers ✕ delete only on owned cases; shared ones get "Quitar de mi lista"', async () => {
    const fetchMock = routedFetch({
      'GET /cases': () =>
        jsonResponse([
          caseWire({ _id: 'owned-1', alumno: { nombre: 'Alex', edad: 9, curso: null, descripcion: '' } }),
          caseWire({ _id: 'shared-1', profesor_id: 'u-2', alumno: { nombre: 'Nora', edad: 8, curso: null, descripcion: '' } }),
        ]),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<CaseList token="tok" ownerId="u-1" onOpen={() => {}} />)

    const list = await screen.findByTestId('case-list')
    await waitFor(() => expect(list).toHaveAttribute('data-state', 'populated'))

    expect(screen.getByText('Compartido contigo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Eliminar la aventura de Alex' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Eliminar la aventura de Nora' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Quitar de mi lista' })).toBeTruthy()
  })

  it('drops a shared case from the list through POST /cases/{id}/leave, without a DELETE', async () => {
    const fetchMock = routedFetch({
      'GET /cases': () =>
        jsonResponse([
          caseWire({ _id: 'shared-1', profesor_id: 'u-2', alumno: { nombre: 'Nora', edad: 8, curso: null, descripcion: '' } }),
        ]),
      'POST /cases/shared-1/leave': () => new Response(null, { status: 204 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<CaseList token="tok" ownerId="u-1" onOpen={() => {}} />)

    await screen.findByRole('button', { name: 'Quitar de mi lista' })
    await user.click(screen.getByRole('button', { name: 'Quitar de mi lista' }))

    const dialog = await screen.findByTestId('confirm-dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }))

    await waitFor(() => expect(screen.queryByText('Nora')).toBeNull())
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) => String(input).endsWith('/leave') && init?.method === 'POST',
      ),
    ).toBe(true)
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE'),
    ).toBe(false)
  })

  it('surfaces the backend message when the deletion is refused', async () => {
    const fetchMock = routedFetch({
      'GET /cases': () =>
        jsonResponse([caseWire({ _id: 'owned-1', alumno: { nombre: 'Alex', edad: 9, curso: null, descripcion: '' } })]),
      'DELETE /cases/owned-1': () => jsonResponse({ detail: 'Caso no encontrado' }, 404),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<CaseList token="tok" ownerId="u-1" onOpen={() => {}} />)

    await screen.findByRole('button', { name: 'Eliminar la aventura de Alex' })
    await user.click(screen.getByRole('button', { name: 'Eliminar la aventura de Alex' }))

    const dialog = await screen.findByTestId('confirm-dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert.textContent).toBe('Caso no encontrado')
    expect(screen.getByTestId('confirm-dialog')).toBeTruthy()
  })
})
