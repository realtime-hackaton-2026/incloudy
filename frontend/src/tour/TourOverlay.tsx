/*
 * frontend/src/tour/TourOverlay.tsx // the guided pass over a screen: one card
 * at a time, pointing at the real thing when it can find it.
 */

import { useEffect, useRef, useState } from 'react'
import { VideoTrigger } from '../components/video-modal'
import { TOUR_STEPS } from './steps'
import type { TourScreen } from './steps'
import styles from './TourOverlay.module.css'

interface Spot {
  top: number
  left: number
  width: number
  height: number
}

export interface TourOverlayProps {
  screen: TourScreen
  step: number
  total: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onSkipAll: () => void
}

export function TourOverlay({
  screen,
  step,
  total,
  onNext,
  onBack,
  onSkip,
  onSkipAll,
}: TourOverlayProps) {
  const current = TOUR_STEPS[screen][step]
  const [spot, setSpot] = useState<Spot | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  /*
   * Measured in a layout effect and re-measured on scroll/resize: the
   * highlight is drawn in viewport coordinates, so anything that moves the
   * page moves the hole in the scrim with it.
   */
  useEffect(() => {
    const target = current.target
    const measure = () => {
      const node = target ? document.querySelector(target) : null
      if (!node) {
        setSpot(null)
        return
      }
      const rect = node.getBoundingClientRect()
      // Off-screen or collapsed: pointing at it would be a lie.
      if (rect.width === 0 || rect.height === 0) {
        setSpot(null)
        return
      }
      setSpot({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    }

    /*
     * Measured on the next frame, not in the effect body. The step often
     * opens while its target is still animating in, and a rect read before
     * layout settles puts the highlight in the wrong place — plus a
     * synchronous setState here is the cascading-render pattern the effect
     * lint rule flags.
     */
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [current.target, step])

  useEffect(() => {
    cardRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip()
      if (event.key === 'ArrowRight') onNext()
      if (event.key === 'ArrowLeft') onBack()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onSkip, onNext, onBack])

  const last = step + 1 >= total

  return (
    <div className={styles.layer} data-testid="tour-overlay">
      {/* Four panels around the target rather than one box-shadow ring: this
          way the highlighted element stays fully interactive. */}
      {spot ? (
        <>
          <div className={styles.mask} style={{ inset: `0 0 auto 0`, height: spot.top - 6 }} />
          <div className={styles.mask} style={{ top: spot.top + spot.height + 6, left: 0, right: 0, bottom: 0 }} />
          <div className={styles.mask} style={{ top: spot.top - 6, left: 0, width: spot.left - 6, height: spot.height + 12 }} />
          <div className={styles.mask} style={{ top: spot.top - 6, left: spot.left + spot.width + 6, right: 0, height: spot.height + 12 }} />
          <div
            className={styles.ring}
            style={{
              top: spot.top - 6,
              left: spot.left - 6,
              width: spot.width + 12,
              height: spot.height + 12,
            }}
          />
        </>
      ) : (
        <div className={`${styles.mask} ${styles.maskFull}`} />
      )}

      <div
        ref={cardRef}
        className={`${styles.card} ${spot ? styles.cardAnchored : ''}`}
        style={spot ? cardPosition(spot) : undefined}
        role="dialog"
        aria-modal="false"
        aria-label={`Paso ${step + 1} de ${total}: ${current.title}`}
        tabIndex={-1}
      >
        <div className={styles.head}>
          <span className={styles.counter}>
            Paso {step + 1} de {total}
          </span>
          <button type="button" className={styles.skip} onClick={onSkip}>
            Saltar
          </button>
        </div>

        <h3 className={styles.title}>{current.title}</h3>
        <p className={styles.body}>{current.body}</p>

        <div className={styles.dots} aria-hidden="true">
          {Array.from({ length: total }, (_, index) => (
            <span key={index} className={index === step ? styles.dotOn : styles.dot} />
          ))}
        </div>

        <div className={styles.actions}>
          {step > 0 && (
            <button type="button" className={styles.back} onClick={onBack}>
              Atrás
            </button>
          )}
          <button type="button" className={styles.next} onClick={onNext}>
            {last ? 'Empezar' : 'Siguiente'}
          </button>
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.skipAll} onClick={onSkipAll}>
            No mostrar más
          </button>
          {last && <VideoTrigger label="Ver el vídeo · 2 min" />}
        </div>
      </div>
    </div>
  )
}

/*
 * Below the target, or above it when there is no room below. Clamped to the
 * viewport so a target near an edge cannot push the card off-screen.
 */
function cardPosition(spot: Spot): { top: number; left: number } {
  const CARD = { width: 320, height: 250 }
  const GAP = 16
  const below = spot.top + spot.height + GAP
  const fitsBelow = below + CARD.height < window.innerHeight
  const top = fitsBelow ? below : Math.max(GAP, spot.top - CARD.height - GAP)
  const left = Math.min(
    Math.max(GAP, spot.left + spot.width / 2 - CARD.width / 2),
    Math.max(GAP, window.innerWidth - CARD.width - GAP),
  )
  return { top, left }
}
