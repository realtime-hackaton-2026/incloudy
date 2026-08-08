/**
 * Edit a single case: the student record and its checklist of stations.
 *
 * Every field edit autosaves after a short pause (see `useCase`); publishing,
 * deleting and removing a collaborator all go through a confirmation, since
 * none of them can be undone from here.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCase } from '../../cases'
import type { StationRecord, Student } from '../../cases'
import { ConfirmDialog } from '../confirm-dialog'
import styles from './CaseForm.module.css'

export interface CaseFormProps {
  token: string
  caseId: string
  ownerId: string | null
  onDeleted: () => void
  onBack: () => void
}

export function CaseForm({ token, caseId, ownerId, onDeleted, onBack }: CaseFormProps) {
  const {
    item,
    loadStatus,
    loadError,
    saveStatus,
    saveError,
    setAlumno,
    setEstaciones,
    publish,
    remove,
    inviteCollaborator,
    dropCollaborator,
  } = useCase(token, caseId)

  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [pendingRemoveCollaborator, setPendingRemoveCollaborator] = useState<string | null>(null)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (loadStatus === 'loading') return <p className={styles.state}>Cargando caso…</p>

  if (loadStatus === 'error' || !item) {
    return (
      <div>
        <p className={`${styles.state} ${styles.stateError}`} role="alert">
          {loadError}
        </p>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Volver a tus casos
        </button>
      </div>
    )
  }

  // Narrowed once, here, so every handler below can reference `current`
  // instead of asserting `item!` is non-null everywhere it's used.
  const current = item
  const isOwner = ownerId !== null && current.profesorId === ownerId
  const percent = current.estaciones.length
    ? Math.round(
        (current.estaciones.filter((station) => station.completado).length /
          current.estaciones.length) *
          100,
      )
    : 0

  function updateStudent(patch: Partial<Student>) {
    setAlumno({ ...current.alumno, ...patch })
  }

  function addStation() {
    const next: StationRecord = {
      orden: current.estaciones.length + 1,
      titulo: '',
      descripcion: '',
      completado: false,
    }
    setEstaciones([...current.estaciones, next])
  }

  function updateStation(index: number, patch: Partial<StationRecord>) {
    setEstaciones(
      current.estaciones.map((station, i) => (i === index ? { ...station, ...patch } : station)),
    )
  }

  function removeStation(index: number) {
    setEstaciones(
      current.estaciones
        .filter((_, i) => i !== index)
        .map((station, i) => ({ ...station, orden: i + 1 })),
    )
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      await publish()
      setPendingPublish(false)
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await remove()
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCollaboratorError(null)
    setInvitePending(true)
    try {
      await inviteCollaborator(collaboratorEmail.trim())
      setCollaboratorEmail('')
    } catch (cause) {
      setCollaboratorError(cause instanceof Error ? cause.message : 'No se pudo invitar.')
    } finally {
      setInvitePending(false)
    }
  }

  async function handleRemoveCollaborator() {
    if (!pendingRemoveCollaborator) return
    await dropCollaborator(pendingRemoveCollaborator)
    setPendingRemoveCollaborator(null)
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.back} onClick={onBack}>
        ← Tus casos
      </button>

      <header className={styles.header}>
        <h2 className={styles.heading}>{current.alumno.nombre || 'Alumno sin nombre'}</h2>
        <span className={styles.status}>
          {current.status === 'publicado' ? 'Publicado' : 'Borrador'}
        </span>
        <span className={styles.saveState} aria-live="polite">
          {saveStatus === 'saving' && 'Guardando…'}
          {saveStatus === 'saved' && 'Guardado'}
          {saveStatus === 'error' && (saveError ?? 'No se pudo guardar')}
        </span>
      </header>

      <fieldset className={styles.section} disabled={!isOwner}>
        <legend className={styles.sectionTitle}>Alumno ficticio</legend>
        <label className={styles.field}>
          Nombre
          <input
            className={styles.input}
            value={current.alumno.nombre}
            onChange={(event) => updateStudent({ nombre: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          Edad
          <input
            className={styles.input}
            type="number"
            min={1}
            max={120}
            value={current.alumno.edad ?? ''}
            onChange={(event) =>
              updateStudent({ edad: event.target.value ? Number(event.target.value) : null })
            }
          />
        </label>
        <label className={styles.field}>
          Curso
          <input
            className={styles.input}
            value={current.alumno.curso ?? ''}
            onChange={(event) => updateStudent({ curso: event.target.value || null })}
          />
        </label>
        <label className={styles.field}>
          Descripción
          <textarea
            className={styles.textarea}
            value={current.alumno.descripcion}
            onChange={(event) => updateStudent({ descripcion: event.target.value })}
          />
        </label>
      </fieldset>

      <section className={styles.section}>
        <div className={styles.progressHeader}>
          <h3 className={styles.sectionTitle}>Estaciones</h3>
          <span className={styles.percent}>{percent}% completado</span>
        </div>
        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={styles.progressFill} style={{ width: `${percent}%` }} />
        </div>

        <ul className={styles.stations}>
          {current.estaciones.map((station, index) => (
            <li key={index} className={styles.station}>
              <input
                type="checkbox"
                checked={station.completado}
                disabled={!isOwner}
                onChange={(event) => updateStation(index, { completado: event.target.checked })}
                aria-label={`Marcar "${station.titulo || 'estación sin título'}" como completada`}
              />
              <input
                className={styles.stationTitle}
                value={station.titulo}
                disabled={!isOwner}
                placeholder="Título de la estación"
                onChange={(event) => updateStation(index, { titulo: event.target.value })}
              />
              {isOwner && (
                <button
                  type="button"
                  className={styles.stationRemove}
                  onClick={() => removeStation(index)}
                  aria-label="Quitar estación"
                >
                  ×
                </button>
              )}
            </li>
          ))}
          {current.estaciones.length === 0 && (
            <li className={styles.state}>Todavía no hay estaciones en este caso.</li>
          )}
        </ul>

        {isOwner && (
          <button type="button" className={styles.addStation} onClick={addStation}>
            + Agregar estación
          </button>
        )}
      </section>

      {isOwner && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Colaboradores</h3>
          <ul className={styles.collaborators}>
            {current.colaboradoresIds.map((id) => (
              <li key={id} className={styles.collaborator}>
                <span>{id}</span>
                <button type="button" onClick={() => setPendingRemoveCollaborator(id)}>
                  Retirar
                </button>
              </li>
            ))}
            {current.colaboradoresIds.length === 0 && (
              <li className={styles.state}>Nadie más tiene acceso todavía.</li>
            )}
          </ul>
          <form className={styles.inviteForm} onSubmit={handleInvite}>
            <input
              className={styles.input}
              type="email"
              placeholder="correo@ejemplo.com"
              value={collaboratorEmail}
              disabled={invitePending}
              onChange={(event) => setCollaboratorEmail(event.target.value)}
              required
            />
            <button type="submit" disabled={invitePending}>
              {invitePending ? 'Invitando…' : 'Invitar'}
            </button>
          </form>
          {collaboratorError && (
            <p className={`${styles.state} ${styles.stateError}`} role="alert">
              {collaboratorError}
            </p>
          )}
        </section>
      )}

      {isOwner && (
        <div className={styles.footer}>
          <button type="button" className={styles.deleteButton} onClick={() => setPendingDelete(true)}>
            Eliminar caso
          </button>
          {current.status !== 'publicado' && (
            <button
              type="button"
              className={styles.publishButton}
              onClick={() => setPendingPublish(true)}
            >
              Publicar caso
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingPublish}
        title="¿Publicar este caso?"
        description="Una vez publicado, deja de tratarse como borrador."
        confirmLabel="Publicar"
        pending={publishing}
        onConfirm={handlePublish}
        onCancel={() => setPendingPublish(false)}
      />
      <ConfirmDialog
        open={pendingDelete}
        title="¿Eliminar este caso?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        tone="danger"
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(false)}
      />
      <ConfirmDialog
        open={pendingRemoveCollaborator !== null}
        title="¿Retirar a este colaborador?"
        confirmLabel="Retirar"
        tone="danger"
        onConfirm={handleRemoveCollaborator}
        onCancel={() => setPendingRemoveCollaborator(null)}
      />
    </div>
  )
}
