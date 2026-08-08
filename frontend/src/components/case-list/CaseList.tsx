/**
 * Every case the signed-in teacher owns or was invited into.
 *
 * Presentational except for what it triggers through `useCases` — create,
 * open, delete. A case's own stage/estaciones editing lives in CaseForm.
 */

import { useState } from 'react'
import { useCases } from '../../cases'
import type { Case } from '../../cases'
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
      <div className={styles.toolbar}>
        <h2 className={styles.heading}>Tus casos</h2>
        <button
          type="button"
          className={styles.newButton}
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
        <p className={styles.state}>Todavía no hay casos. Crea el primero.</p>
      )}

      <ul className={styles.list}>
        {cases.map((item) => (
          <li key={item.id} className={styles.card}>
            <button type="button" className={styles.cardMain} onClick={() => onOpen(item.id)}>
              <span className={styles.cardName}>{item.alumno.nombre}</span>
              <span className={styles.cardMeta}>
                {item.status === 'publicado' ? 'Publicado' : 'Borrador'} ·{' '}
                {percentComplete(item)}% completado
                {ownerId && item.profesorId !== ownerId ? ' · Compartido contigo' : ''}
              </span>
            </button>
            <button
              type="button"
              className={styles.cardDelete}
              onClick={() => setPendingDelete(item)}
              aria-label={`Eliminar el caso de ${item.alumno.nombre}`}
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

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

function percentComplete(item: Case): number {
  if (item.estaciones.length === 0) return 0
  const done = item.estaciones.filter((station) => station.completado).length
  return Math.round((done / item.estaciones.length) * 100)
}
