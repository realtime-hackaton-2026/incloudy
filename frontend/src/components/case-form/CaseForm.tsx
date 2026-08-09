/*
 * frontend/src/components/case-form/CaseForm.tsx // one case: the student
 * record (autosaved), the real five-station journey, the map that shows
 * where it stands, the AI summary, collaborators, and the live Portal room.
 * Complete then publish mirror the backend's own state machine — there is no
 * client-side notion of "done" independent of it.
 */

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../../lib/http'
import { CASE_STATUS_LABELS, listCaseParticipants, useCase } from '../../cases'
import type { CaseParticipant, CollaboratorRole, Student } from '../../cases'
import { useJourneyTemplate } from '../../journeys'
import { CaseMap, STATIONS, stationIndex, toCaseStage } from '../case-map'
import type { Station } from '../case-map'
import { CaseChat } from '../../chat'
import { DebateRoom } from '../../debate'
import { AvatarPicker, useAvatar } from '../../avatar'
import { OwlSays, OwlTip, journeyProgress, lockedStation } from '../../guide'
import type { Guidance } from '../../guide'
import { XpCounter } from '../../reward'
import { ConfirmDialog } from '../confirm-dialog'
import { CodeChip } from '../room-code'
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
  onAvatarChange?: () => void
}

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  editor: 'Editor',
  comentarista: 'Comentarista',
  lector: 'Lector',
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function addBusinessDays(start: Date, amount: number): Date {
  const deadline = new Date(start)
  let added = 0
  while (added < amount) {
    deadline.setDate(deadline.getDate() + 1)
    if (isBusinessDay(deadline)) added += 1
  }
  return deadline
}

function businessDaysRemaining(now: Date, deadline: Date): number {
  const cursor = new Date(now)
  const end = new Date(deadline)
  cursor.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (cursor >= end) return 0
  let remaining = 0
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1)
    if (isBusinessDay(cursor)) remaining += 1
  }
  return remaining
}

export function CaseForm({ token, caseId, ownerId, onDeleted, onBack, mapOnly = false, onAvatarChange }: CaseFormProps) {
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const {
    item,
    loadStatus,
    loadError,
    saveStatus,
    saveError,
    setAlumno,
    answerStation,
    answerUnexpectedEvent,
    setBurixShared,
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

  const { avatar, avatarId, setAvatarId } = useAvatar(caseId)
  const selectAvatar = (id: string) => {
    setAvatarId(id)
    onAvatarChange?.()
  }

  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [collaboratorRole, setCollaboratorRole] = useState<CollaboratorRole>('comentarista')
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [pendingRemoveCollaborator, setPendingRemoveCollaborator] = useState<string | null>(null)
  const [caseParticipants, setCaseParticipants] = useState<CaseParticipant[]>([])

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
  const [sharingWithBurix, setSharingWithBurix] = useState(false)
  const [burixShareError, setBurixShareError] = useState<string | null>(null)
  // A locked tap is the loudest thing the owl has to say, so it outranks the
  // standing "how far is left" message until it expires.
  const [lockedNotice, setLockedNotice] = useState<Guidance | null>(null)

  useEffect(() => {
    if (!mapOnly) return
    const timer = setInterval(() => setCurrentTime(Date.now()), 60 * 60 * 1000)
    return () => clearInterval(timer)
  }, [mapOnly])

  useEffect(() => {
    let active = true
    const refresh = () => {
      void listCaseParticipants(token, caseId)
        .then((participants) => {
          if (active) setCaseParticipants(participants)
        })
        .catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 5_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [caseId, token])

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
  const participantById = new Map(caseParticipants.map((participant) => [participant.userId, participant]))
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
  const journeyTotal = current.progreso.total || 5
  const journeyCompleted = Math.min(current.progreso.completadas, journeyTotal)
  const journeyLife = Math.round((journeyCompleted / journeyTotal) * 100)
  const createdAt = new Date(current.createdAt)
  const deadline = addBusinessDays(createdAt, 5)
  const deadlineDays = businessDaysRemaining(new Date(currentTime), deadline)
  const journeyFinished = journeyCompleted >= journeyTotal
  const shortDate = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

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

  async function handleBurixShare() {
    setSharingWithBurix(true)
    setBurixShareError(null)
    try {
      await setBurixShared(!current.burixShared)
    } catch (cause) {
      setBurixShareError(cause instanceof ApiError ? cause.message : 'No se pudo actualizar Búrix.')
    } finally {
      setSharingWithBurix(false)
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
  function renderStationPanel(
    mapStation: Station,
    close: () => void,
    goTo: (stage: Station['stage']) => void,
  ) {
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
        // A fresh form per station: advancing along the map must not carry
        // the previous mission's half-chosen options into the next one.
        key={mapStation.stage}
        station={templateStation}
        student={current.alumno}
        answer={current.respuestas.find((r) => r.estacionId === templateStation.id) ?? null}
        editable={isEditor}
        onAnswer={answerStation}
        headerActionTargetId={`mission-actions-${mapStation.stage}`}
        onContinue={() => {
          // The quest chain: completing a mission hands straight over to the
          // next station on the map instead of dropping back to the canvas.
          const next = STATIONS[stationIndex(mapStation.stage) + 1]
          if (next && stationIndex(next.stage) <= stationIndex(stage)) goTo(next.stage)
          else close()
        }}
        onFinish={completeCase}
      />
    )
  }

  if (mapOnly) {
    return (
      <div className={styles.mapOnly} data-testid="case-map-only" data-tour="map">
        <div className={styles.mapOnlyHeader} data-tour="map-case-study">
          <div className={styles.mapOnlyIdentity}>
            <span className={styles.mapOnlyKicker}>Caso en estudio</span>
            <strong>{current.alumno.nombre || 'Alumno sin nombre'}</strong>
            <span className={styles.caseCreated}>
              Caso creado {shortDate.format(createdAt)} · límite hábil {shortDate.format(deadline)}
            </span>
          </div>
          <div className={styles.mapOnlyStats}>
            <span className={`${styles.caseMetric} ${journeyFinished ? styles.caseMetricComplete : ''}`}>
              <b>{journeyFinished ? '✓' : '⏳'}</b>
              <span><small>Plazo hábil</small>{journeyFinished ? 'Finalizado' : deadlineDays === 0 ? 'Vence hoy' : `${deadlineDays} días`}</span>
            </span>
            <span className={styles.caseMetric}>
              <b>◆</b>
              <span><small>Estaciones</small>{journeyCompleted}/{journeyTotal}</span>
            </span>
            <span className={styles.caseMetric}>
              <b>♥</b>
              <span><small>Vida</small>{journeyLife}%</span>
            </span>
            <span className={styles.caseMetric}>
              <b>🤝</b>
              <span><small>Confianza</small>{current.estadoInteractivo.confianzaEquipo}%</span>
            </span>
            {/* Answering a station returns a new total; the counter turns that
                into a gain the child can see arrive. */}
            <span className={styles.caseMetric}>
              <XpCounter value={current.estadoInteractivo.xpTotal} />
            </span>
          </div>
        </div>
        <OwlTip tipId="map-guide" />
        {/* The owl in the moment: it answers a locked tap, and otherwise says
            how much of the recorrido is left. Both are read off state that
            already exists — it never decides anything itself. */}
        <OwlSays guidance={guidance} />
        {/* On its own route the map is the game, so it escapes the shell's
            reading width. Inside a case it stays one section among many. */}
        <div data-tour="journey">
          <CaseMap
            stage={stage}
            wide
            completedStages={current.respuestas.filter((answer) => answer.completado).map((answer) => answer.estacionId as Station['stage'])}
            markerAvatar={avatar}
            onLockedAttempt={(blocked, mustFinishFirst) =>
              setLockedNotice(lockedStation(blocked.label, mustFinishFirst?.label ?? null))
            }
            renderStationPanel={template ? renderStationPanel : undefined}
          />
        </div>
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

      {/* The child comes before the sharing controls: this screen is about
          them, and the identity strip says who at a glance so the fields
          below read as details rather than a form to fill from scratch. */}
      <fieldset className={`${styles.section} ${styles.studentCard}`} data-tour="student" disabled={!isEditor}>
        <legend className={styles.sectionTitle}>Alumno</legend>

        <div className={styles.studentIdentity}>
          <img className={styles.studentAvatar} src={avatar.src} alt="" />
          <div className={styles.studentSummary}>
            <strong>{current.alumno.nombre || 'Alumno sin nombre'}</strong>
            <span>
              {[
                current.alumno.edad ? `${current.alumno.edad} años` : null,
                current.alumno.curso || null,
              ].filter(Boolean).join(' · ') || 'Sin edad ni curso todavía'}
            </span>
          </div>
        </div>

        {/* Edad and curso are short values; giving each a full row was the
            main reason this card scrolled. */}
        <div className={styles.studentGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
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
          <label className={`${styles.field} ${styles.fieldWide}`}>
            Descripción
            <textarea
              className={styles.textarea}
              value={current.alumno.descripcion}
              onChange={(event) => updateStudent({ descripcion: event.target.value })}
            />
          </label>
        </div>
      </fieldset>

      {isOwner && (
        <section className={`${styles.section} ${styles.shareCard}`} data-tour="share">
          <div className={styles.shareHead}>
            <h3 className={styles.sectionTitle}>Búrix · colaboración docente</h3>
            <span className={current.burixShared ? styles.shareOn : styles.shareOff}>
              {current.burixShared ? 'Compartido' : 'Privado'}
            </span>
          </div>

          <p className={styles.state}>
            {current.burixShared
              ? 'Este caso aparece en Búrix. Quien tenga el código puede entrar en la sala.'
              : 'Este caso permanece privado y no aparece en el selector de Búrix.'}
          </p>

          {/* The code is the thing a teacher actually needs to hand over, so
              it gets its own control instead of sitting inside a sentence. */}
          <div className={styles.shareActions}>
            {current.burixShared && <CodeChip code={current.joinCode} />}
            <button
              type="button"
              className={current.burixShared ? 'btn-secondary' : 'btn-primary'}
              disabled={sharingWithBurix}
              onClick={() => void handleBurixShare()}
            >
              {sharingWithBurix
                ? 'Actualizando…'
                : current.burixShared
                  ? 'Dejar de compartir'
                  : 'Compartir con Búrix'}
            </button>
          </div>

          {burixShareError && <p className={`${styles.state} ${styles.stateError}`} role="alert">{burixShareError}</p>}
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.progressHeader}>
          <h3 className={styles.sectionTitle}>Recorrido</h3>
          <span className={styles.percent}>{current.progreso.porcentaje}% completado</span>
        </div>

        <AvatarPicker avatarId={avatarId} onSelect={selectAvatar} />

        <OwlTip tipId="map-guide" />

        {/* Wrapped rather than given the attribute directly: CaseMap does not
            forward unknown props, so it would never reach the DOM. */}
        <div data-tour="journey">
          <CaseMap
            stage={stage}
            completedStages={current.respuestas.filter((answer) => answer.completado).map((answer) => answer.estacionId as Station['stage'])}
            markerAvatar={avatar}
            renderStationPanel={template ? renderStationPanel : undefined}
          />
        </div>

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
            {completing ? 'Concluyendo…' : 'Concluir caso'}
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
        <section className={styles.section} data-tour="summary">
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
        <section className={styles.section} data-tour="collaborators">
          <h3 className={styles.sectionTitle}>Colaboradores</h3>
          <ul className={styles.collaborators}>
            <li className={`${styles.collaborator} ${styles.caseOwner}`}>
              <div className={styles.collaboratorIdentity}>
                <strong>Docente · {participantById.get(current.profesorId)?.nombre ?? 'Propietario'}</strong>
                <span>{participantById.get(current.profesorId)?.email ?? 'Correo no disponible'}</span>
                <small>Creó este caso · Propietario</small>
              </div>
            </li>
            {current.colaboradores.map((collaborator) => (
              <li key={collaborator.userId} className={styles.collaborator}>
                <div className={styles.collaboratorIdentity}>
                  <strong>Docente · {participantById.get(collaborator.userId)?.nombre ?? 'Sin nombre'}</strong>
                  <span>{participantById.get(collaborator.userId)?.email ?? 'Correo no disponible'}</span>
                  <small>Rol · {ROLE_LABELS[collaborator.role]}</small>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingRemoveCollaborator(collaborator.userId)}
                >
                  Retirar
                </button>
              </li>
            ))}
          </ul>
          <form className={styles.inviteForm} onSubmit={handleInvite}>
            <input
              className={styles.input}
              type="email"
              // The placeholder is an example address, not a name — and it
              // vanishes on the first keystroke.
              aria-label="Correo del docente a invitar"
              placeholder="correo@ejemplo.com"
              value={collaboratorEmail}
              disabled={invitePending}
              onChange={(event) => setCollaboratorEmail(event.target.value)}
              required
            />
            <select
              className={styles.input}
              aria-label="Rol del colaborador"
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

      <section className={styles.section} data-tour="conversations">
        <h3 className={styles.sectionTitle}>Conversaciones</h3>
        <p className={styles.state}>
          La conversación privada del caso está disponible desde el búho del mapa. El asistente sigue siendo privado.
        </p>
        <CaseChat token={token} caseId={caseId} />
        <div data-tour="debate">
          <DebateRoom token={token} caseId={caseId} />
        </div>
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
