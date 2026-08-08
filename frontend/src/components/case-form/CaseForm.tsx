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
import { CaseMap, stationIndex, toCaseStage } from '../case-map'
import type { Station } from '../case-map'
import { CaseChat } from '../../chat'
import { AvatarPicker, useAvatar } from '../../avatar'
import { OwlSays, OwlTip, journeyProgress, lockedStation } from '../../guide'
import type { Guidance } from '../../guide'
import { OwlDoor } from '../../owl'
import { XpCounter } from '../../reward'
import { ConfirmDialog } from '../confirm-dialog'
import { StationCard } from './JourneyStations'
import styles from './CaseForm.module.css'

export interface CaseFormProps {
  token: string
  caseId: string
  ownerId: string | null
  onDeleted: () => void
  onBack: () => void
  /** Render only the interactive journey map. Used by the world/map route. */
  mapOnly?: boolean
}

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  editor: 'Editor',
  comentarista: 'Comentarista',
  lector: 'Lector',
}

export function CaseForm({ token, caseId, ownerId, onDeleted, onBack, mapOnly = false }: CaseFormProps) {
  const {
    item,
    loadStatus,
    loadError,
    saveStatus,
    saveError,
    setAlumno,
    answerStation,
    answerUnexpectedEvent,
    setForixShared,
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

  const { avatarId, setAvatarId } = useAvatar()

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
  const [sharingWithForix, setSharingWithForix] = useState(false)
  const [forixShareError, setForixShareError] = useState<string | null>(null)
  // A locked tap is the loudest thing the owl has to say, so it outranks the
  // standing "how far is left" message until it expires.
  const [lockedNotice, setLockedNotice] = useState<Guidance | null>(null)

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
  /*
   * What the owl is saying right now. Derived, never stored: a locked tap
   * takes precedence while it lives, and otherwise the owl reports how much
   * of the recorrido is left — straight off the server's own progress.
   */
  const stationsLeft = Math.max(
    0,
    current.progreso.total - current.progreso.completadas,
  )
  const guidance: Guidance | null = lockedNotice ?? journeyProgress(stationsLeft)

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

  async function handleUnexpectedEvent(eventId: string, optionId: string) {
    await answerUnexpectedEvent(eventId, optionId)
  }

  function personalizeCaseText(value: string) {
    return value.replace(/\bAlex\b/g, current.alumno.nombre || 'el alumno')
  }

  async function handleForixShare() {
    setSharingWithForix(true)
    setForixShareError(null)
    try {
      await setForixShared(!current.forixShared)
    } catch (cause) {
      setForixShareError(cause instanceof ApiError ? cause.message : 'No se pudo actualizar Forix.')
    } finally {
      setSharingWithForix(false)
    }
  }

  function renderUnexpectedEvents() {
    if (!template) return null
    const events = (template.contenido?.imprevistos as Array<{
      id: string
      estacion_id: string
      icono?: string
      texto: string
      opciones: Array<{ id: string; texto: string; coste_dias?: number; confianza?: number }>
    }> | undefined) ?? []
    const activeEvents = events.filter((event) => {
      if (event.estacion_id !== stage) return false
      return !current.estadoInteractivo.imprevistosResueltos.some((item) => item.startsWith(`${event.id}:`))
    })
    if (!activeEvents.length) return null

    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Imprevisto</h3>
        {activeEvents.map((event) => (
          <article key={event.id} className={styles.interactionCard}>
            <p className={styles.stationIntro}>
              {event.icono} {personalizeCaseText(event.texto)}
            </p>
            <div className={styles.stationOptions}>
              {event.opciones.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="btn-secondary"
                  onClick={() => void handleUnexpectedEvent(event.id, option.id)}
                  disabled={!isEditor}
                >
                  {option.texto}
                  <small>
                    {option.coste_dias ? ` · −${option.coste_dias} día` : ''}
                    {typeof option.confianza === 'number' ? ` · ${option.confianza > 0 ? '+' : ''}${option.confianza} confianza` : ''}
                  </small>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    )
  }

  // The map is the only place a station is answered — clicking a hotspot
  // opens that station's real form in the map's own popup, rather than a
  // separate list of cards repeating what the map already shows.
  function renderStationPanel(mapStation: Station, close: () => void) {
    if (!template) return null
    const templateStation = template.estaciones.find((entry) => entry.id === mapStation.stage)
    if (!templateStation) {
      return <p className={styles.state}>Esta estación no está en la plantilla activa.</p>
    }
    if (stationIndex(mapStation.stage) > stationIndex(stage)) {
      const currentStation = template.estaciones.find((entry) => entry.id === stage)
      return (
        <div className={styles.interactionCard}>
          <strong>🔒 Estación bloqueada</strong>
          <p>Completa primero {currentStation?.titulo ?? 'la estación actual'} para abrir {templateStation.titulo}.</p>
        </div>
      )
    }
    return (
      <StationCard
        station={templateStation}
        student={current.alumno}
        answer={current.respuestas.find((r) => r.estacionId === templateStation.id) ?? null}
        editable={isEditor}
        onAnswer={answerStation}
        onContinue={close}
        onFinish={completeCase}
      />
    )
  }

  if (mapOnly) {
    return (
      <div className={styles.mapOnly} data-testid="case-map-only">
        <div className={styles.mapOnlyHeader}>
          <div>
            <span className={styles.mapOnlyKicker}>Caso en estudio</span>
            <strong>{current.alumno.nombre || 'Alumno sin nombre'}</strong>
          </div>
          <div className={styles.mapOnlyStats}>
            <span>⏳ {current.estadoInteractivo.diasRestantes} días</span>
            <span>🤝 {current.estadoInteractivo.confianzaEquipo}%</span>
            {/* Answering a station returns a new total; the counter turns that
                into a gain the child can see arrive. */}
            <XpCounter value={current.estadoInteractivo.xpTotal} />
          </div>
        </div>
        <AvatarPicker avatarId={avatarId} onSelect={setAvatarId} />
        <OwlTip tipId="map-guide" />
        {/* The owl in the moment: it answers a locked tap, and otherwise says
            how much of the recorrido is left. Both are read off state that
            already exists — it never decides anything itself. */}
        <OwlSays guidance={guidance} />
        {/* On its own route the map is the game, so it escapes the shell's
            reading width. Inside a case it stays one section among many. */}
        <CaseMap
          stage={stage}
          wide
          completedStages={current.respuestas.filter((answer) => answer.completado).map((answer) => answer.estacionId as Station['stage'])}
          onLockedAttempt={(blocked, mustFinishFirst) =>
            setLockedNotice(lockedStation(blocked.label, mustFinishFirst?.label ?? null))
          }
          renderStationPanel={template ? renderStationPanel : undefined}
        />
        <OwlDoor token={token} caseId={caseId} joinCode={current.joinCode} stage={stage} />
        {templateStatus === 'loading' && <p className={styles.state}>Cargando el recorrido…</p>}
        {templateStatus === 'error' && (
          <p className={`${styles.state} ${styles.stateError}`} role="alert">
            {templateError}
          </p>
        )}
        {completeError && (
          <p className={`${styles.state} ${styles.stateError}`} role="alert">{completeError}</p>
        )}
      </div>
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

      {isOwner && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Forix · colaboración docente</h3>
          <p className={styles.state}>
            {current.forixShared
              ? `Este caso aparece en Forix. Comparte el código ${current.joinCode} para que otros docentes entren.`
              : 'Este caso permanece privado y no aparece en el selector de Forix.'}
          </p>
          <button
            type="button"
            className={current.forixShared ? 'btn-secondary' : 'btn-primary'}
            disabled={sharingWithForix}
            onClick={() => void handleForixShare()}
          >
            {sharingWithForix
              ? 'Actualizando…'
              : current.forixShared
                ? 'Dejar de compartir con Forix'
                : 'Compartir este caso con Forix'}
          </button>
          {forixShareError && <p className={`${styles.state} ${styles.stateError}`} role="alert">{forixShareError}</p>}
        </section>
      )}

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

        <AvatarPicker avatarId={avatarId} onSelect={setAvatarId} />

        <OwlTip tipId="map-guide" />

        <CaseMap
          stage={stage}
          completedStages={current.respuestas.filter((answer) => answer.completado).map((answer) => answer.estacionId as Station['stage'])}
          renderStationPanel={template ? renderStationPanel : undefined}
        />

        {renderUnexpectedEvents()}

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
          La conversación privada del caso está disponible desde el búho del mapa. El asistente sigue siendo privado.
        </p>
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
