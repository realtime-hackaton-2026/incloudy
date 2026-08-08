/*
 * frontend/src/test/guide-says.test.tsx // the owl's five roles: the copy is
 * derived from state, names what unlocks a station, and never becomes a
 * second source of truth about progress.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fc from 'fast-check'
import {
  OwlSays,
  howTheMapWorks,
  journeyProgress,
  lockedStation,
  stationCleared,
  teammateArrived,
} from '../guide'

describe('what the owl says', () => {
  it('names the station that has to be finished first, not just "bloqueada"', () => {
    const guidance = lockedStation('Compartir', 'Acompañar')
    expect(guidance.tone).toBe('guide')
    expect(guidance.text).toContain('Compartir')
    expect(guidance.text).toContain('Acompañar')
    expect(guidance.transient).toBe(true)
  })

  it('falls back gracefully when there is no previous station to name', () => {
    const guidance = lockedStation('Explorar', null)
    expect(guidance.text).toContain('Explorar')
    expect(guidance.text).not.toMatch(/primero termina/i)
  })

  it('counts what is left in words, and switches to praise at zero', () => {
    expect(journeyProgress(3).text).toMatch(/faltan 3 estaciones/i)
    expect(journeyProgress(1).text).toMatch(/falta una estación/i)

    const done = journeyProgress(0)
    expect(done.tone).toBe('celebrate')
    expect(done.text).toMatch(/cinco estaciones/i)
    // The finished message stays put; it is a state, not an event.
    expect(done.transient).toBe(false)
  })

  it('mentions the XP only when some was actually won', () => {
    expect(stationCleared('Orientar', 100).text).toContain('+100 XP')
    expect(stationCleared('Orientar', 0).text).not.toContain('XP')
  })

  it('greets a teammate by name when it knows one', () => {
    expect(teammateArrived('Ana').text).toContain('Ana')
    expect(teammateArrived(null).text).toMatch(/otra persona del equipo/i)
  })

  it('never produces empty or placeholder copy, whatever it is handed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -50, max: 50 }),
        fc.string(),
        fc.string(),
        (remaining, blocked, previous) => {
          const messages = [
            journeyProgress(remaining),
            lockedStation(blocked, previous || null),
            stationCleared(blocked, remaining),
            teammateArrived(previous || null),
            howTheMapWorks(),
          ]
          return messages.every(
            (m) =>
              m.text.trim().length > 0 &&
              !m.text.includes('undefined') &&
              !m.text.includes('null') &&
              !m.text.includes('[object Object]') &&
              m.id.length > 0,
          )
        },
      ),
      { numRuns: 40 },
    )
  })
})

describe('OwlSays', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when there is nothing to say', () => {
    render(<OwlSays guidance={null} />)
    expect(screen.queryByTestId('owl-says')).toBeNull()
  })

  it('shows the message with its tone, politely', () => {
    render(<OwlSays guidance={lockedStation('Compartir', 'Acompañar')} />)
    const says = screen.getByTestId('owl-says')
    expect(says).toHaveAttribute('data-tone', 'guide')
    expect(says).toHaveAttribute('aria-live', 'polite')
    expect(says).toHaveTextContent(/Acompañar/)
  })

  it('clears a transient message on its own', () => {
    render(<OwlSays guidance={lockedStation('Compartir', 'Acompañar')} />)
    expect(screen.getByTestId('owl-says')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(6000)
    })

    expect(screen.queryByTestId('owl-says')).toBeNull()
  })

  it('keeps a steady message until it is dismissed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<OwlSays guidance={journeyProgress(2)} />)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    // Still there: it describes a state, so time alone must not remove it.
    expect(screen.getByTestId('owl-says')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cerrar mensaje/i }))
    expect(screen.queryByTestId('owl-says')).toBeNull()
  })

  it('does not resurrect a message the teacher already dismissed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const guidance = journeyProgress(2)
    const { rerender } = render(<OwlSays guidance={guidance} />)

    await user.click(screen.getByRole('button', { name: /cerrar mensaje/i }))
    rerender(<OwlSays guidance={journeyProgress(2)} />)
    expect(screen.queryByTestId('owl-says')).toBeNull()

    // A genuinely different message still gets through.
    rerender(<OwlSays guidance={journeyProgress(1)} />)
    expect(screen.getByTestId('owl-says')).toBeInTheDocument()
  })
})
