/*
 * frontend/src/test/debate-realtime.test.tsx // the Búrix vs Tero debate as a
 * real-time feature: a second subscriber sees turns arrive, the runner never
 * sees them twice, a failed publish still leaves the turn on screen, and a
 * degraded socket is visible rather than silent.
 *
 * Portal itself is not reachable from the test environment (no publishable
 * key), so the channel is driven through a fake that follows the SDK's
 * documented contract: platform-assigned `id` as the dedup key, own messages
 * echoed back optimistically, and `status` moving through ChannelStatus.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionStatus, connectionNotice } from '../portal'
import type { PortalConnectionStatus } from '../portal'
import { DEBATE_TURN_EVENT, useDebate } from '../debate'
import type { DebateTurn } from '../debate'

const BURIX_T1: DebateTurn = {
  agente: 'burix',
  ronda: 1,
  argumento: 'Separemos lo observado de lo interpretado.',
  fortalezas: ['Evidencia fina'],
  riesgos: ['El apoyo tarda'],
}

const TERO_T1: DebateTurn = {
  agente: 'tero',
  ronda: 1,
  argumento: 'Un apoyo reversible ya es sostenible.',
  fortalezas: ['Apoyo inmediato'],
  riesgos: ['Puede encasillar'],
}

function roundWire(turnos: DebateTurn[]) {
  return {
    turnos,
    agentes: [
      { id: 'burix', nombre: 'Búrix', postura: 'La evidencia primero' },
      { id: 'tero', nombre: 'Tero', postura: 'El apoyo no puede esperar' },
    ],
    rondas_maximas: 3,
    comentarios_analizados: 2,
  }
}

function stubRound(turnos: DebateTurn[]) {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(roundWire(turnos)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

/* ── 1. Turn → channel → subscribers ─────────────────────────────────── */

describe('a debate turn reaches the channel', () => {
  it('publishes every turn of the round, tagged as a debate turn', async () => {
    stubRound([BURIX_T1, TERO_T1])
    const published: DebateTurn[] = []
    const publish = vi.fn((turn: DebateTurn) => {
      published.push(turn)
      return Promise.resolve({ id: `m${published.length}` })
    })

    const { result } = renderHook(() =>
      useDebate({ token: 'tok', caseId: 'case-1', publish }),
    )
    await act(async () => {
      await result.current.runRound()
    })

    // Both sides speak, and both go out to the room.
    expect(publish).toHaveBeenCalledTimes(2)
    expect(published.map((t) => t.agente)).toEqual(['burix', 'tero'])
    expect(DEBATE_TURN_EVENT).toBe('debate.turn')
  })

  it('keeps the runner\'s own turns in round then agent order', async () => {
    stubRound([BURIX_T1, TERO_T1])
    const { result } = renderHook(() => useDebate({ token: 'tok', caseId: 'case-1' }))
    await act(async () => {
      await result.current.runRound()
    })
    expect(result.current.turns.map((t) => `${t.ronda}:${t.agente}`)).toEqual([
      '1:burix',
      '1:tero',
    ])
  })
})

/* ── 3a. Sender echo dedup ───────────────────────────────────────────── */

describe('the sender never sees its own turn twice', () => {
  it('drops a turn echoed back off the channel', async () => {
    stubRound([BURIX_T1, TERO_T1])
    const { result } = renderHook(() => useDebate({ token: 'tok', caseId: 'case-1' }))

    await act(async () => {
      await result.current.runRound()
    })
    expect(result.current.turns).toHaveLength(2)

    // Portal echoes own messages back; same round + agent, so it must not stack.
    act(() => {
      result.current.receiveTurn({ ...BURIX_T1 })
      result.current.receiveTurn({ ...TERO_T1 })
    })
    expect(result.current.turns).toHaveLength(2)
  })

  it('still accepts a genuinely new turn from another teacher', async () => {
    stubRound([BURIX_T1, TERO_T1])
    const { result } = renderHook(() => useDebate({ token: 'tok', caseId: 'case-1' }))
    await act(async () => {
      await result.current.runRound()
    })

    act(() => {
      result.current.receiveTurn({ ...BURIX_T1, ronda: 2, argumento: 'Ronda dos.' })
    })
    expect(result.current.turns).toHaveLength(3)
  })
})

/* ── 3b. Failed publish ──────────────────────────────────────────────── */

describe('a failed publish does not lose the turn', () => {
  it('keeps the local turn and stays out of the error state', async () => {
    stubRound([BURIX_T1, TERO_T1])
    const publish = vi.fn(() => Promise.reject(new Error('socket down')))

    const { result } = renderHook(() =>
      useDebate({ token: 'tok', caseId: 'case-1', publish }),
    )
    await act(async () => {
      await result.current.runRound()
    })

    // The round succeeded even though the room never heard it.
    expect(publish).toHaveBeenCalledTimes(2)
    expect(result.current.turns).toHaveLength(2)
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  it('reports a failed *round* as an error, unlike a failed publish', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: 'El debate no está disponible' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )
    const { result } = renderHook(() => useDebate({ token: 'tok', caseId: 'case-1' }))
    await act(async () => {
      await result.current.runRound()
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeTruthy()
    expect(result.current.turns).toHaveLength(0)
  })
})

/* ── 4. Connection states ────────────────────────────────────────────── */

describe('Portal connection states are visible, not silent', () => {
  const DEGRADED: PortalConnectionStatus[] = [
    'reconnecting',
    'degraded',
    'degraded-http',
    'blocked',
  ]
  const HEALTHY: PortalConnectionStatus[] = ['idle', 'connecting', 'ready']

  it.each(DEGRADED)('announces "%s"', (status) => {
    render(<ConnectionStatus status={status} />)
    const banner = screen.getByTestId('portal-connection')
    expect(banner).toHaveAttribute('data-connection', status)
    expect(banner.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })

  it.each(HEALTHY)('stays quiet on "%s"', (status) => {
    render(<ConnectionStatus status={status} />)
    expect(screen.queryByTestId('portal-connection')).toBeNull()
  })

  it('asserts only for the terminal state, and stays polite otherwise', () => {
    const { rerender } = render(<ConnectionStatus status="reconnecting" />)
    expect(screen.getByTestId('portal-connection')).toHaveAttribute('role', 'status')
    expect(screen.getByTestId('portal-connection')).toHaveAttribute('aria-live', 'polite')

    rerender(<ConnectionStatus status="blocked" />)
    expect(screen.getByTestId('portal-connection')).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('portal-connection')).toHaveAttribute('aria-live', 'assertive')
  })

  it('tells degraded-http apart: you can still speak', () => {
    // The distinction that matters — HTTP publish works, inbound lags — must
    // survive copy edits, or the banner would wrongly imply a mute room.
    const notice = connectionNotice('degraded-http')
    expect(notice?.urgent).toBe(false)
    expect(notice?.text).toMatch(/escribiendo|escribir/i)
  })

  it('never blocks the room: the banner is a paragraph, not a dialog', () => {
    render(<ConnectionStatus status="blocked" />)
    const banner = screen.getByTestId('portal-connection')
    expect(banner.tagName).toBe('P')
    expect(banner).not.toHaveAttribute('aria-modal')
    expect(banner.closest('[role="dialog"]')).toBeNull()
  })

  it('says nothing for an unknown future status rather than inventing copy', () => {
    render(<ConnectionStatus status="some-future-state" />)
    expect(screen.queryByTestId('portal-connection')).toBeNull()
  })
})

/* ── 2. Two subscribers, one channel ─────────────────────────────────── */

/**
 * A minimal stand-in for `useChannel` that follows the SDK contract: every
 * publish gets a platform id, and every subscriber on the same channel
 * receives it — including the sender. Two hooks sharing one bus is the
 * closest this environment can get to two browser sessions.
 */
function makeChannelBus() {
  const subscribers = new Set<(message: { id: string; turn: DebateTurn }) => void>()
  let seq = 0
  return {
    subscribe(fn: (message: { id: string; turn: DebateTurn }) => void) {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
    publish(turn: DebateTurn) {
      seq += 1
      const message = { id: `srv-${seq}`, turn }
      // Delivered to everyone, sender included — that is the echo the app
      // has to dedupe.
      for (const fn of subscribers) fn(message)
      return Promise.resolve({ id: message.id })
    },
  }
}

describe('two subscribers on one case channel', () => {
  it('a spectator sees both turns arrive, in order, without running the round', async () => {
    stubRound([BURIX_T1, TERO_T1])
    const bus = makeChannelBus()

    const runner = renderHook(() =>
      useDebate({ token: 'tok', caseId: 'case-1', publish: bus.publish }),
    )
    const spectator = renderHook(() => useDebate({ token: 'tok', caseId: 'case-1' }))

    // The spectator is only ever fed by the channel.
    const unsubscribe = bus.subscribe(({ turn }) => {
      act(() => spectator.result.current.receiveTurn(turn))
    })

    await act(async () => {
      await runner.result.current.runRound()
    })

    await waitFor(() => expect(spectator.result.current.turns).toHaveLength(2))
    expect(spectator.result.current.turns.map((t) => t.agente)).toEqual(['burix', 'tero'])
    // Búrix and Tero alternate, and the spectator's copy matches the runner's.
    expect(spectator.result.current.turns.map((t) => `${t.ronda}:${t.agente}`)).toEqual(
      runner.result.current.turns.map((t) => `${t.ronda}:${t.agente}`),
    )
    unsubscribe()
  })

  it('the runner is not doubled by its own echo coming back off the bus', async () => {
    stubRound([BURIX_T1, TERO_T1])
    const bus = makeChannelBus()

    const runner = renderHook(() =>
      useDebate({ token: 'tok', caseId: 'case-1', publish: bus.publish }),
    )
    // The runner also subscribes — exactly what a real client does.
    const unsubscribe = bus.subscribe(({ turn }) => {
      act(() => runner.result.current.receiveTurn(turn))
    })

    await act(async () => {
      await runner.result.current.runRound()
    })

    await waitFor(() => expect(runner.result.current.turns).toHaveLength(2))
    unsubscribe()
  })
})

/* ── 6. The accessibility work already in place must survive ──────────── */

describe('existing accessibility is preserved', () => {
  it('keeps the vote buttons reporting their own pressed state', async () => {
    stubRound([BURIX_T1, TERO_T1])
    const { DebateRoom } = await import('../debate')
    const user = userEvent.setup()

    render(<DebateRoom token="tok" caseId="case-1" />)

    await user.click(await screen.findByRole('button', { name: /abrir el debate/i }))
    const vote = await screen.findByTestId('debate-vote')
    const buttons = vote.querySelectorAll('button[aria-pressed]')
    expect(buttons.length).toBe(2)
    expect([...buttons].every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true)
  })
})
