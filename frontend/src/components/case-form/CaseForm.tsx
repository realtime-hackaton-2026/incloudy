/*
 * frontend/src/components/case-form/CaseForm.tsx // one case: the student
 * record (autosaved), the real five-station journey, the map that shows
 * where it stands, the AI summary, collaborators, and the live Portal room.
 * Complete then publish mirror the backend's own state machine — there is no
 * client-side notion of "done" independent of it.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../../lib/http'
import { CASE_STATUS_LABELS, useCase } from '../../cases'
import type { CollaboratorRole, Student } from '../../cases'
import { useJourneyTemplate } from '../../journeys'
import { CaseMap, toCaseStage } from '../case-map'
import type { Station } from '../case-map'
import { CaseRoom } from '../../portal'
import { CaseChat } from '../../chat'
import { ConfirmDialog } from '../confirm-dialog'
import { StationCard } from './JourneyStations'
import styles from './CaseForm.module.css'

export interface CaseFormProps {
  token: string
  caseId: string
  ownerId: string | null
  onDeleted: () => void
  onBack: () => void
}

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  editor: 'Editor',
  comentarista: 'Comentarista',
  lector: 'Lector',
}

export function CaseForm({ token, caseId, ownerId, onDeleted, onBack }: CaseFormProps) {
  const {
    item,
    loadStatus,
    loadError,
    saveStatus,
    saveError,
    setAlumno,
    answerStation,
    completeCase,
    publishCase,
    generateSummary,
    updateSummary,
    remove,
    inviteCollaborator,
    dropCollaborator,
  } = useCase(token, caseId)

  const {
    template,
    status: templateStatus,
    error: templateError,
  } = useJourneyTemplate(token, item?.templateId ?? null)

  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [collaboratorRole, setCollaboratorRole] = useState<CollaboratorRole>('comentarista')
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [pendingRemoveCollaborator, setPendingRemoveCollaborator] = useState<string | null>(null)

  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const [pendingDelete, setPendingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [summaryBusy, setSummaryBusy] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [pendingRegenerate, setPendingRegenerate] = useState(false)

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
  const isEditor =
    isOwner || current.colaboradores.some((c) => c.userId === ownerId && c.role === 'editor')
  const stage = toCaseStage(current.estadoInteractivo.estacionActual)
  const canComplete =
    isEditor &&
    current.progreso.porcentaje === 100 &&
    (current.status === 'borrador' || current.status === 'en_progreso')
  const canPublish = isOwner && current.status === 'completado'
  const showSummary =
    current.status === 'completado' ||
    current.status === 'publicado' ||
    current.resumenFinal.contenido.length > 0

  function updateStudent(patch: Partial<Student>) {
    setAlumno({ ...current.alumno, ...patch })
  }

  async function handleComplete() {
    setCompleting(true)
    setCompleteError(null)
    try {
      await completeCase()
    } catch (cause) {
      setCompleteError(
        cause instanceof ApiError ? cause.message : 'No se pudo completar el caso.',
      )
    } finally {
      setCompleting(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      await publishCase()
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
      await inviteCollaborator(collaboratorEmail.trim(), collaboratorRole)
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

  function startEditSummary() {
    setSummaryDraft(current.resumenFinal.contenido)
    setSummaryError(null)
    setEditingSummary(true)
  }

  async function handleSaveSummary() {
    setSummaryBusy(true)
    setSummaryError(null)
    try {
      await updateSummary(summaryDraft)
      setEditingSummary(false)
    } catch (cause) {
      setSummaryError(cause instanceof ApiError ? cause.message : 'No se pudo guardar el resumen.')
    } finally {
      setSummaryBusy(false)
    }
  }

  async function runRegenerate(overwriteManual: boolean) {
    setSummaryBusy(true)
    setSummaryError(null)
    try {
      await generateSummary(overwriteManual)
      setPendingRegenerate(false)
    } catch (cause) {
      setSummaryError(cause instanceof ApiError ? cause.message : 'No se pudo generar el resumen.')
    } finally {
      setSummaryBusy(false)
    }
  }

  function requestRegenerate() {
    // Nothing manual to lose — regenerate straight away instead of asking to
    // confirm a no-op warning.
    if (current.resumenFinal.editadoManualmente) {
      setPendingRegenerate(true)
    } else {
      void runRegenerate(false)
    }
  }

  // The map is the only place a station is answered — clicking a hotspot
  // opens that station's real form in the map's own popup, rather than a
  // separate list of cards repeating what the map already shows.
  function renderStationPanel(mapStation: Station) {
    if (!template) return null
    const templateStation = template.estaciones.find((entry) => entry.id === mapStation.stage)
    if (!templateStation) {
      return <p className={styles.state}>Esta estación no está en la plantilla activa.</p>
    }
    return (
      <StationCard
        station={templateStation}
        answer={current.respuestas.find((r) => r.estacionId === templateStation.id) ?? null}
        editable={isEditor}
        onAnswer={answerStation}
      />
    )
  }

  return (
    <div
      className={styles.wrapper}
      data-testid="case-form"
      data-state={saveStatus}
      data-case-status={current.status}
    >
      <button type="button" className={styles.back} onClick={onBack}>
        ← Tus casos
      </button>

      <header className={styles.header}>
        <h2 className={styles.heading}>{current.alumno.nombre || 'Alumno sin nombre'}</h2>
        <span className={styles.status}>{CASE_STATUS_LABELS[current.status]}</span>
        <span className={styles.saveState} aria-live="polite">
          {saveStatus === 'saving' && 'Guardando…'}
          {saveStatus === 'saved' && 'Guardado'}
          {saveStatus === 'error' && (saveError ?? 'No se pudo guardar')}
        </span>
      </header>

      <fieldset className={styles.section} disabled={!isEditor}>
        <legend className={styles.sectionTitle}>Alumno</legend>
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
          <h3 className={styles.sectionTitle}>Recorrido</h3>
          <span className={styles.percent}>{current.progreso.porcentaje}% completado</span>
        </div>

        <CaseMap stage={stage} renderStationPanel={template ? renderStationPanel : undefined} />

        {templateStatus === 'loading' && <p className={styles.state}>Cargando el recorrido…</p>}
        {templateStatus === 'error' && (
          <p className={`${styles.state} ${styles.stateError}`} role="alert">
            {templateError}
          </p>
        )}

        <dl className={styles.statsRow}>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Días restantes</dt>
            <dd className={styles.statValue}>{current.estadoInteractivo.diasRestantes}</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Confianza del equipo</dt>
            <dd className={styles.statValue}>{current.estadoInteractivo.confianzaEquipo}%</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>XP</dt>
            <dd className={styles.statValue}>{current.estadoInteractivo.xpTotal}</dd>
          </div>
        </dl>

        {canComplete && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleComplete}
            disabled={completing}
          >
            {completing ? 'Completando…' : 'Completar caso'}
          </button>
        )}
        {isEditor && !canComplete && current.progreso.porcentaje < 100 && (
          <p className={styles.state}>Completa todas las estaciones obligatorias para avanzar.</p>
        )}
        {completeError && (
          <p className={`${styles.state} ${styles.stateError}`} role="alert">
            {completeError}
          </p>
        )}
      </section>

      {showSummary && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Resumen final</h3>
          {editingSummary ? (
            <>
              <textarea
                className={styles.textarea}
                value={summaryDraft}
                onChange={(event) => setSummaryDraft(event.target.value)}
              />
              <div className={styles.summaryActions}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveSummary}
                  disabled={summaryBusy || summaryDraft.trim().length === 0}
                >
                  {summaryBusy ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingSummary(false)}
                  disabled={summaryBusy}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.summaryBody}>
                {current.resumenFinal.contenido || 'Todavía no hay un resumen para este caso.'}
              </p>
              {isEditor && (
                <div className={styles.summaryActions}>
                  <button type="button" className="btn-secondary" onClick={startEditSummary}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={requestRegenerate}
                    disabled={summaryBusy || current.progreso.porcentaje < 100}
                  >
                    {summaryBusy ? 'Generando…' : 'Regenerar con IA'}
                  </button>
                </div>
              )}
            </>
          )}
          {summaryError && (
            <p className={`${styles.state} ${styles.stateError}`} role="alert">
              {summaryError}
            </p>
          )}
        </section>
      )}

      {isOwner && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Colaboradores</h3>
          <ul className={styles.collaborators}>
            {current.colaboradores.map((collaborator) => (
              <li key={collaborator.userId} className={styles.collaborator}>
                <span>
                  {collaborator.userId} · {ROLE_LABELS[collaborator.role]}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingRemoveCollaborator(collaborator.userId)}
                >
                  Retirar
                </button>
              </li>
            ))}
            {current.colaboradores.length === 0 && (
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
            <select
              className={styles.input}
              value={collaboratorRole}
              disabled={invitePending}
              onChange={(event) => setCollaboratorRole(event.target.value as CollaboratorRole)}
            >
              <option value="comentarista">Comentarista</option>
              <option value="editor">Editor</option>
              <option value="lector">Lector</option>
            </select>
            <button type="submit" className="btn-secondary" disabled={invitePending}>
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

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Conversaciones</h3>
        <p className={styles.state}>
          La sala es del equipo — todos los colaboradores la ven. El asistente es privado.
        </p>
        <CaseRoom token={token} caseId={caseId} />
        <CaseChat token={token} caseId={caseId} />
      </section>

      {isOwner && (
        <div className={styles.footer}>
          <button
            type="button"
            className={`btn-secondary ${styles.deleteButton}`}
            onClick={() => setPendingDelete(true)}
          >
            Eliminar caso
          </button>
          {canPublish && (
            <button
              type="button"
              className={`btn-primary ${styles.publishButton}`}
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
      <ConfirmDialog
        open={pendingRegenerate}
        title="¿Regenerar el resumen con IA?"
        description="Este resumen fue editado a mano — regenerarlo lo reemplaza."
        confirmLabel="Regenerar"
        tone="danger"
        pending={summaryBusy}
        onConfirm={() => runRegenerate(true)}
        onCancel={() => setPendingRegenerate(false)}
      />
    </div>
  )
}
