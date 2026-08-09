/*
 * frontend/src/test/tour.test.tsx // the tour has to be escapable, has to
 * stay gone once skipped, and must not break when a target is missing.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, renderHook, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TourOverlay, useTour } from '../tour'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

function renderStep(step: number, overrides: Partial<Parameters<typeof TourOverlay>[0]> = {}) {
  const props = {
    screen: 'cases' as const,
    step,
    total: 3,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
    onSkipAll: vi.fn(),
    ...overrides,
  }
  render(<TourOverlay {...props} />)
  return props
}

describe('TourOverlay', () => {
  it('names the step it is on for a screen reader', () => {
    renderStep(0)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/paso 1 de 3/i)
  })

  it('offers Atrás only once there is somewhere to go back to', () => {
    const { unmount } = render(
      <TourOverlay
        screen="cases"
        step={0}
        total={3}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        onSkipAll={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument()
    unmount()

    renderStep(1)
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeInTheDocument()
  })

  it('calls the last step "Empezar" rather than "Siguiente"', () => {
    renderStep(2)
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument()
  })

  it('escapes out of the tour', async () => {
    const user = userEvent.setup()
    const props = renderStep(0)
    await user.keyboard('{Escape}')
    expect(props.onSkip).toHaveBeenCalled()
  })

  it('still renders when the step points at something that is not there', () => {
    // Step 2 of `cases` targets the join button, which this test never mounts.
    renderStep(2)
    expect(screen.getByTestId('tour-overlay')).toBeInTheDocument()
  })
})

describe('useTour', () => {
  it('opens on a screen the teacher has not seen', async () => {
    const { result } = renderHook(() => useTour('cases'))
    await waitFor(() => expect(result.current.step).toBe(0))
  })

  it('stays closed on a screen already skipped', async () => {
    const first = renderHook(() => useTour('cases'))
    await waitFor(() => expect(first.result.current.step).toBe(0))
    act(() => first.result.current.skip())
    first.unmount()

    const second = renderHook(() => useTour('cases'))
    // Long enough to cover the open delay: it must not appear at all.
    await new Promise((resolve) => setTimeout(resolve, 750))
    expect(second.result.current.step).toBeNull()
  })

  it('"no mostrar más" silences every screen, not just this one', async () => {
    const cases = renderHook(() => useTour('cases'))
    await waitFor(() => expect(cases.result.current.step).toBe(0))
    act(() => cases.result.current.skipAll())
    cases.unmount()

    const caseScreen = renderHook(() => useTour('case'))
    await new Promise((resolve) => setTimeout(resolve, 750))
    expect(caseScreen.result.current.step).toBeNull()
  })

  it('never runs while signed out', async () => {
    const { result } = renderHook(() => useTour(null))
    await new Promise((resolve) => setTimeout(resolve, 750))
    expect(result.current.step).toBeNull()
  })

  it('closes itself after the last step', async () => {
    const { result } = renderHook(() => useTour('dashboard'))
    await waitFor(() => expect(result.current.step).toBe(0))
    expect(result.current.total).toBe(1)

    act(() => result.current.next())
    await waitFor(() => expect(result.current.step).toBeNull())
  })
})
