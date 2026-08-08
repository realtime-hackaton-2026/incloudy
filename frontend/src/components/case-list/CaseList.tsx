/**
 * Casos: the map, and the stories living on it.
 *
 * The map is the hero rather than one card among many, and hovering a case
 * lights its location — and vice versa — so the list and the world read as
 * one thing instead of two panels that happen to share a page.
 */

import { useState } from 'react'
import { useCases } from '../../cases'
import type { Case } from '../../cases'
import { CaseMap, STATIONS } from '../case-map'
import type { CaseStage } from '../case-map'
import { ConfirmDialog } from '../confirm-dialog'
import styles from './CaseList.module.css'

export interface CaseListProps {
  token: string
  ownerId: string | null
  onOpen: (caseId: string) => void
}

export function CaseList({ token, ownerId, onOpen }: CaseListProps) {
  const { cases, status, error, create, remove } = useCases(token)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Case | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Which station is lit right now, and which card lit it.
  const [litStage, setLitStage] = useState<CaseStage | null>(null)
  const [litCaseId, setLitCaseId] = useState<string | null>(null)

  async function handleCreate() {
    setCreating(true)
    try {
      const created = await create({
        alumno: { nombre: 'Nuevo alumno', descripcion: '' },
        estaciones: [],
      })
      onOpen(created.id)
    } finally {
      setCreating(false)
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(pendingDelete.id)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  function lightFromCard(item: Case | null) {
    setLitCaseId(item?.id ?? null)
    setLitStage(item ? stageOf(item) : null)
  }

  function lightFromMap(stage: CaseStage | null) {
    setLitStage(stage)
    // Light the first case standing on that station, so the link is visibly
    // mutual rather than one-directional.
    const match = stage ? cases.find((item) => stageOf(item) === stage) : undefined
    setLitCaseId(match?.id ?? null)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.mapStage}>
        <CaseMap
          stage={litStage ?? 'explorar'}
          highlightStage={litStage}
          onHoverStage={lightFromMap}
          onSelectStage={(stage) => {
            const match = cases.find((item) => stageOf(item) === stage)
            if (match) onOpen(match.id)
          }}
        />
      </div>

      <div className={styles.intro}>
        <div className={styles.introText}>
          <span className="eyebrow">Tus casos</span>
          <p className={styles.lede}>Sigue cada historia por el mapa.</p>
        </div>
        <button
          type="button"
          className={`btn-primary ${styles.newButton}`}
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? 'Creando…' : '+ Nuevo caso'}
        </button>
      </div>

      {status === 'loading' && <p className={styles.state}>Cargando casos…</p>}
      {status === 'error' && (
        <p className={`${styles.state} ${styles.stateError}`} role="alert">
          {error}
        </p>
      )}

      {status === 'ready' && cases.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>Aún no hay casos</span>
          <p className={styles.emptyBody}>
            Tu mapa está esperando su primera historia.
          </p>
          <button
            type="button"
            className={`btn-primary ${styles.emptyCta}`}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Creando…' : '+ Crear nuevo caso'}
          </button>
        </div>
      )}

      {cases.length > 0 && (
        <ul className={styles.list}>
          {cases.map((item) => {
            const done = item.estaciones.filter((station) => station.completado).length
            const total = item.estaciones.length
            const percent = total ? Math.round((done / total) * 100) : 0
            const station = STATIONS.find((entry) => entry.stage === stageOf(item))
            const shared = ownerId !== null && item.profesorId !== ownerId

            return (
              <li
                key={item.id}
                className={`${styles.card} ${litCaseId === item.id ? styles.cardLit : ''}`}
                onMouseEnter={() => lightFromCard(item)}
                onMouseLeave={() => lightFromCard(null)}
              >
                <button
                  type="button"
                  className={styles.cardMain}
                  onClick={() => onOpen(item.id)}
                >
                  <span className={styles.cardNumber}>
                    Caso #{item.id.slice(-4).toUpperCase()}
                  </span>
                  <span className={styles.cardName}>{item.alumno.nombre}</span>
                  <span className={styles.cardStations}>
                    {total === 0
                      ? 'Sin estaciones todavía'
                      : `${done} de ${total} estaciones completadas`}
                  </span>

                  <span className={styles.cardBar}>
                    <span className={styles.cardBarFill} style={{ width: `${percent}%` }} />
                  </span>

                  <span className={styles.cardFooterLabel}>Última actividad</span>
                  <span className={styles.cardActivity}>
                    {station ? `${station.label} ${station.place}` : '—'}
                  </span>
                </button>

                <div className={styles.cardBottom}>
                  <span
                    className={`${styles.cardStatus} ${shared ? styles.cardShared : ''}`}
                  >
                    {shared
                      ? 'Compartido contigo'
                      : item.status === 'publicado'
                        ? 'Publicado'
                        : 'Borrador'}
                  </span>
                  <button
                    type="button"
                    className={styles.cardContinue}
                    onClick={() => onOpen(item.id)}
                  >
                    Continuar →
                  </button>
                </div>

                <button
                  type="button"
                  className={styles.cardDelete}
                  onClick={() => setPendingDelete(item)}
                  aria-label={`Eliminar el caso de ${item.alumno.nombre}`}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`¿Eliminar el caso de ${pendingDelete?.alumno.nombre ?? ''}?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        tone="danger"
        pending={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

/**
 * Which station a case is standing on.
 *
 * PROVISIONAL — derived from the checklist's completion, because the current
 * backend has no link between a case and the five map stages: `estaciones`
 * is a freeform list the teacher writes, and the stages are fixed artwork.
 * The `features/cases` branch adds `estado_interactivo.estacion_actual`,
 * which carries exactly these five ids; when that lands this whole function
 * collapses to reading that field. Kept in one place for that reason.
 */
function stageOf(item: Case): CaseStage {
  const total = item.estaciones.length
  if (total === 0) return STATIONS[0].stage
  const done = item.estaciones.filter((station) => station.completado).length
  const index = Math.min(STATIONS.length - 1, Math.floor((done / total) * STATIONS.length))
  return STATIONS[index].stage
}
