/**
 * The case map: one path through five stations, not a world to walk around.
 *
 * Presentational on purpose — it takes a stage and draws it. Whoever renders
 * it decides where the stage comes from, so the same component works for a
 * static case history and for a live one moving under Portal events.
 *
 * The artwork is immutable. Everything cinematic here (camera, spotlight,
 * hotspots, HUD) is layered around `fondo.png`, never applied to it.
 */

import { useState } from 'react'
import type { CSSProperties } from 'react'
import mapArt from '../../assets/images/fondo.png'
import { ProgressJourney } from '../progress-journey'
import styles from './CaseMap.module.css'
import { MAP_ASPECT_RATIO, STATIONS, stationFor, stationIndex } from './stations'
import type { CaseStage } from './stations'

/** How far the camera pushes in on a selected station. */
const CAMERA_ZOOM = 1.08

export interface CaseMapProps {
  stage: CaseStage
  /** Omit to render a read-only map: stations stop being clickable. */
  onSelectStage?: (stage: CaseStage) => void
  /** Lit from outside — e.g. the case card the pointer is currently over. */
  highlightStage?: CaseStage | null
  /** Reports the station under the pointer, so a case list can light up in turn. */
  onHoverStage?: (stage: CaseStage | null) => void
  className?: string
}

export function CaseMap({
  stage,
  onSelectStage,
  highlightStage = null,
  onHoverStage,
  className,
}: CaseMapProps) {
  // Where the camera is pointed. Null is the wide view; picking a station
  // pushes in on it and opens the HUD.
  const [focused, setFocused] = useState<CaseStage | null>(null)

  const active = stationFor(stage)
  const activeIndex = stationIndex(stage)
  const focusedStation = focused ? stationFor(focused) : null
  const lit = focusedStation ?? (highlightStage ? stationFor(highlightStage) : null)

  // With the origin pinned to the station, that point is the one thing the
  // zoom leaves untouched — so the HUD below can use the same coordinates.
  const camera = focusedStation
    ? {
        transformOrigin: `${focusedStation.x}% ${focusedStation.y}%`,
        transform: `scale(${CAMERA_ZOOM})`,
      }
    : undefined

  // Keep the panel inside the frame: stations on the right get it on their left.
  const hudOnLeft = focusedStation !== null && focusedStation.x > 55
  const hudTransform = hudOnLeft
    ? 'translate(calc(-100% - 26px), -50%)'
    : 'translate(26px, -50%)'

  function focus(next: CaseStage | null) {
    setFocused(next)
    onHoverStage?.(next)
  }

  return (
    <div className={className ? `${styles.wrapper} ${className}` : styles.wrapper}>
      <div className={styles.frame} style={{ aspectRatio: MAP_ASPECT_RATIO }}>
        <div className={styles.camera} style={camera}>
          <img
            src={mapArt}
            alt="Mapa del caso: selva, montaña, escuela, bosque y aldea."
            className={styles.art}
          />

          {/* Dims everything but the lit station — a spotlight, not a filter
              over the artwork. */}
          <div
            className={`${styles.spotlight} ${lit ? styles.spotlightOn : ''}`}
            style={
              lit
                ? {
                    background: `radial-gradient(circle at ${lit.x}% ${lit.y}%, transparent 0%, transparent 9%, rgb(6 8 12 / 55%) 34%)`,
                  }
                : undefined
            }
            aria-hidden="true"
          />

          {STATIONS.map((station, index) => {
            const reached = index <= activeIndex
            const isActive = station.stage === stage
            const classes = [styles.hotspot]
            if (reached) classes.push(styles.reached)
            // The pin already marks the current station; a bead there would
            // collide with it.
            if (isActive) classes.push(styles.underPin)
            if (lit?.stage === station.stage) classes.push(styles.hotspotHighlighted)

            return (
              <button
                key={station.stage}
                type="button"
                disabled={!onSelectStage}
                onClick={() => focus(focused === station.stage ? null : station.stage)}
                onMouseEnter={() => onHoverStage?.(station.stage)}
                onMouseLeave={() => onHoverStage?.(focused)}
                className={classes.join(' ')}
                // Beads sit just above the signposts so they never cover the
                // lettering.
                style={{ left: `${station.x}%`, top: `${station.y - 5.2}%` }}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${station.label} ${station.place}`}
              >
                <span className={styles.hotspotLabel}>{station.label}</span>
              </button>
            )
          })}

          <div
            className={styles.marker}
            style={{ left: `${active.x}%`, top: `${active.y}%` }}
            aria-hidden="true"
          >
            <svg className={styles.pin} viewBox="0 0 24 32" fill="none">
              <path
                d="M12 1c5 0 9 3.9 9 8.8 0 6.6-9 20.2-9 20.2S3 16.4 3 9.8C3 4.9 7 1 12 1Z"
                fill="currentColor"
                stroke="#10131a"
                strokeWidth="2"
              />
              <circle cx="12" cy="9.6" r="3.4" fill="#10131a" />
            </svg>
            <span className={styles.pulse} />
          </div>
        </div>

        {focusedStation && (
          <div
            className={`${styles.hud} ${hudOnLeft ? styles.hudLeft : styles.hudRight}`}
            style={
              {
                left: `${focusedStation.x}%`,
                top: `${focusedStation.y}%`,
                transform: hudTransform,
                '--hud-transform': hudTransform,
              } as CSSProperties
            }
          >
            <span className={styles.hudTitle}>
              {focusedStation.label}
              <span className={styles.hudPlace}>{focusedStation.place}</span>
            </span>

            <p className={styles.hudMeta}>
              Aventura {stationIndex(focusedStation.stage) + 1} de {STATIONS.length}
            </p>
            <div
              className={styles.hudBeads}
              role="img"
              aria-label={`Aventura ${stationIndex(focusedStation.stage) + 1} de ${STATIONS.length}`}
            >
              {STATIONS.map((entry, index) => (
                <span
                  key={entry.stage}
                  className={`${styles.bead} ${
                    index <= stationIndex(focusedStation.stage) ? styles.beadDone : ''
                  }`}
                />
              ))}
            </div>

            <div className={styles.hudActions}>
              <button
                type="button"
                className={styles.hudGo}
                onClick={() => {
                  onSelectStage?.(focusedStation.stage)
                  focus(null)
                }}
              >
                Explorar →
              </button>
              <button
                type="button"
                className={styles.hudClose}
                onClick={() => focus(null)}
                aria-label="Cerrar y alejar la cámara"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.caption}>
        <span className={styles.current}>
          {active.label} <span className={styles.place}>{active.place}</span>
        </span>
        <span className={styles.hint}>
          {focused ? 'Cierra para alejar' : 'Toca un lugar del mapa'}
        </span>
      </div>

      <ProgressJourney
        nodes={STATIONS.map((station) => ({ id: station.stage, label: station.label }))}
        activeIndex={activeIndex}
        onSelect={onSelectStage ? (id) => focus(id as CaseStage) : undefined}
      />
    </div>
  )
}
