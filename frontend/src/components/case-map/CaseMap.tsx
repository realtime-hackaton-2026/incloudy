/*
 * frontend/src/components/case-map/CaseMap.tsx // one path through five
 * stations — completed, available, locked — with the camera, spotlight and
 * HUD layered around an artwork that is never itself modified.
 *
 * Presentational on purpose: it takes a stage and draws it. Whoever renders
 * it decides where the stage comes from, so the same component works for a
 * static case history and for a live one moving under Portal events.
 */

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import mapArt from '../../assets/images/mapa-completo.webp'
import styles from './CaseMap.module.css'
import { MAP_ASPECT_RATIO, STATIONS, stationFor, stationIndex } from './stations'
import type { CaseStage, Station } from './stations'

/** How far the camera pushes in on a selected station. */
const CAMERA_ZOOM = 1.28

/**
 * Where a station stands relative to the case's current position.
 *
 * `estacion_actual` is the first station the server still considers
 * unanswered, so it splits the five cleanly: anything before it is done,
 * anything after it is not yet reachable.
 */
export type StationState = 'completed' | 'available' | 'locked'

function stationStateAt(index: number, activeIndex: number): StationState {
  if (index < activeIndex) return 'completed'
  if (index === activeIndex) return 'available'
  return 'locked'
}

/** Spoken state, so it does not depend on seeing the colour. */
const STATE_SUFFIX: Record<StationState, string> = {
  completed: ' · completada',
  available: ' · disponible',
  locked: ' · bloqueada',
}

export interface CaseMapProps {
  stage: CaseStage
  /** Omit to render a read-only map: stations stop being clickable. */
  onSelectStage?: (stage: CaseStage) => void
  /** Lit from outside — e.g. the case card the pointer is currently over. */
  highlightStage?: CaseStage | null
  /** Reports the station under the pointer, so a case list can light up in turn. */
  onHoverStage?: (stage: CaseStage | null) => void
  /**
   * Someone tapped a station they have not reached yet. Carries the station
   * that must be finished first, so the guide can name it instead of saying
   * a bare "bloqueada".
   */
  onLockedAttempt?: (station: Station, mustFinishFirst: Station | null) => void
  /** Estaciones con una respuesta guardada, aunque luego se hayan editado. */
  completedStages?: readonly CaseStage[]
  /** Personaje que funciona como marcador GPS de la estación actual. */
  markerAvatar?: { src: string; name: string }
  className?: string
  /**
   * Lets the map break out of the app's reading-width shell. The map is the
   * game on its own route and one section among many inside a case, so the
   * caller decides which it is.
   */
  wide?: boolean
  /**
   * Fills the popup with real content — a station's actual form — instead
   * of the small "Explorar →" preview. This is what turns a click on the
   * map into the place a teacher answers that station, rather than a
   * summary card. Also makes hotspots clickable on its own, independent of
   * `onSelectStage`.
   */
  renderStationPanel?: (station: Station, close: () => void) => ReactNode
}

export function CaseMap({
  stage,
  onSelectStage,
  highlightStage = null,
  onHoverStage,
  onLockedAttempt,
  completedStages = [],
  markerAvatar,
  className,
  wide = false,
  renderStationPanel,
}: CaseMapProps) {
  // Where the camera is pointed. Null is the wide view; picking a station
  // pushes in on it and opens the HUD.
  const [focused, setFocused] = useState<CaseStage | null>(null)

  const active = stationFor(stage)
  const activeIndex = stationIndex(stage)
  const focusedStation = focused ? stationFor(focused) : null
  const lit = focusedStation ?? (highlightStage ? stationFor(highlightStage) : null)
  // A custom panel makes the map interactive on its own — a preview HUD
  // with only "Explorar →" still needs onSelectStage to mean anything.
  const interactive = Boolean(onSelectStage) || Boolean(renderStationPanel)
  const completed = new Set(completedStages)

  function stateFor(next: CaseStage): StationState {
    if (completed.has(next)) return 'completed'
    return stationStateAt(stationIndex(next), activeIndex)
  }

  // The journey trail: the stations themselves are the progress indicator,
  // so the route is drawn between their signposts instead of restated as a
  // strip below the map. Filled from the start up to the station the case
  // currently stands on, like the pin it arrives at.
  const basePoints = STATIONS.map((station) => `${station.x},${station.y}`).join(' ')
  const traveledPoints = STATIONS.slice(0, activeIndex + 1)
    .map((station) => `${station.x},${station.y}`)
    .join(' ')

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
    // A locked station has nothing to open: the server would reject the
    // answer with a 409 anyway, so the map refuses the click here rather
    // than presenting a form that cannot be submitted.
    if (next !== null && stateFor(next) === 'locked') return
    setFocused(next)
    onHoverStage?.(next)
  }

  // Escape-to-close only matters once a station holds a real form — the
  // lightweight preview HUD already closes on a second click.
  useEffect(() => {
    if (!renderStationPanel || !focused) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setFocused(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [renderStationPanel, focused])

  return (
    <div
      className={[styles.wrapper, wide ? styles.wide : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={styles.frame}
        style={{ aspectRatio: MAP_ASPECT_RATIO }}
        data-testid="case-map"
        data-state={focusedStation ? 'focused' : 'wide'}
        data-focused-station={focusedStation?.stage ?? ''}
        data-active-station={stage}
      >
        <div className={styles.camera} style={camera}>
          <img
            src={mapArt}
            alt="Mapa del caso: selva, montaña, escuela, bosque y aldea."
            className={styles.art}
          />

          {/* The route between the signposts, in the same percentage space
              as the hotspots. Read as a journey, not drawn over the art: the
              base track is a faint dashed "road ahead", the travelled part
              fills in parchment up to the pin. */}
          <svg
            className={styles.trail}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            data-testid="map-journey"
            data-active-index={activeIndex}
            data-total={STATIONS.length}
          >
            <polyline className={styles.trailBase} points={basePoints} />
            <polyline className={styles.trailTraveled} points={traveledPoints} />
          </svg>

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
            // Three states, not two. `reached` used to cover the current
            // station as well as the finished ones, so "where I am" and
            // "where I have been" looked identical on the map.
            const state = stateFor(station.stage)
            const locked = state === 'locked'
            const isActive = station.stage === stage
            const classes = [styles.hotspot]
            if (state === 'completed') classes.push(styles.completed)
            if (state === 'available') classes.push(styles.available)
            if (locked) classes.push(styles.hotspotLocked)
            if (lit?.stage === station.stage) classes.push(styles.hotspotHighlighted)

            return (
              <button
                key={station.stage}
                type="button"
                /*
                 * `aria-disabled`, not `disabled`. A locked station still has
                 * to answer when a child taps it — "you have to finish the
                 * previous one" is the whole lesson, and a truly disabled
                 * button emits no event to say it with. It stays focusable
                 * and keeps "· bloqueada" in its name; the handler is what
                 * refuses to open the form.
                 */
                disabled={!interactive}
                aria-disabled={locked || undefined}
                onClick={() => {
                  if (locked) {
                    onLockedAttempt?.(station, STATIONS[index - 1] ?? null)
                    return
                  }
                  focus(focused === station.stage ? null : station.stage)
                }}
                onMouseEnter={() => onHoverStage?.(station.stage)}
                onMouseLeave={() => onHoverStage?.(focused)}
                className={classes.join(' ')}
                // Beads sit just above the signposts so they never cover the
                // lettering.
                style={{ left: `${station.x}%`, top: `${station.y - 5.2}%` }}
                aria-current={isActive ? 'step' : undefined}
                // State is in the name, not only in colour — a locked or done
                // station has to be distinguishable without seeing it.
                aria-label={`${station.label} ${station.place}${STATE_SUFFIX[state]}`}
                data-station-state={state}
              >
                <span className={styles.hotspotLabel}>
                  {station.label}
                  <small className={styles.hotspotStatus}>
                    {state === 'completed' ? '✓ Completada · editar' : state === 'locked' ? 'Bloqueada' : 'Abrir estación'}
                  </small>
                </span>
              </button>
            )
          })}

          <div
            className={styles.marker}
            style={{ left: `${active.x}%`, top: `${active.y - 5.2}%` }}
            aria-hidden="true"
          >
            {markerAvatar ? (
              <span className={styles.avatarMarker}>
                <img src={markerAvatar.src} alt="" className={styles.markerAvatarImage} />
              </span>
            ) : <svg className={styles.pin} viewBox="0 0 24 32" fill="none">
              <path
                d="M12 1c5 0 9 3.9 9 8.8 0 6.6-9 20.2-9 20.2S3 16.4 3 9.8C3 4.9 7 1 12 1Z"
                fill="currentColor"
                stroke="#10131a"
                strokeWidth="2"
              />
              <circle cx="12" cy="9.6" r="3.4" fill="#10131a" />
            </svg>}
            <span className={styles.pulse} />
          </div>
        </div>

        {focusedStation && (
          renderStationPanel ? (
            <div className={styles.missionOverlay} data-testid="case-map-mission">
              <div
                className={styles.missionBackdrop}
                style={{
                  backgroundImage: `url(${focusedStation.scene})`,
                  backgroundPosition: focusedStation.scenePosition,
                }}
                aria-hidden="true"
              />
              <div className={styles.missionShade} aria-hidden="true" />
              <div className={styles.missionPanel}>
                <div className={styles.missionHeader}>
                  <span className={styles.missionStation}>{focusedStation.label}</span>
                  <button
                    type="button"
                    className={styles.missionClose}
                    onClick={() => focus(null)}
                    aria-label="Volver al mapa"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.missionBody}>
                  {renderStationPanel(focusedStation, () => focus(null))}
                </div>
              </div>
            </div>
          ) : (
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
              data-testid="case-map-hud"
            >
              <div className={styles.hudHeader}>
                <span className={styles.hudTitle}>
                  {focusedStation.label}
                  <span className={styles.hudPlace}>{focusedStation.place}</span>
                </span>
              </div>
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
          )
        )}
      </div>

      <div className={styles.caption}>
        <span className={styles.current}>
          {active.label} <span className={styles.place}>{active.place}</span>
        </span>
        <span className={styles.journey} aria-label={`Aventura ${activeIndex + 1} de ${STATIONS.length}`}>
          Aventura {activeIndex + 1} de {STATIONS.length}
        </span>
        <span className={styles.hint}>
          {focused ? 'Cierra para alejar' : 'Toca un lugar del mapa'}
        </span>
      </div>
    </div>
  )
}
