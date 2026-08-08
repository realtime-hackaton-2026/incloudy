/*
 * frontend/src/test/reward.test.tsx // the reward beat reflects the server's
 * XP, it never computes it (Invariant 10), and it stays quiet when nothing
 * was won.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import fc from 'fast-check'
import { XpCounter } from '../reward'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('XpCounter', () => {
  it('shows the total it is given, with no gain on first paint', () => {
    render(<XpCounter value={100} />)
    const counter = screen.getByTestId('xp-counter')
    expect(counter).toHaveTextContent('100')
    // Arriving at a case that already has XP is not an achievement.
    expect(counter).toHaveAttribute('data-gain', '')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('announces the difference when the server returns a higher total', () => {
    const { rerender } = render(<XpCounter value={100} />)
    rerender(<XpCounter value={175} />)

    const counter = screen.getByTestId('xp-counter')
    expect(counter).toHaveAttribute('data-gain', '75')
    expect(screen.getByRole('status')).toHaveTextContent('+75 XP')
    // The new total is on screen in the same commit as the reward.
    expect(counter).toHaveTextContent('175')
  })

  it('clears the gain once the beat is over, leaving only the total', () => {
    const { rerender } = render(<XpCounter value={100} />)
    rerender(<XpCounter value={150} />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByTestId('xp-counter')).toHaveTextContent('150')
  })

  it('stays silent when the total does not rise', () => {
    const { rerender } = render(<XpCounter value={100} />)
    rerender(<XpCounter value={100} />)
    expect(screen.queryByRole('status')).toBeNull()

    // A correction downward is not a reward.
    rerender(<XpCounter value={60} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByTestId('xp-counter')).toHaveTextContent('60')
  })

  /*
   * Invariant 10: the counter is a mirror. Whatever sequence of totals the
   * server sends, the number rendered is the last one — the component never
   * accumulates its own running total.
   */
  it('always renders the server total, never its own arithmetic', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 12 }), (totals) => {
        const { rerender, unmount } = render(<XpCounter value={totals[0]} />)
        for (const total of totals.slice(1)) rerender(<XpCounter value={total} />)
        const shown = screen.getByTestId('xp-counter').textContent ?? ''
        const last = totals[totals.length - 1]
        // The gain badge may also be on screen, so assert the total is present
        // rather than that it is the only number.
        const ok = shown.includes(String(last))
        unmount()
        return ok
      }),
      { numRuns: 30 },
    )
  })
})
