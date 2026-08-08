/*
 * frontend/src/test/case-chat.test.tsx // the Gemini assistant is stateless
 * server-side — each ask() sends only the latest question, never a
 * transcript — and must never be mistaken for the Portal team room. Both
 * get their own coverage here.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CaseChat } from '../chat'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response) {
  const fn = vi.fn(handler)
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('CaseChat', () => {
  it('is clearly labelled as private, distinct from the team room', () => {
    mockFetch(() => jsonResponse({ respuesta: 'ok' }))
    render(<CaseChat token="tok" caseId="case-1" />)
    expect(screen.getByText(/asistente de ia/i)).toBeInTheDocument()
    expect(screen.getByText(/privado/i)).toBeInTheDocument()
    expect(screen.getByText(/solo tú ves esta conversación/i)).toBeInTheDocument()
  })

  it('sends only the latest question — the backend has no memory between turns', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ respuesta: 'Sí, revisa el contexto familiar.' }))
    const user = userEvent.setup()
    render(<CaseChat token="tok" caseId="case-1" />)

    await user.type(screen.getByPlaceholderText(/pregunta algo/i), '¿Necesita más reto?')
    await user.click(screen.getByRole('button', { name: /preguntar/i }))

    await screen.findByText('Sí, revisa el contexto familiar.')
    expect(screen.getByText('¿Necesita más reto?')).toBeInTheDocument()

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      mensaje: '¿Necesita más reto?',
      case_id: 'case-1',
    })

    // A second question — the request body must not carry the first turn.
    await user.type(screen.getByPlaceholderText(/pregunta algo/i), '¿Y ahora?')
    await user.click(screen.getByRole('button', { name: /preguntar/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [, secondInit] = fetchMock.mock.calls[1]
    expect(JSON.parse((secondInit as RequestInit).body as string)).toEqual({
      mensaje: '¿Y ahora?',
      case_id: 'case-1',
    })
  })

  it('surfaces a failure as an alert without losing the question already asked', async () => {
    mockFetch(() => jsonResponse({ detail: 'Gemini no está configurado en el servidor' }, 503))
    const user = userEvent.setup()
    render(<CaseChat token="tok" caseId="case-1" />)

    await user.type(screen.getByPlaceholderText(/pregunta algo/i), 'Hola')
    await user.click(screen.getByRole('button', { name: /preguntar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Gemini no está configurado en el servidor',
    )
    expect(screen.getByText('Hola')).toBeInTheDocument()
  })
})
