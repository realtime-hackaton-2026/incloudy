/**
 * Covers a route change that is supposed to feel like travelling, not
 * loading. Mounted only for the duration of the transition; the caller owns
 * the timing so the overlay never outlives the movement underneath it.
 */

import styles from './CinematicOverlay.module.css'

export interface CinematicOverlayProps {
  /** Short line held in the middle of the transition. */
  caption?: string
}

export function CinematicOverlay({ caption = 'Entrando al mapa' }: CinematicOverlayProps) {
  return (
    <div
      className={styles.overlay}
      role="presentation"
      data-testid="cinematic-overlay"
      data-state="active"
    >
      <span className={styles.word}>{caption}</span>
    </div>
  )
}
