/*
 * frontend/src/test/burix-panel.test.tsx // Búrix answers student questions
 * privately from the room: no session, no publish grant, no channel writes.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BurixPanel } from '../portal/BurixPanel'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

describe('BurixPanel — private ask, works with the room closed', () => {
  it('answers "datos de Pablo" privately and renders markdown, not raw', async () => {
    const fetchMock = routedFetch({
      'POST /cases/case-1/analysis': () =>
        jsonResponse({
          analisis: '### Diagnóstico hipotético\n\nMajo presenta **altas habilidades**.',
          comentarios_analizados: 0,
        }),
      'POST /chat': () =>
        jsonResponse({
          respuesta:
            '**Pablo tiene 9 años y cursa 3.º**\n\n- Curso: sin especificar\n- Descripción: altas capacidades.',
        }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const onShare = vi.fn()

    const user = userEvent.setup()
    render(
      <BurixPanel
        token="tok"
        caseId="case-1"
        open
        onClose={() => {}}
        onShare={onShare}
      />,
    )

    await screen.findByTestId('burix-analysis')
    expect(screen.getByTestId('burix-analysis').textContent).toContain('Majo presenta')
    expect(screen.getByText('Diagnóstico hipotético')).toBeTruthy()
    expect(screen.getByText('altas habilidades')).toBeTruthy()
    expect(screen.queryByText(/\*\*/)).toBeNull()

    const input = screen.getByRole('textbox', { name: 'Pregunta privada a Búrix' })
    await user.type(input, 'Me gustaría saber datos de Pablo')
    await user.click(screen.getByRole('button', { name: 'Preguntar' }))

    await screen.findByText(/Pablo tiene 9 años y cursa 3\.º/)
    expect(screen.getByText('Curso: sin especificar')).toBeTruthy()
    expect(screen.queryByText(/\*\*/)).toBeNull()
    expect(screen.getByText('Me gustaría saber datos de Pablo')).toBeTruthy()
    expect(screen.getByTestId('burix-exchanges').children.length).toBe(1)
    expect(onShare).not.toHaveBeenCalled()
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).endsWith('/chat') && init?.method === 'POST',
      ),
    ).toBe(true)
  })

  it('keeps the last exchange and shows the failure instead of a silent dead end', async () => {
    let fail = true
    const fetchMock = routedFetch({
      'POST /cases/case-1/analysis': () =>
        jsonResponse({ analisis: 'Diagnóstico.', comentarios_analizados: 0 }),
      'POST /chat': () =>
        fail
          ? jsonResponse({ detail: 'La IA no está disponible' }, 503)
          : jsonResponse({ respuesta: 'Segunda respuesta.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(
      <BurixPanel
        token="tok"
        caseId="case-1"
        open
        onClose={() => {}}
        onShare={() => {}}
      />,
    )

    await screen.findByTestId('burix-analysis')
    const input = screen.getByRole('textbox', { name: 'Pregunta privada a Búrix' })
    await user.type(input, '¿Qué necesita Alex?')
    await user.click(screen.getByRole('button', { name: 'Preguntar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La IA no está disponible',
    )
    expect(screen.queryByTestId('burix-exchanges')).toBeNull()

    fail = false
    await user.type(input, '¿Y ahora?')
    await user.click(screen.getByRole('button', { name: 'Preguntar' }))

    await waitFor(() =>
      expect(screen.getByTestId('burix-exchanges').children.length).toBe(1),
    )
    expect(screen.getByText('Segunda respuesta.')).toBeTruthy()
  })
})
