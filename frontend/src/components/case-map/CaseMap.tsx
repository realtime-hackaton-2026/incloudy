/**
 * The case map: one path through five stations, not a world to walk around.
 *
 * Presentational on purpose — it takes a stage and draws it. Whoever renders
 * it decides where the stage comes from, so the same component works for a
 * static case history and for a live one moving under Portal events.
 */

import mapArt from '../../assets/images/fondo.png'
import styles from './CaseMap.module.css'
import { MAP_ASPECT_RATIO, STATIONS, stationFor, stationIndex } from './stations'
import type { CaseStage } from './stations'

export interface CaseMapProps {
  stage: CaseStage
  /** Omit to render a read-only map: stations stop being clickable. */
  onSelectStage?: (stage: CaseStage) => void
  className?: string
}

export function CaseMap({ stage, onSelectStage, className }: CaseMapProps) {
  const active = stationFor(stage)
  const activeIndex = stationIndex(stage)

  return (
    <div className={className ? `${styles.wrapper} ${className}` : styles.wrapper}>
      <div className={styles.frame} style={{ aspectRatio: MAP_ASPECT_RATIO }}>
        <img
          src={mapArt}
          alt="Mapa del caso: selva, montaña, escuela, bosque y aldea."
          className={styles.art}
        />

        {STATIONS.map((station, index) => {
          const reached = index <= activeIndex
          const isActive = station.stage === stage
          const classes = [styles.station]
          if (reached) classes.push(styles.reached)
          // The pin already marks the current station; a bead there would collide with it.
          if (isActive) classes.push(styles.underPin)
          return (
            <button
              key={station.stage}
              type="button"
              disabled={!onSelectStage || isActive}
              onClick={() => onSelectStage?.(station.stage)}
              className={classes.join(' ')}
              // Beads sit just above the signposts so they never cover the lettering.
              style={{ left: `${station.x}%`, top: `${station.y - 5.2}%` }}
              aria-current={station.stage === stage ? 'step' : undefined}
              aria-label={`${station.label} ${station.place}`}
              title={`${station.label} ${station.place}`}
            />
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
              stroke="#fffbeb"
              strokeWidth="2"
            />
            <circle cx="12" cy="9.6" r="3.4" fill="#78350f" />
          </svg>
          <span className={styles.pulse} />
        </div>
      </div>

      <div className={styles.caption}>
        <span className={styles.current}>
          {active.label} <span className={styles.place}>{active.place}</span>
        </span>
        <span className={styles.progress}>
          Etapa {activeIndex + 1} de {STATIONS.length}
        </span>
      </div>
    </div>
  )
}
