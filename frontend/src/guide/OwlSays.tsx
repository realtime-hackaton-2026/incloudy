/*
 * frontend/src/guide/OwlSays.tsx // the owl reacting to what just happened,
 * as opposed to OwlTip's one-off lesson.
 *
 * Transient messages clear themselves; steady ones stay until dismissed. The
 * caller passes the guidance it derived from real state — this component
 * decides nothing about the case.
 */

import { useEffect, useState } from 'react'
import { Owl } from './Owl'
import { TONE_MARK } from './says'
import type { Guidance } from './says'
import styles from './OwlSays.module.css'

/** Long enough to read a sentence, short enough not to nag. */
const TRANSIENT_MS = 5000

export interface OwlSaysProps {
  guidance: Guidance | null
}

export function OwlSays({ guidance }: OwlSaysProps) {
  // Tracked by id so a repeat of the same message does not resurrect one the
  // teacher already dismissed, while a genuinely new message always shows.
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const [expiredId, setExpiredId] = useState<string | null>(null)

  const activeId = guidance?.id ?? null
  const hidden = activeId !== null && (activeId === dismissedId || activeId === expiredId)

  useEffect(() => {
    if (!guidance?.transient) return
    const timer = setTimeout(() => setExpiredId(guidance.id), TRANSIENT_MS)
    return () => clearTimeout(timer)
  }, [guidance])

  if (!guidance || hidden) return null

  return (
    <div
      className={`${styles.says} ${styles[guidance.tone] ?? ''}`}
      data-testid="owl-says"
      data-tone={guidance.tone}
      data-guidance-id={guidance.id}
      // Polite: the owl comments on what the child just did; it must never
      // cut across whatever they are reading next.
      role="status"
      aria-live="polite"
    >
      <Owl className={styles.mark} />
      <span className={styles.mark} aria-hidden="true">
        {TONE_MARK[guidance.tone]}
      </span>
      <p className={styles.bubble}>{guidance.text}</p>
      {!guidance.transient && (
        <button
          type="button"
          className={styles.dismiss}
          onClick={() => setDismissedId(guidance.id)}
          aria-label="Cerrar mensaje"
        >
          ✕
        </button>
      )}
    </div>
  )
}
