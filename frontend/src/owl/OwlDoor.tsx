/*
 * frontend/src/owl/OwlDoor.tsx // the guide owl doubles as the door into the
 * case's live room. Closed, it's a perch that names the station the case
 * stands on right now — that's the connection to `case-map/stations.ts`,
 * the one source of truth for what a station is called and where it sits.
 * Opened, it mounts `CaseRoom` (the actual Portal channel from `../portal`)
 * for the first time — so nobody pays for a live connection before they've
 * asked to meet.
 */

import { useState } from 'react'
import { stationFor } from '../components/case-map/stations'
import type { CaseStage } from '../components/case-map/stations'
import { CaseRoom } from '../portal'
import { OwlSprite } from './OwlSprite'
import styles from './OwlDoor.module.css'

export interface OwlDoorProps {
  token: string
  caseId: string
  /** Which station the case stands on right now — read straight from the map's own data, never duplicated here. */
  stage: CaseStage
}

export function OwlDoor({ token, caseId, stage }: OwlDoorProps) {
  const [open, setOpen] = useState(false)
  const station = stationFor(stage)

  return (
    <div className={styles.wrapper} data-testid="owl-door" data-state={open ? 'open' : 'closed'}>
      <button
        type="button"
        className={styles.door}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="owl-door-room"
      >
        <OwlSprite className={styles.owl} />
        <span className={styles.label}>
          <span className={styles.title}>
            {open ? 'Cerrar la sala' : 'Reunirse con el equipo'}
          </span>
          <span className={styles.subtitle}>
            {station.label} · {station.place}
          </span>
        </span>
        <span className={styles.chevron} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div id="owl-door-room" className={styles.room}>
          <CaseRoom token={token} caseId={caseId} />
        </div>
      )}
    </div>
  )
}
