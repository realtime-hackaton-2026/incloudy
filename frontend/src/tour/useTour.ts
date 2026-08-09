/*
 * frontend/src/tour/useTour.ts // remembers which screens a teacher has
 * already been shown around, so the tour never plays twice by itself.
 */

import { useCallback, useEffect, useState } from 'react'
import { TOUR_STEPS } from './steps'
import type { TourScreen } from './steps'

const SEEN_KEY = 'incloudy.tour.seen'
const OFF_KEY = 'incloudy.tour.off'

/*
 * A private window, a locked-down browser or a full disk all throw here.
 * None of them is a reason to hide the app, so storage failures degrade to
 * "nothing remembered" rather than propagating.
 */
function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function persist(seen: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // Nothing to do: the tour just asks again next time.
  }
}

function readOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1'
  } catch {
    return false
  }
}

export interface TourState {
  /** The step being shown, or null when the tour is not running. */
  step: number | null
  total: number
  next: () => void
  back: () => void
  /** Ends this screen's tour and marks it seen. */
  skip: () => void
  /** Ends every tour, on every screen, for good. */
  skipAll: () => void
  /** Replays this screen's tour on demand, even once seen. */
  restart: () => void
}

export function useTour(screen: TourScreen | null): TourState {
  const [step, setStep] = useState<number | null>(null)
  const total = screen ? TOUR_STEPS[screen].length : 0

  useEffect(() => {
    if (!screen) return
    /*
     * A beat of delay, not zero: the tour points at elements the screen has
     * only just started rendering, and a step that opens before its target
     * exists is a step that silently stops pointing.
     *
     * The "already seen" check lives inside the timer rather than in the
     * effect body on purpose — deciding out here means writing state
     * synchronously during the effect, which is the cascading-render pattern
     * the lint rule catches.
     */
    const timer = setTimeout(() => {
      if (readOff() || readSeen().has(screen)) return
      setStep(0)
    }, 600)
    return () => {
      clearTimeout(timer)
      // Leaving a screen closes its tour; the next screen opens its own.
      setStep(null)
    }
  }, [screen])

  const finish = useCallback(() => {
    setStep(null)
    if (!screen) return
    const seen = readSeen()
    seen.add(screen)
    persist(seen)
  }, [screen])

  const next = useCallback(() => {
    setStep((current) => {
      if (current === null) return null
      if (current + 1 >= total) {
        // Marking it seen is `finish`'s job, but this runs inside the state
        // updater, so it is deferred rather than called here.
        queueMicrotask(finish)
        return null
      }
      return current + 1
    })
  }, [total, finish])

  const back = useCallback(() => {
    setStep((current) => (current === null || current === 0 ? current : current - 1))
  }, [])

  const skipAll = useCallback(() => {
    try {
      localStorage.setItem(OFF_KEY, '1')
    } catch {
      // Same as above: worst case it offers the tour again.
    }
    setStep(null)
  }, [])

  const restart = useCallback(() => {
    if (total > 0) setStep(0)
  }, [total])

  return { step, total, next, back, skip: finish, skipAll, restart }
}
