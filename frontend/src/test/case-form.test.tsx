/*
 * frontend/src/test/case-form.test.tsx // the complete → publish gate is the
 * one behavior this session fully redesigned (the old button flipped
 * `status` directly through a PUT the backend no longer honors), so it gets
 * a real behavioral test against a routed fetch mock instead of trusting the
 * rewrite by inspection alone.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CaseForm } from '../components/case-form'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const TEMPLATE_WIRE = {
  _id: 'tmpl-1',
  nombre: 'BRÚJULA',
  version: 1,
  estaciones: [
    {
      id: 'explorar',
      orden: 1,
      titulo: 'Explorar',
      subtitulo: '',
      descripcion: '',
      tipo: 'multiple',
      obligatoria: true,
      contenido: { introduccion: 'Alex tiene 9 años. Texto fijo de la plantilla.' },
      opciones: [{
        id: 'voz_alumno',
        texto: 'Escuchar al alumno',
        contenido: { evidencia: 'Alex explica lo que necesita.' },
      }],
    },
    {
      id: 'orientar',
      orden: 2,
      titulo: 'Orientar',
      subtitulo: 'Plantea una hipótesis',
      descripcion: '',
      tipo: 'unica',
      obligatoria: true,
      opciones: [{ id: 'reto', texto: 'Necesita más reto' }],
    },
  ],
}

function caseWire(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'case-1',
    profesor_id: 'u-1',
    colaboradores: [],
    colaboradores_ids: [],
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
    progreso: { completadas: 1, total: 1, porcentaje: 100 },
    resumen_final: { contenido: '', generado_por_ia: false, editado_manualmente: false },
    estado_interactivo: {
      estacion_actual: 'compartir',
      dias_totales: 7,
      dias_restantes: 3,
      confianza_equipo: 60,
      xp_total: 100,
      pistas_recogidas: [],
      hipotesis_sostenida: null,
      estrategia_elegida: null,
      seguimiento_elegido: null,
    },
    status: 'en_progreso',
    created_at: '2026-08-08T00:00:00Z',
    updated_at: '2026-08-08T00:00:00Z',
    ...overrides,
  }
}

/** Routes each fetch by method + path so a test only has to describe what differs. */
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

describe('CaseForm — the complete → publish state machine', () => {
  it('offers "Completar caso" once progress hits 100%, and moves the case to completado', async () => {
    let status = 'en_progreso'
    const fetchMock = routedFetch({
      'GET /cases/case-1': () => jsonResponse(caseWire({ status })),
      'GET /journeys/templates/tmpl-1': () => jsonResponse(TEMPLATE_WIRE),
      'POST /portal/sessions/case-1': () =>
        jsonResponse({ detail: 'Portal no configurado' }, 503),
      'POST /cases/case-1/complete': () => {
        status = 'completado'
        return jsonResponse(caseWire({ status }))
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(
      <CaseForm token="tok" caseId="case-1" ownerId="u-1" onBack={() => {}} onDeleted={() => {}} />,
    )

    const form = await screen.findByTestId('case-form')
    await waitFor(() => expect(form).toHaveAttribute('data-case-status', 'en_progreso'))

    // The map reads the real estado_interactivo field, not a client guess.
    expect(screen.getByTestId('case-map')).toHaveAttribute('data-active-station', 'compartir')

    const completeButton = await screen.findByRole('button', { name: /completar caso/i })
    await user.click(completeButton)

    await waitFor(() => expect(form).toHaveAttribute('data-case-status', 'completado'))
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/complete'))).toBe(
      true,
    )
  })

  it('only lets the owner publish once completado, through the confirm dialog', async () => {
    let status = 'completado'
    const fetchMock = routedFetch({
      'GET /cases/case-1': () => jsonResponse(caseWire({ status, progreso: { completadas: 1, total: 1, porcentaje: 100 } })),
      'GET /journeys/templates/tmpl-1': () => jsonResponse(TEMPLATE_WIRE),
      'POST /portal/sessions/case-1': () =>
        jsonResponse({ detail: 'Portal no configurado' }, 503),
      'POST /cases/case-1/publish': () => {
        status = 'publicado'
        return jsonResponse(caseWire({ status }))
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(
      <CaseForm token="tok" caseId="case-1" ownerId="u-1" onBack={() => {}} onDeleted={() => {}} />,
    )

    const form = await screen.findByTestId('case-form')
    await waitFor(() => expect(form).toHaveAttribute('data-case-status', 'completado'))

    // "Completar caso" must not reappear once the case is already completed.
    expect(screen.queryByRole('button', { name: /completar caso/i })).toBeNull()

    await user.click(screen.getByRole('button', { name: /publicar caso/i }))
    const dialog = await screen.findByTestId('confirm-dialog')
    await user.click(within(dialog).getByRole('button', { name: /^publicar$/i }))

    await waitFor(() => expect(form).toHaveAttribute('data-case-status', 'publicado'))
  })

  it('never shows a publish or complete button before the case is completado', async () => {
    const fetchMock = routedFetch({
      'GET /cases/case-1': () =>
        jsonResponse(
          caseWire({ status: 'en_progreso', progreso: { completadas: 0, total: 1, porcentaje: 0 } }),
        ),
      'GET /journeys/templates/tmpl-1': () => jsonResponse(TEMPLATE_WIRE),
      'POST /portal/sessions/case-1': () =>
        jsonResponse({ detail: 'Portal no configurado' }, 503),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CaseForm token="tok" caseId="case-1" ownerId="u-1" onBack={() => {}} onDeleted={() => {}} />,
    )

    await screen.findByTestId('case-form')
    expect(screen.queryByRole('button', { name: /publicar caso/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /completar caso/i })).toBeNull()
  })
})

describe('CaseForm — stations open as popups on the map, not as a list below it', () => {
  it('uses the current case name and description instead of Alex template copy', async () => {
    const fetchMock = routedFetch({
      'GET /cases/case-1': () => jsonResponse(caseWire({
        alumno: {
          nombre: 'Lucía',
          edad: 11,
          curso: '6.º de primaria',
          descripcion: 'Necesita apoyo para participar en trabajos grupales.',
        },
      })),
      'GET /journeys/templates/tmpl-1': () => jsonResponse(TEMPLATE_WIRE),
      'POST /portal/sessions/case-1': () => jsonResponse({ detail: 'Portal no configurado' }, 503),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(
      <CaseForm token="tok" caseId="case-1" ownerId="u-1" onBack={() => {}} onDeleted={() => {}} />,
    )
    await screen.findByTestId('case-form')
    await user.click(screen.getByRole('button', { name: /explorar en la selva/i }))

    const panel = await screen.findByTestId('station-explorar')
    expect(within(panel).getByText(/Lucía · 11 años · 6.º de primaria/)).toBeInTheDocument()
    expect(within(panel).getByText(/Necesita apoyo para participar/)).toBeInTheDocument()
    expect(within(panel).getByText(/Lucía explica lo que necesita/)).toBeInTheDocument()
    expect(within(panel).queryByText(/Alex/)).toBeNull()
  })

  it('opens a station\'s real form on the map when its hotspot is clicked, pre-filled from the saved answer', async () => {
    const fetchMock = routedFetch({
      'GET /cases/case-1': () => jsonResponse(caseWire()),
      'GET /journeys/templates/tmpl-1': () => jsonResponse(TEMPLATE_WIRE),
      'POST /portal/sessions/case-1': () =>
        jsonResponse({ detail: 'Portal no configurado' }, 503),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(
      <CaseForm token="tok" caseId="case-1" ownerId="u-1" onBack={() => {}} onDeleted={() => {}} />,
    )

    await screen.findByTestId('case-form')
    // Nothing from the old below-the-map list survives the redesign.
    expect(screen.queryByTestId('journey-stations')).toBeNull()

    await user.click(screen.getByRole('button', { name: /explorar en la selva/i }))

    const panel = await screen.findByTestId('station-explorar')
    expect(within(panel).getByText(/completada/i)).toBeInTheDocument()
    expect(within(panel).getByLabelText(/escuchar al alumno/i)).toBeChecked()
  })

  it('saves a station answer through the map popup and reflects the server response', async () => {
    let respuestas = caseWire().respuestas as Array<Record<string, unknown>>
    const fetchMock = routedFetch({
      'GET /cases/case-1': () => jsonResponse(caseWire({ respuestas })),
      'GET /journeys/templates/tmpl-1': () => jsonResponse(TEMPLATE_WIRE),
      'POST /portal/sessions/case-1': () =>
        jsonResponse({ detail: 'Portal no configurado' }, 503),
      'PUT /cases/case-1/stations/2/response': () => {
        respuestas = [
          ...respuestas,
          {
            estacion_id: 'orientar',
            opciones_seleccionadas: ['reto'],
            comentario: '',
            completado: true,
          },
        ]
        return jsonResponse(
          caseWire({ respuestas, progreso: { completadas: 2, total: 2, porcentaje: 100 } }),
        )
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(
      <CaseForm token="tok" caseId="case-1" ownerId="u-1" onBack={() => {}} onDeleted={() => {}} />,
    )

    await screen.findByTestId('case-form')
    await user.click(screen.getByRole('button', { name: /orientar en la montaña/i }))

    const panel = await screen.findByTestId('station-orientar')
    await user.click(within(panel).getByLabelText(/necesita más reto/i))
    await user.click(within(panel).getByRole('button', { name: /^continuar$/i }))

    await waitFor(() => expect(within(panel).getByText(/completada/i)).toBeInTheDocument())
    const [, init] = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/stations/2/response'),
    )!
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      opciones_seleccionadas: ['reto'],
      comentario: '',
    })
  })

  /*
   * §8 — a station opens as a question, not as a form. The comment box and
   * the way forward are consequences of choosing, so they must not be on
   * screen before a choice exists.
   */
  it('asks one thing at a time: the comment and the way forward wait for a choice', async () => {
    const fetchMock = routedFetch({
      'GET /cases/case-1': () => jsonResponse(caseWire()),
      'GET /journeys/templates/tmpl-1': () => jsonResponse(TEMPLATE_WIRE),
      'POST /portal/sessions/case-1': () => jsonResponse({ detail: 'Portal no configurado' }, 503),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(
      <CaseForm token="tok" caseId="case-1" ownerId="u-1" onBack={() => {}} onDeleted={() => {}} />,
    )

    await screen.findByTestId('case-form')
    await user.click(screen.getByRole('button', { name: /orientar en la montaña/i }))

    const panel = await screen.findByTestId('station-orientar')
    expect(panel).toHaveAttribute('data-step', 'choosing')
    // The question and its options are there; nothing downstream of the
    // decision is.
    expect(within(panel).getByLabelText(/necesita más reto/i)).toBeInTheDocument()
    expect(within(panel).queryByLabelText(/comentario/i)).toBeNull()
    expect(within(panel).queryByRole('button', { name: /^continuar$/i })).toBeNull()

    await user.click(within(panel).getByLabelText(/necesita más reto/i))

    expect(panel).toHaveAttribute('data-step', 'answering')
    expect(within(panel).getByLabelText(/comentario/i)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: /^continuar$/i })).toBeInTheDocument()
  })

  it('shows a locked-station rejection from the server as a themed warning, verbatim', async () => {
    const fetchMock = routedFetch({
      'GET /cases/case-1': () => jsonResponse(caseWire()),
      'GET /journeys/templates/tmpl-1': () => jsonResponse(TEMPLATE_WIRE),
      'POST /portal/sessions/case-1': () =>
        jsonResponse({ detail: 'Portal no configurado' }, 503),
      'PUT /cases/case-1/stations/2/response': () =>
        jsonResponse({ detail: 'Completa primero la estación Explorar' }, 409),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(
      <CaseForm token="tok" caseId="case-1" ownerId="u-1" onBack={() => {}} onDeleted={() => {}} />,
    )

    await screen.findByTestId('case-form')
    await user.click(screen.getByRole('button', { name: /orientar en la montaña/i }))
    const panel = await screen.findByTestId('station-orientar')
    await user.click(within(panel).getByLabelText(/necesita más reto/i))
    await user.click(within(panel).getByRole('button', { name: /^continuar$/i }))

    const warning = await within(panel).findByRole('alert')
    expect(warning).toHaveTextContent('Completa primero la estación Explorar')
  })
})
