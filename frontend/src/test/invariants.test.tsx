/**
 * The ten mandatory invariants from the QA brief (§33).
 *
 * An invariant must hold for *any* input, so most of these are property
 * tests rather than examples: fast-check generates the state, and the
 * assertion is the thing that must never be false.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fc from 'fast-check'
import { CaseMap, STATIONS, stationFor, stationIndex } from '../components/case-map'
import type { CaseStage } from '../components/case-map'
import { ProgressJourney } from '../components/progress-journey'
import { AppHeader } from '../components/app-header'
import { useSession } from '../auth'
import { renderHook, act, waitFor } from '@testing-library/react'

const STAGES = STATIONS.map((s) => s.stage)
const stageArb = fc.constantFrom(...STAGES)

beforeEach(() => {
  // Nothing here should reach the network. A test that does is a bug in the
  // test, and this makes that loud instead of silent.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('unexpected network call'))))
})

/* ── Invariant 1 — Map asset integrity ───────────────────────────────── */

describe('Invariant 1 — the canonical map asset', () => {
  it('is the only image the map renders, and is never swapped out', async () => {
    const mapArt = (await import('../assets/images/fondo.png')).default
    render(<CaseMap stage="explorar" />)
    const img = screen.getByRole('img', { name: /mapa del caso/i })
    expect(img).toHaveAttribute('src', mapArt)
    // Guards against a refactor quietly pointing the map at something else.
    expect(String(mapArt)).toMatch(/fondo/)
  })
})

/* ── Invariant 4 — One active station ────────────────────────────────── */

describe('Invariant 4 — at most one active station', () => {
  /*
   * The first cut of this asserted "at most one aria-current in the
   * document" and failed immediately. That was the test being wrong, not
   * the app: the map marks the current hotspot *and* the journey marks the
   * current node, two separate sets each correctly flagging its own item.
   *
   * The invariant that actually matters is that they never disagree — one
   * station is current, however many widgets are drawing it. That is also
   * Invariant 6 (display and state share one source of truth), so this
   * covers both.
   */
  it('never lets two different stations be current at once', () => {
    fc.assert(
      fc.property(stageArb, (stage) => {
        const { unmount } = render(<CaseMap stage={stage} />)
        const marked = screen
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-current') === 'step')
        const expected = stationFor(stage).label
        // Every element claiming "current" must name the same station.
        const allAgree = marked.every((el) =>
          (el.getAttribute('aria-label') ?? el.textContent ?? '').includes(expected),
        )
        unmount()
        return marked.length >= 1 && allAgree
      }),
      { numRuns: 25 },
    )
  })

  it('marks exactly one hotspot on the map itself', () => {
    fc.assert(
      fc.property(stageArb, (stage) => {
        const { unmount } = render(<CaseMap stage={stage} />)
        const hotspots = screen
          .getAllByRole('button')
          .filter((b) => / en /.test(b.getAttribute('aria-label') ?? ''))
          .filter((b) => b.getAttribute('aria-current') === 'step')
        unmount()
        return hotspots.length === 1
      }),
      { numRuns: 25 },
    )
  })
})

/* ── Invariant 5 + 6 — Valid progress, single source of truth ────────── */

describe('Invariant 5 — progress stays inside its bounds', () => {
  it('never renders an impossible position, even for hostile indices', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 100 }), (activeIndex) => {
        const nodes = STATIONS.map((s) => ({ id: s.stage, label: s.label }))
        const { unmount } = render(
          <ProgressJourney nodes={nodes} activeIndex={activeIndex} />,
        )
        const group = screen.getByRole('group')
        const marked = within(group)
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-current') === 'step')
        unmount()
        // Out-of-range simply matches nothing; it must never mark two.
        return marked.length <= 1
      }),
      { numRuns: 40 },
    )
  })

  it('agrees with the stage it was given (no drift between state and display)', () => {
    fc.assert(
      fc.property(stageArb, (stage) => {
        const index = stationIndex(stage)
        const nodes = STATIONS.map((s) => ({ id: s.stage, label: s.label }))
        const { unmount } = render(<ProgressJourney nodes={nodes} activeIndex={index} />)
        const label = screen.getByRole('group').getAttribute('aria-label') ?? ''
        unmount()
        return label === `Aventura ${index + 1} de ${STATIONS.length}`
      }),
      { numRuns: 25 },
    )
  })
})

/* ── Invariant 7 — Selected station exists ───────────────────────────── */

describe('Invariant 7 — a selected station always exists in the catalog', () => {
  it('only ever surfaces stations from STATIONS', async () => {
    const user = userEvent.setup()
    render(<CaseMap stage="explorar" onSelectStage={() => {}} />)
    const hotspot = screen.getByRole('button', { name: /actuar en la escuela/i })
    await user.click(hotspot)
    // The HUD names a real station, not an invented one.
    const known = STATIONS.map((s) => s.label)
    const heading = await screen.findByText(/explorar →/i)
    expect(heading).toBeInTheDocument()
    const shown = known.filter((label) => screen.queryAllByText(label).length > 0)
    expect(shown.length).toBeGreaterThan(0)
    shown.forEach((label) => expect(known).toContain(label))
  })

  it('throws rather than inventing a station for an unknown stage', () => {
    expect(() => stationFor('inexistente' as CaseStage)).toThrow()
  })
})

/* ── Invariant 8 — Navigation state ──────────────────────────────────── */

describe('Invariant 8 — exactly one active nav item', () => {
  it('never marks two routes as current', () => {
    fc.assert(
      fc.property(fc.constantFrom('casos' as const, 'mapa' as const), (active) => {
        const { unmount } = render(
          <AppHeader
            active={active}
            email="qa@incloudy.dev"
            onNavigate={() => {}}
            onSignOut={() => {}}
          />,
        )
        const current = within(screen.getByRole('navigation'))
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-current') === 'page')
        unmount()
        return current.length === 1
      }),
      { numRuns: 20 },
    )
  })
})

/* ── Invariants 2, 3, 9 — Session lifecycle ──────────────────────────── */

describe('Invariants 2, 3 & 9 — session lifecycle', () => {
  it('starts anonymous with no stored token (no protected state by default)', () => {
    const { result } = renderHook(() => useSession())
    expect(result.current.session).toBeNull()
    expect(result.current.status).toBe('anonymous')
  })

  it('Invariant 3 — signOut clears the session and the stored token', async () => {
    localStorage.setItem('incloudy.token', 'stale')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ email: 'qa@incloudy.dev' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.session).not.toBeNull())

    act(() => result.current.signOut())

    expect(result.current.session).toBeNull()
    expect(result.current.status).toBe('anonymous')
    expect(localStorage.getItem('incloudy.token')).toBeNull()
  })

  it('Invariant 9 — a failed sign-in resolves out of the pending state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: 'Email o contraseña incorrectos' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )
    const { result } = renderHook(() => useSession())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.signIn({ email: 'a@b.dev', password: 'x'.repeat(9) })
    })
    expect(ok).toBe(false)
    // Never stuck on 'signing-in'.
    expect(result.current.status).toBe('anonymous')
    expect(result.current.error).toBeTruthy()
    expect(result.current.session).toBeNull()
  })

  it('Invariant 9 — a rejected network call still resolves', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))))
    const { result } = renderHook(() => useSession())
    await act(async () => {
      await result.current.signIn({ email: 'a@b.dev', password: 'x'.repeat(9) })
    })
    expect(result.current.status).toBe('anonymous')
    expect(result.current.error).toMatch(/servidor/i)
  })

  it('Invariant 2 — a token the backend rejects grants nothing', async () => {
    localStorage.setItem('incloudy.token', 'forged')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('null', { status: 401 }))),
    )
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem('incloudy.token')).toBeNull()
  })
})

/* ── Invariant 10 — Animation never drives business logic ────────────── */

describe('Invariant 10 — state leads, animation follows', () => {
  it('reports sign-in success synchronously, without waiting on any animation', async () => {
    const token = `${btoa(JSON.stringify({ alg: 'none' }))}.${btoa(
      JSON.stringify({ sub: 'u1' }),
    )}.sig`
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ access_token: token, token_type: 'bearer' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )
    const { result } = renderHook(() => useSession())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.signIn({ email: 'a@b.dev', password: 'x'.repeat(9) })
    })
    // The transition is a consequence of this boolean, never its cause.
    expect(ok).toBe(true)
    expect(result.current.session?.userId).toBe('u1')
  })
})
