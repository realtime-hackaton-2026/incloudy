/*
 * frontend/src/reward/XpCounter.tsx // XP that is collected rather than
 * recalculated: a gain rises off the counter, the counter answers.
 *
 * Invariant 10 — this only ever *reflects* a number the server already
 * returned. It compares the value it is handed against the previous render;
 * it never adds up XP itself, and nothing downstream waits on the animation.
 */

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import styles from './XpCounter.module.css'

/** Sparks per burst. Five reads as a reward; fifty reads as a slot machine. */
const SPARKS = 5

export interface XpCounterProps {
  value: number
  /** Shown after the number, e.g. "XP". */
  suffix?: string
  className?: string
}

interface Gain {
  amount: number
  /** Restarts the CSS animation when gains land back to back. */
  key: number
}

export function XpCounter({ value, suffix = 'XP', className }: XpCounterProps) {
  /*
   * Derived during render, not in an effect. React sanctions adjusting state
   * while rendering when it depends on a changed prop, and it keeps the
   * gain on screen in the same commit as the new total — an effect would
   * paint the new number first and the reward a frame later, which reads as
   * a glitch rather than as a reward.
   */
  const [previous, setPrevious] = useState(value)
  const [gain, setGain] = useState<Gain | null>(null)

  if (value !== previous) {
    setPrevious(value)
    // Only increases are a reward. A correction downward is silent.
    // The key counts up rather than reading the clock — render has to stay
    // pure, and consecutive gains only need to differ, not be timestamped.
    if (value > previous) {
      setGain((current) => ({ amount: value - previous, key: (current?.key ?? 0) + 1 }))
    }
  }

  useEffect(() => {
    if (!gain) return
    const timer = setTimeout(() => setGain(null), 1500)
    return () => clearTimeout(timer)
  }, [gain])

  return (
    <span
      className={[styles.counter, gain ? styles.counting : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      data-testid="xp-counter"
      data-gain={gain ? gain.amount : ''}
    >
      <span aria-hidden="true">✦</span>
      <span className={styles.value}>{value}</span>
      {suffix && <span>{suffix}</span>}

      {gain && (
        <>
          {/* Announced once, politely: the total is already in the text above,
              so this only has to say what was just won. */}
          <span className={styles.gain} key={gain.key} role="status">
            +{gain.amount} {suffix}
          </span>
          {Array.from({ length: SPARKS }, (_, index) => {
            // Fan the sparks over a half-circle so the burst has direction
            // instead of looking like the same five dots every time.
            const angle = -140 + (index * 100) / (SPARKS - 1)
            const radians = (angle * Math.PI) / 180
            return (
              <span
                key={`${gain.key}-${index}`}
                className={styles.spark}
                aria-hidden="true"
                style={
                  {
                    '--sx': `${Math.cos(radians) * 26}px`,
                    '--sy': `${Math.sin(radians) * 26}px`,
                    animationDelay: `${index * 40}ms`,
                  } as CSSProperties
                }
              />
            )
          })}
        </>
      )}
    </span>
  )
}
