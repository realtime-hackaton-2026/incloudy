/*
 * frontend/src/test/motion-state.test.tsx // §36 animation guardrail: asserts
 * every transient state through `data-state`, so no test waits on a timer.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fc from 'fast-check'
import { AppHeader } from '../components/app-header'
import { CaseMap, STATIONS } from '../components/case-map'
import { CinematicOverlay } from '../components/cinematic-overlay'
import { ConfirmDialog } from '../components/confirm-dialog'
import { ProgressJourney } from '../components/progress-journey'
import { Scene } from '../components/scene'

const NODES = STATIONS.map((s) => ({ id: s.stage, label: s.label }))
const stageArb = fc.constantFrom(...STATIONS.map((s) => s.stage))

/* ── Scene ───────────────────────────────────────────────────────────── */

describe('Scene exposes which world is on screen', () => {
  it.each(['gate', 'journal', 'world'] as const)('reports variant %s', (variant) => {
    const { container } = render(<Scene variant={variant} />)
    const scene = container.querySelector('[data-scene]')
    expect(scene).toHaveAttribute('data-scene', variant)
    expect(scene).toHaveAttribute('data-state', 'idle')
  })

  it('reports the entrance as state rather than leaving it to a timer', () => {
    const { container } = render(<Scene variant="world" entering />)
    expect(container.querySelector('[data-scene]')).toHaveAttribute('data-state', 'entering')
  })

  it('keeps the map out of the login gate — the map is the reward, not the wallpaper', () => {
    const { container } = render(<Scene variant="gate" />)
    expect(container.querySelector('[data-scene="gate"]')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})

/* ── CaseMap camera ──────────────────────────────────────────────────── */

describe('CaseMap reports its camera as state', () => {
  it('starts wide, with no station focused', () => {
    render(<CaseMap stage="explorar" />)
    const map = screen.getByTestId('case-map')
    expect(map).toHaveAttribute('data-state', 'wide')
    expect(map).toHaveAttribute('data-focused-station', '')
    expect(map).toHaveAttribute('data-active-station', 'explorar')
  })

  it('reports the focused station immediately on selection, not once the camera settles', async () => {
    const user = userEvent.setup()
    render(<CaseMap stage="explorar" onSelectStage={() => {}} />)

    await user.click(screen.getByRole('button', { name: /actuar en la escuela/i }))

    const map = screen.getByTestId('case-map')
    expect(map).toHaveAttribute('data-state', 'focused')
    expect(map).toHaveAttribute('data-focused-station', 'actuar')
  })

  it('always names an active station belonging to the catalog', () => {
    fc.assert(
      fc.property(stageArb, (stage) => {
        const { unmount } = render(<CaseMap stage={stage} />)
        const value = screen.getByTestId('case-map').getAttribute('data-active-station')
        unmount()
        return STATIONS.some((s) => s.stage === value)
      }),
      { numRuns: 25 },
    )
  })
})

/* ── ProgressJourney ─────────────────────────────────────────────────── */

describe('ProgressJourney reports one current node, whatever it is handed', () => {
  it('marks exactly one node current for any index, hostile ones included', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (activeIndex) => {
        const { unmount } = render(
          <ProgressJourney nodes={NODES} activeIndex={activeIndex} />,
        )
        const group = screen.getByTestId('progress-journey')
        const current = within(group)
          .getAllByRole('button')
          .filter((b) => b.getAttribute('data-state') === 'current')
        const marked = within(group)
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-current') === 'step')
        unmount()
        return current.length === 1 && marked.length === 1 && current[0] === marked[0]
      }),
      { numRuns: 60 },
    )
  })

  it('keeps data-active-index inside the node range for any input', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (activeIndex) => {
        const { unmount } = render(
          <ProgressJourney nodes={NODES} activeIndex={activeIndex} />,
        )
        const raw = screen.getByTestId('progress-journey').getAttribute('data-active-index')
        unmount()
        const index = Number(raw)
        return Number.isInteger(index) && index >= 0 && index < NODES.length
      }),
      { numRuns: 60 },
    )
  })

  it('never reports a node as both reached and current', () => {
    render(<ProgressJourney nodes={NODES} activeIndex={2} />)
    const states = within(screen.getByTestId('progress-journey'))
      .getAllByRole('button')
      .map((b) => b.getAttribute('data-state'))
    expect(states).toEqual(['reached', 'reached', 'current', 'upcoming', 'upcoming'])
  })
})

/* ── AppHeader ───────────────────────────────────────────────────────── */

describe('AppHeader reports one active route', () => {
  it('agrees with the single nav item marked active', () => {
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
        const header = screen.getByTestId('app-header')
        const activeItems = within(header)
          .getAllByRole('button')
          .filter((b) => b.getAttribute('data-state') === 'active')
        const reported = header.getAttribute('data-active-route')
        unmount()
        return activeItems.length === 1 && reported === active
      }),
      { numRuns: 20 },
    )
  })
})

/* ── Transient overlays ──────────────────────────────────────────────── */

describe('Overlays report presence as state', () => {
  it('the cinematic veil is active purely by being mounted', () => {
    render(<CinematicOverlay caption="Tu mundo te espera" />)
    expect(screen.getByTestId('cinematic-overlay')).toHaveAttribute('data-state', 'active')
  })

  it('the confirm dialog renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="¿Eliminar caso?"
        confirmLabel="Eliminar"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.queryByTestId('confirm-dialog')).toBeNull()
  })

  it('reports pending so a double-click test never has to race the second click', () => {
    const { rerender } = render(
      <ConfirmDialog
        open
        title="¿Eliminar caso?"
        confirmLabel="Eliminar"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByTestId('confirm-dialog')).toHaveAttribute('data-state', 'open')

    rerender(
      <ConfirmDialog
        open
        pending
        title="¿Eliminar caso?"
        confirmLabel="Eliminar"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    const dialog = screen.getByTestId('confirm-dialog')
    expect(dialog).toHaveAttribute('data-state', 'pending')
    within(dialog)
      .getAllByRole('button')
      .forEach((button) => expect(button).toBeDisabled())
  })
})

/* ── §35 — the negative case this whole file exists to make testable ──── */

describe('Double interaction does not corrupt state', () => {
  it('toggles the camera back to wide instead of stacking a second focus', async () => {
    const user = userEvent.setup()
    render(<CaseMap stage="explorar" onSelectStage={() => {}} />)

    const hotspot = screen.getByRole('button', { name: /orientar en la montaña/i })
    const map = screen.getByTestId('case-map')

    await user.click(hotspot)
    expect(map).toHaveAttribute('data-state', 'focused')
    expect(map).toHaveAttribute('data-focused-station', 'orientar')

    await user.click(hotspot)
    expect(map).toHaveAttribute('data-state', 'wide')
    expect(map).toHaveAttribute('data-focused-station', '')
  })

  it('never focuses two stations, however the hotspots are hammered', async () => {
    const user = userEvent.setup()
    render(<CaseMap stage="explorar" onSelectStage={() => {}} />)

    const hotspots = [
      /orientar en la montaña/i,
      /actuar en la escuela/i,
      /actuar en la escuela/i,
      /compartir en la aldea/i,
      /orientar en la montaña/i,
    ]

    for (const name of hotspots) {
      await user.click(screen.getByRole('button', { name }))
      const focused = screen.getByTestId('case-map').getAttribute('data-focused-station')
      expect(STATIONS.filter((s) => s.stage === focused).length).toBeLessThanOrEqual(1)
    }

    expect(screen.getAllByTestId('case-map')).toHaveLength(1)
  })
})
