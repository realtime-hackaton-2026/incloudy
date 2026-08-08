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
import { STATIONS } from '../case-map'
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.intro}>
        <div className={styles.introText}>
          <span className="eyebrow">Tu diario de aventuras</span>
          <p className={styles.lede}>Cada historia empieza en un lugar del mapa.</p>
        </div>
        <button
          type="button"
          className={`btn-primary ${styles.newButton}`}
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? 'Creando…' : '+ Nueva aventura'}
        </button>
      </div>

      {status === 'loading' && <p className={styles.state}>Abriendo el diario…</p>}
      {status === 'error' && (
        <p className={`${styles.state} ${styles.stateError}`} role="alert">
          {error}
        </p>
      )}

      {status === 'ready' && cases.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyBook} aria-hidden="true">
            <span className={styles.emptyBookMark}>?</span>
          </span>
          <span className={styles.emptyTitle}>Tu diario de aventuras</span>
          <p className={styles.emptyBody}>
            Todavía no hay historias aquí. Crea la primera aventura para comenzar a
            explorar.
          </p>
          <button
            type="button"
            className={`btn-primary ${styles.emptyCta}`}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Creando…' : '+ Nueva aventura'}
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
              <li key={item.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.cardMain}
                  onClick={() => onOpen(item.id)}
                >
                  <span className={styles.cardNumber}>
                    ✦ Aventura #{item.id.slice(-4).toUpperCase()}
                  </span>
                  <span className={styles.cardName}>{item.alumno.nombre}</span>

                  <span className={styles.cardBar}>
                    <span className={styles.cardBarFill} style={{ width: `${percent}%` }} />
                  </span>

                  <span className={styles.cardStations}>
                    {total === 0
                      ? 'La aventura aún no empieza'
                      : `${done} de ${total} aventuras completadas`}
                  </span>

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
                  aria-label={`Eliminar la aventura de ${item.alumno.nombre}`}
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
        title={`¿Eliminar la aventura de ${pendingDelete?.alumno.nombre ?? ''}?`}
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
