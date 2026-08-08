/**
 * Property/fuzz tests (§29–32).
 *
 * The goal is not coverage — it is finding the input nobody thought of.
 * Every property here is a "must never" the UI has to survive: no crash,
 * no `[object Object]`, no HTML execution, no impossible progress.
 */

import { describe, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import fc from 'fast-check'
import { ProgressJourney } from '../components/progress-journey'
import { Login } from '../components/login'
import { STATIONS } from '../components/case-map'

/** The nastiest strings a teacher (or a fuzzer) can put in a field. */
const hostileText = fc.oneof(
  fc.constant(''),
  fc.constant(' '),
  fc.constant('   \n\t  '),
  fc.constant('<script>window.__pwned = 1</script>'),
  fc.constant('<img src=x onerror="window.__pwned=1">'),
  fc.constant('{{constructor.constructor("alert(1)")()}}'),
  fc.constant('Ana Lucía Ñandú — “comillas” & <b>'),
  fc.constant('🧭🌲✦ aventura 🔥'),
  fc.constant('José'.repeat(200)),
  fc.string(),
  // fast-check v4 dropped `unicodeString()` in favour of a unit option.
  fc.string({ unit: 'grapheme' }),
)

describe('§30 — hostile user input never destabilises the UI', () => {
  it('renders any label without crashing, leaking objects, or executing HTML', () => {
    fc.assert(
      fc.property(hostileText, fc.integer({ min: 0, max: 4 }), (label, activeIndex) => {
        const nodes = STATIONS.map((s) => ({ id: s.stage, label }))
        const { container, unmount } = render(
          <ProgressJourney nodes={nodes} activeIndex={activeIndex} />,
        )
        const text = container.textContent ?? ''
        const clean =
          !text.includes('[object Object]') &&
          !text.includes('undefined') &&
          // The string may be *shown*, but never parsed into live nodes.
          container.querySelector('script, img[onerror]') === null &&
          (window as unknown as { __pwned?: number }).__pwned === undefined
        unmount()
        return clean
      }),
      { numRuns: 60 },
    )
  })

  it('keeps the login form usable whatever is typed into it', () => {
    fc.assert(
      fc.property(hostileText, (value) => {
        const { unmount } = render(
          <Login onSubmit={() => {}} onSwitchToRegister={() => {}} error={value} />,
        )
        // The error slot takes arbitrary text and must stay an alert, not markup.
        const alert = screen.queryByRole('alert')
        const ok =
          screen.getByLabelText(/id de explorador/i) !== null &&
          (value.trim() === '' || alert !== null) &&
          (window as unknown as { __pwned?: number }).__pwned === undefined
        unmount()
        return ok
      }),
      { numRuns: 40 },
    )
  })
})

describe('§32 — progress never renders an impossible state', () => {
  it('survives any (activeIndex, nodeCount) pair', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 0, max: 12 }),
        (activeIndex, count) => {
          const nodes = Array.from({ length: count }, (_, i) => ({
            id: `n${i}`,
            label: `Etapa ${i}`,
          }))
          const { container, unmount } = render(
            <ProgressJourney nodes={nodes} activeIndex={activeIndex} />,
          )
          // The travelled bar must stay a sane, finite width.
          const fill = container.querySelector('span[class*="fill"]') as HTMLElement | null
          const width = fill?.style.width ?? '0%'
          const value = Number.parseFloat(width)
          const sane =
            !Number.isNaN(value) && Number.isFinite(value) && value >= 0 && value <= 100
          unmount()
          return sane
        },
      ),
      { numRuns: 80 },
    )
  })

  it('marks at most one current node for any index', () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), (activeIndex) => {
        const nodes = STATIONS.map((s) => ({ id: s.stage, label: s.label }))
        const { unmount } = render(
          <ProgressJourney nodes={nodes} activeIndex={activeIndex} />,
        )
        const marked = within(screen.getByRole('group'))
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-current') === 'step')
        unmount()
        return marked.length <= 1
      }),
      { numRuns: 50 },
    )
  })
})
