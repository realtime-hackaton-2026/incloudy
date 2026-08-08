/*
 * frontend/src/test/debate.test.tsx // the debate must stay a debate: both
 * sides speak, each turn carries its own cost, and a turn echoed back off
 * Portal never duplicates the one we already rendered.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, renderHook, act } from '@testing-library/react'
import { requestDebateRound } from '../debate'
import type { DebateTurn } from '../debate'
import { useDebate } from '../debate'

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

const ROUND_WIRE = {
  turnos: [
    {
      agente: 'burix',
      ronda: 1,
      argumento: 'Separemos lo observado de lo interpretado.',
      fortalezas: ['Evita etiquetar con evidencia fina'],
      riesgos: ['El apoyo puede llegar tarde'],
    },
    {
      agente: 'tero',
      ronda: 1,
      argumento: 'Un apoyo pequeño y reversible ya es sostenible.',
      fortalezas: ['El alumno recibe apoyo ya'],
      riesgos: ['Actuar pronto puede encasillar'],
    },
  ],
  agentes: [
    { id: 'burix', nombre: 'Búrix', postura: 'La evidencia primero' },
    { id: 'tero', nombre: 'Tero', postura: 'El apoyo no puede esperar' },
  ],
  rondas_maximas: 3,
  comentarios_analizados: 4,
}

describe('requestDebateRound', () => {
  it('posts the round number and the history so the reply answers the last turn', async () => {
    const fetchMock = mockFetch(() => jsonResponse(ROUND_WIRE))
    const history: DebateTurn[] = [
      { agente: 'burix', ronda: 1, argumento: 'Primera', fortalezas: [], riesgos: [] },
    ]
    const result = await requestDebateRound('tok', 'case-1', 2, history)

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/cases\/case-1\/debate$/)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      ronda: 2,
      historial: history,
    })
    expect(result.rondasMaximas).toBe(3)
    expect(result.comentariosAnalizados).toBe(4)
  })
})

describe('useDebate', () => {
  it('gives both sides a turn, and publishes each one to the room', async () => {
    mockFetch(() => jsonResponse(ROUND_WIRE))
    const publish = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => useDebate({ token: 'tok', caseId: 'case-1', publish }))

    await act(async () => {
      await result.current.runRound()
    })

    expect(result.current.turns.map((t) => t.agente)).toEqual(['burix', 'tero'])
    expect(publish).toHaveBeenCalledTimes(2)
    expect(result.current.round).toBe(1)
  })

  it('ignores a turn echoed back off the channel instead of showing it twice', async () => {
    mockFetch(() => jsonResponse(ROUND_WIRE))
    const { result } = renderHook(() => useDebate({ token: 'tok', caseId: 'case-1' }))

    await act(async () => {
      await result.current.runRound()
    })
    expect(result.current.turns).toHaveLength(2)

    // The same round/agent arriving over Portal must not be appended again.
    act(() => {
      result.current.receiveTurn(ROUND_WIRE.turnos[0] as DebateTurn)
    })
    expect(result.current.turns).toHaveLength(2)
  })

  it('a failed publish still leaves the turn on screen for whoever ran the round', async () => {
    mockFetch(() => jsonResponse(ROUND_WIRE))
    const publish = vi.fn(() => Promise.reject(new Error('canal caído')))
    const { result } = renderHook(() => useDebate({ token: 'tok', caseId: 'case-1', publish }))

    await act(async () => {
      await result.current.runRound()
    })

    expect(result.current.turns).toHaveLength(2)
    expect(result.current.status).toBe('idle')
  })

  it('surfaces a backend failure as an error state rather than an empty debate', async () => {
    mockFetch(() => jsonResponse({ detail: 'El caso no tiene una plantilla válida' }, 409))
    const { result } = renderHook(() => useDebate({ token: 'tok', caseId: 'case-1' }))

    await act(async () => {
      await result.current.runRound()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('El caso no tiene una plantilla válida')
  })
})

/* The room view, with Portal stubbed — the debate has to work without it. */

vi.mock('@portalsdk/react', () => ({
  PortalProvider: ({ children }: { children: React.ReactNode }) => children,
  useChannel: () => ({ send: vi.fn(() => Promise.resolve({ id: 'm', timestamp: 0 })) }),
}))

vi.mock('@portalsdk/core', () => ({ Portal: class {} }))

describe('DebateRoom', () => {
  it('shows both stances before anyone speaks, so the room can judge the debate', async () => {
    mockFetch(() => jsonResponse({ detail: 'Portal no configurado' }, 503))
    const { DebateRoom } = await import('../debate')
    render(<DebateRoom token="tok" caseId="case-1" />)

    expect(await screen.findByText('Búrix')).toBeInTheDocument()
    expect(screen.getByText('Tero')).toBeInTheDocument()
    expect(screen.getByText('La evidencia primero')).toBeInTheDocument()
    expect(screen.getByText('El apoyo no puede esperar')).toBeInTheDocument()
  })

  it('renders each turn with the cost of its own position, not just the argument', async () => {
    mockFetch((input) =>
      String(input).includes('/debate')
        ? jsonResponse(ROUND_WIRE)
        : jsonResponse({ detail: 'Portal no configurado' }, 503),
    )
    const { DebateRoom } = await import('../debate')
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    render(<DebateRoom token="tok" caseId="case-1" />)
    await user.click(await screen.findByRole('button', { name: /abrir el debate/i }))

    await waitFor(() => expect(screen.getByTestId('debate-turn-1-burix')).toBeInTheDocument())
    expect(screen.getByTestId('debate-turn-1-tero')).toBeInTheDocument()
    // Every turn states what it risks, so no position reads as the answer.
    expect(screen.getAllByText('Riesgo')).toHaveLength(2)
    expect(screen.getByText('El apoyo puede llegar tarde')).toBeInTheDocument()
  })
})
