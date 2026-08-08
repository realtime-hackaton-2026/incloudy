/**
 * Casos: the map, and the stories living on it.
 *
 * The map is the hero rather than one card among many, and hovering a case
 * lights its location — and vice versa — so the list and the world read as
 * one thing instead of two panels that happen to share a page.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { CASE_STATUS_LABELS, joinCase, useCases } from '../../cases'
import { AvatarPicker, DEFAULT_AVATAR_ID, saveAvatarId } from '../../avatar'
import { ApiError } from '../../lib/http'
import type { Case } from '../../cases'
import { STATIONS, toCaseStage } from '../case-map'
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
  const [createOpen, setCreateOpen] = useState(false)
  const [newStudent, setNewStudent] = useState({ nombre: '', edad: '', curso: '', descripcion: '' })
  const [newAvatarId, setNewAvatarId] = useState(DEFAULT_AVATAR_ID)
  const [pendingDelete, setPendingDelete] = useState<Case | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) return
    setJoining(true)
    setJoinError(null)
    try {
      const joined = await joinCase(token, code)
      onOpen(joined.id)
    } catch (cause) {
      setJoinError(cause instanceof ApiError ? cause.message : 'No se pudo entrar en la sala.')
    } finally {
      setJoining(false)
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newStudent.nombre.trim() || !newStudent.descripcion.trim()) return
    setCreating(true)
    try {
      const created = await create({
        alumno: {
          nombre: newStudent.nombre.trim(),
          edad: newStudent.edad ? Number(newStudent.edad) : null,
          curso: newStudent.curso.trim() || null,
          descripcion: newStudent.descripcion.trim(),
        },
      })
      saveAvatarId(created.id, newAvatarId)
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
    <div
      className={styles.wrapper}
      data-testid="case-list"
      data-state={status === 'ready' ? (cases.length === 0 ? 'empty' : 'populated') : status}
      data-case-count={cases.length}
    >
      <div className={styles.intro}>
        <div className={styles.introText}>
          <span className="eyebrow">Tu diario de aventuras</span>
          <p className={styles.lede}>Cada historia empieza en un lugar del mapa.</p>
        </div>
        <div className={styles.introActions}>
          <button type="button" className="btn-secondary" onClick={() => setJoinOpen((open) => !open)}>
            {joinOpen ? 'Cancelar' : 'Unirse con código'}
          </button>
          <button
            type="button"
            className={`btn-primary ${styles.newButton}`}
            onClick={() => setCreateOpen((open) => !open)}
            disabled={creating}
          >
            {createOpen ? 'Cancelar' : '+ Nueva aventura'}
          </button>
        </div>
      </div>

      {createOpen && (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <div className={styles.createHeading}>
            <div>
              <span className="eyebrow">Nueva aventura</span>
              <h2>Prepara el caso antes de empezar</h2>
            </div>
            <p>Escribe toda la información; se enviará únicamente al pulsar “Empezar caso”.</p>
          </div>

          <div className={styles.createFields}>
            <label>
              Nombre del alumno
              <input
                value={newStudent.nombre}
                onChange={(event) => setNewStudent((current) => ({ ...current, nombre: event.target.value }))}
                autoFocus
                required
              />
            </label>
            <label>
              Edad
              <input
                type="number"
                min={1}
                max={120}
                value={newStudent.edad}
                onChange={(event) => setNewStudent((current) => ({ ...current, edad: event.target.value }))}
              />
            </label>
            <label>
              Curso
              <input
                value={newStudent.curso}
                onChange={(event) => setNewStudent((current) => ({ ...current, curso: event.target.value }))}
              />
            </label>
            <label className={styles.createDescription}>
              Descripción del caso
              <textarea
                value={newStudent.descripcion}
                onChange={(event) => setNewStudent((current) => ({ ...current, descripcion: event.target.value }))}
                required
                rows={5}
              />
            </label>
          </div>

          <AvatarPicker avatarId={newAvatarId} onSelect={setNewAvatarId} />

          <div className={styles.createActions}>
            <span>{newStudent.descripcion.trim().length} caracteres</span>
            <button
              type="submit"
              className="btn-primary"
              disabled={creating || !newStudent.nombre.trim() || !newStudent.descripcion.trim()}
            >
              {creating ? 'Empezando…' : 'Empezar caso →'}
            </button>
          </div>
        </form>
      )}

      {joinOpen && (
        <form className={styles.joinForm} onSubmit={handleJoin}>
          <div>
            <strong>Entrar en una sala docente</strong>
            <span>Pide al propietario el código de seis caracteres.</span>
          </div>
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase())}
            placeholder="ABC123"
            aria-label="Código de la sala"
            autoComplete="off"
            maxLength={6}
          />
          <button type="submit" className="btn-primary" disabled={joining || joinCode.length !== 6}>
            {joining ? 'Entrando…' : 'Entrar'}
          </button>
          {joinError && <p className={styles.joinError} role="alert">{joinError}</p>}
        </form>
      )}

      {status === 'loading' && <p className={styles.state}>Abriendo el diario…</p>}
      {status === 'error' && (
        <p className={`${styles.state} ${styles.stateError}`} role="alert">
          {error}
        </p>
      )}

      {status === 'ready' && cases.length === 0 && !createOpen && (
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
            onClick={() => setCreateOpen(true)}
            disabled={creating}
          >
            + Nueva aventura
          </button>
        </div>
      )}

      {cases.length > 0 && (
        <ul className={styles.list}>
          {cases.map((item) => {
            const { completadas: done, total } = item.progreso
            const percent = item.progreso.porcentaje
            const station = STATIONS.find(
              (entry) => entry.stage === toCaseStage(item.estadoInteractivo.estacionActual),
            )
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
                    {shared ? 'Compartido contigo' : CASE_STATUS_LABELS[item.status]}
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
