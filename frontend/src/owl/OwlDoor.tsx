import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { joinCase, listCaseParticipants, listCases } from '../cases/api'
import type { Case, CaseParticipant } from '../cases/api'
import { ApiError } from '../lib/http'
import { stationFor } from '../components/case-map/stations'
import type { CaseStage } from '../components/case-map/stations'
import { CaseRoom } from '../portal'
import type { CaseRoomPresenceState } from '../portal'
import { CodeChip, CodeInput } from '../components/room-code'
import { OwlSprite } from './OwlSprite'
import styles from './OwlDoor.module.css'

export interface OwlDoorProps {
  token: string
  caseId: string
  joinCode: string
  studentName: string
  studentAge?: number | null
  studentCourse?: string | null
  studentDescription: string
  stage: CaseStage
  onSelectCase?: (caseId: string) => void
}

export function OwlDoor({ token, caseId, joinCode, studentName, studentAge, studentCourse, studentDescription, stage, onSelectCase }: OwlDoorProps) {
  const [lobbyOpen, setLobbyOpen] = useState(false)
  const [roomOpen, setRoomOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [presence, setPresence] = useState<CaseRoomPresenceState>({
    count: 0,
    participants: [],
    detailed: false,
    status: 'loading',
    error: null,
  })
  const [sessionActive, setSessionActive] = useState(false)
  const [startSessionNonce, setStartSessionNonce] = useState(0)
  const [closeSessionNonce, setCloseSessionNonce] = useState(0)
  const [burixCases, setBurixCases] = useState<Case[]>([])
  const [roomMembers, setRoomMembers] = useState<CaseParticipant[]>([])
  const [presenceCaseId, setPresenceCaseId] = useState(caseId)

  if (presenceCaseId !== caseId) {
    setPresenceCaseId(caseId)
    setPresence({ count: 0, participants: [], detailed: false, status: 'loading', error: null })
    setRoomMembers([])
    setSessionActive(false)
    setRosterOpen(false)
  }
  const memberNames = Object.fromEntries(roomMembers.map((member) => [member.userId, member.nombre]))
  const visibleParticipantsById = new Map(
    roomMembers.map((member) => [member.userId, { id: member.userId, username: member.nombre }]),
  )
  for (const participant of presence.participants) {
    visibleParticipantsById.set(participant.id, {
      ...participant,
      username: memberNames[participant.id] ?? participant.username,
    })
  }
  const visibleParticipants = [...visibleParticipantsById.values()]
  const visibleCount = Math.max(presence.count, visibleParticipants.length)
  const station = stationFor(stage)
  const portalReady = presence.status === 'ready'
  const portalBlocked = presence.status === 'blocked' || presence.status === 'error' || Boolean(presence.error)
  const canOpen = portalReady && visibleCount >= 2
  const presenceLabel = !portalReady
    ? portalBlocked
      ? presence.error ?? 'Portal no ha podido conectar'
      : 'Conectando con Portal…'
    : `${visibleCount} ${visibleCount === 1 ? 'docente conectado' : 'docentes conectados'}`

  const handlePresenceChange = useCallback((next: CaseRoomPresenceState) => {
    setPresence((current) => {
      // Presence sockets may be suspended while a browser tab is in the
      // background. A teacher who already joined must remain in this room's
      // roster instead of vanishing on that temporary 2 -> 1 transition.
      const participantsById = new Map(current.participants.map((item) => [item.id, item]))
      for (const participant of next.participants) {
        participantsById.set(participant.id, participant)
      }
      const participants = [...participantsById.values()]
      return {
        ...next,
        count: Math.max(current.count, next.count, participants.length),
        participants,
        detailed: current.detailed || next.detailed,
      }
    })
  }, [])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null
    const refresh = () => {
      void Promise.all([listCases(token), listCaseParticipants(token, caseId)]).then(([cases, members]) => {
        if (!active) return
        setBurixCases(cases.filter((item) => item.burixShared))
        setRoomMembers(members)
      }).catch(() => {})
    }
    refresh()
    timer = setInterval(refresh, 5_000)
    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [caseId, token])

  function openBurixCase(selectedCaseId: string) {
    if (!selectedCaseId || selectedCaseId === caseId) return
    onSelectCase?.(selectedCaseId)
  }

  /*
   * Once any teacher starts the shared experience, everyone leaves the lobby
   * and lands in the live room. This runs on the event itself rather than in
   * an effect watching `sessionActive`: an effect would fire again on every
   * later render where the flag is still true, re-opening the room after a
   * teacher had deliberately closed it.
   */
  const handleSessionActiveChange = useCallback((active: boolean) => {
    setSessionActive(active)
    if (!active) return
    setLobbyOpen(false)
    setRoomOpen(true)
  }, [])

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = roomCode.trim().toUpperCase()
    if (code.length !== 6) return
    setJoining(true)
    setJoinError(null)
    try {
      const joined = await joinCase(token, code)
      setRoomCode('')
      if (joined.id !== caseId) location.hash = `#/caso/${joined.id}`
    } catch (cause) {
      setJoinError(cause instanceof ApiError ? cause.message : 'No se pudo entrar en la sala.')
    } finally {
      setJoining(false)
    }
  }

  function enterLobby() {
    setRosterOpen(false)
    setLobbyOpen(true)
    setRoomOpen(false)
  }

  function startExperience() {
    if (!canOpen || sessionActive) return
    setStartSessionNonce((current) => current + 1)
  }

  function backToMap() {
    setLobbyOpen(false)
    setRoomOpen(false)
    setRosterOpen(false)
  }

  function viewCurrentCase() {
    location.hash = `#/caso/${caseId}`
  }

  return (
    <>
      {/* Portal presence and the session-control channel remain mounted even
          when no panel is visible. That is what makes 1 → 2 realtime and lets
          a colleague start the experience for everyone. */}
      <aside className={`${styles.roomDock} ${roomOpen ? styles.roomDockOpen : styles.roomDockClosed}`} data-testid="owl-door-room">
        {roomOpen && (
          <>
            <div className={styles.roomDockHeader}>
              <div>
                <span className="eyebrow">Búrix · guía de la sala</span>
                {/* The code moved out of the link: it needs its own copy
                    button, and a button cannot be nested inside a button. */}
                <div className={styles.caseLinkRow}>
                  <button
                    type="button"
                    className={styles.caseLink}
                    onClick={viewCurrentCase}
                    aria-label={`Ver el caso de ${studentName}`}
                  >
                    <span>Caso de {studentName}</span>
                  </button>
                  <CodeChip code={joinCode} />
                </div>
                <div className={styles.caseStudentDetails}>
                  <span>{studentAge ? `${studentAge} años` : 'Edad no indicada'}</span>
                  <span>{studentCourse || 'Curso no indicado'}</span>
                  <p>{studentDescription}</p>
                </div>
                <strong>{portalReady ? `${visibleCount}/5 docentes` : 'Portal · conexión'}</strong>
              </div>
              <div className={styles.roomHeaderActions}>
                {sessionActive && (
                  <button type="button" className={styles.endRoom} onClick={() => setCloseSessionNonce((current) => current + 1)}>
                    <span aria-hidden="true">■</span> Cerrar mesa
                  </button>
                )}
                <button type="button" className={styles.closeRoom} onClick={() => setRoomOpen(false)} aria-label="Contraer chat">›</button>
              </div>
            </div>

            <div className={styles.roomPeopleBar}>
              <span className={styles.roomPeopleDot} />
              <strong>{presenceLabel}</strong>
              <button type="button" onClick={() => setRosterOpen((current) => !current)}>
                {rosterOpen ? 'Ocultar' : 'Ver usuarios'}
              </button>
            </div>

            {rosterOpen && (
              <div className={styles.inlineRoster}>
                {visibleParticipants.length > 0 ? (
                  <ul className={styles.participants}>
                    {visibleParticipants.map((participant) => (
                      <li key={participant.id}>
                        <span className={styles.participantDot} />
                        <span>{participant.username ?? `Docente · ${participant.id.slice(-4)}`}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.rosterHint}>Portal informa de {presence.count} docentes conectados en esta sala.</p>
                )}
              </div>
            )}
          </>
        )}

        <CaseRoom
          key={caseId}
          token={token}
          caseId={caseId}
          minimumParticipants={2}
          persistentPresenceCount={visibleCount}
          participantNames={memberNames}
          hideUi={!roomOpen}
          startSessionNonce={startSessionNonce}
          closeSessionNonce={closeSessionNonce}
          onSessionActiveChange={handleSessionActiveChange}
          onPresenceChange={handlePresenceChange}
        />

      </aside>

      {sessionActive && !roomOpen && (
        <button type="button" className={styles.collapsedRoomTab} onClick={() => setRoomOpen(true)} aria-label="Expandir chat de la sala">
          <span className={styles.collapsedArrow} aria-hidden="true">‹</span>
          <span className={styles.activeBannerDot} />
          <div className={styles.activeBannerCopy}>
            <strong>Caso de {studentName}</strong>
            <span>{joinCode} · {portalReady ? `${visibleCount}/5 docentes` : presenceLabel}</span>
          </div>
        </button>
      )}

      {!lobbyOpen && !roomOpen && (
        <aside className={`${styles.wrapper} ${mobileMenuOpen ? styles.mobileMenuExpanded : ''}`} data-testid="owl-door" data-state="closed">
          <button type="button" className={styles.mobileMenuToggle} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((current) => !current)}>
            <OwlSprite className={styles.mobileMenuOwl} />
            <span><strong>Búrix · sala docente</strong><small>{sessionActive ? 'Sala activa' : presenceLabel}</small></span>
            <b aria-hidden="true">⌃</b>
          </button>
          <div className={styles.mobileMenuContent}>
          <div className={styles.whisper} role="status">
            <strong>{sessionActive ? 'La sala sigue con vosotros.' : canOpen ? 'Ya podéis reuniros.' : '¿Nos reunimos?'}</strong>
            <span>
              {sessionActive
                ? 'Seguid recorriendo el mapa y compartid aquí vuestras observaciones.'
                : !portalReady
                  ? (portalBlocked ? 'No he podido conectar con la sala realtime de Portal. Comprueba la conexión y vuelve a intentarlo.' : 'Estoy conectando con la sala realtime de Portal…')
                  : presence.count === 0
                    ? 'Todavía no veo docentes conectados en esta sala.'
                  : presence.count === 1
                    ? 'Hay 1 docente conectado. Cuando seáis dos, podréis comenzar juntos.'
                    : `Hay ${presence.count} docentes conectados. La sala está lista para comenzar.`}
            </span>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.door} onClick={sessionActive ? () => setRoomOpen(true) : enterLobby}>
              <span className={styles.owlHalo} aria-hidden="true">
                <OwlSprite className={styles.owl} />
              </span>
              <span className={styles.label}>
                <span className={styles.title}>Búrix · sala docente</span>
                <span className={styles.subtitle}>{station.label} · {sessionActive ? 'conversación activa' : 'colaboración en vivo'}</span>
              </span>
              <span className={`${styles.statusDot} ${canOpen || sessionActive ? styles.statusReady : ''}`} aria-hidden="true" />
            </button>

            <div className={styles.actionRow}>
              <button type="button" className={styles.viewButton} onClick={sessionActive ? () => setRoomOpen(true) : enterLobby}>
                {sessionActive ? 'Ver sala' : 'Entrar a sala'} · {portalReady ? presence.count : '…'}
              </button>
            </div>
          </div>
          </div>
        </aside>
      )}

      {lobbyOpen && !sessionActive && (
        <div className={styles.lobbyOverlay} role="dialog" aria-modal="true" aria-labelledby="owl-lobby-title">
          <div className={styles.lobbyCard}>
            <div className={styles.lobbyKicker}>BRÚIX · COLABORACIÓN</div>
            <h2 id="owl-lobby-title">Sala de trabajo de Búrix</h2>
            {/* This line exists to be shared, so the code is copyable here
                rather than read out character by character. */}
            <p className={styles.lobbyCode}>
              <span>Comparte este caso con tus colegas</span>
              <CodeChip code={joinCode} />
            </p>

            <label className={styles.forixCasePicker}>
              Caso compartido con Búrix
              <select value={caseId} onChange={(event) => openBurixCase(event.target.value)}>
                {burixCases.length === 0 && <option value={caseId}>Este caso aún no está compartido</option>}
                {burixCases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.alumno.nombre} · {item.status.replace('_', ' ')} · {item.progreso.porcentaje}%
                  </option>
                ))}
              </select>
            </label>

            <section className={styles.lobbyPanel} aria-label="Docentes presentes">
              <div className={styles.lobbyPanelTop}>
                <div>
                  <strong>Búrix · sala de trabajo</strong>
                  <span>En tiempo real</span>
                </div>
                <strong>{portalReady ? `${presence.count} / 5` : 'Portal · conexión'}</strong>
              </div>
              <div className={styles.lobbyPanelTitle}>
                <span>DOCENTES PRESENTES</span>
                <small>Se actualiza automáticamente</small>
              </div>
              {presence.detailed && presence.participants.length > 0 ? (
                <ul className={styles.lobbyParticipants}>
                  {presence.participants.slice(0, 5).map((participant) => (
                    <li key={participant.id}>
                      <span className={styles.participantDot} />
                      <span>{participant.username ?? `Docente · ${participant.id.slice(-4)}`}</span>
                      <small>PRESENTE</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.aggregatePresence}>
                  <span className={styles.participantDot} />
                  <span>{portalReady ? (presence.count === 1 ? 'Docente conectado' : `${presence.count} docentes conectados`) : presenceLabel}</span>
                </div>
              )}
            </section>

            <div className={`${styles.lobbyStatus} ${canOpen ? styles.lobbyStatusReady : ''}`}>
              <span className={styles.lobbyStatusDot} />
              <div>
                <strong>{canOpen ? 'Equipo listo' : 'Esperando al equipo'}</strong>
                <span>{canOpen ? 'Dos o más docentes pueden comenzar la sesión.' : portalReady ? 'Necesitamos al menos 2 docentes para empezar.' : presenceLabel}</span>
              </div>
            </div>

            <form className={styles.lobbyJoin} onSubmit={handleJoin}>
              <div>
                <strong>Unirse a sala</strong>
                <span>Introduce el código de 6 caracteres compartido por el profesor.</span>
              </div>
              <div className={styles.lobbyJoinRow}>
                <CodeInput
                  id="lobby-room-code"
                  value={roomCode}
                  onChange={setRoomCode}
                  label="Código para unirse a la sala"
                />
                <button type="submit" className="btn-secondary" disabled={joining || roomCode.length !== 6}>
                  {joining ? 'Uniéndose…' : 'Unirse'}
                </button>
              </div>
              {joinError && <p className={styles.joinError} role="alert">{joinError}</p>}
            </form>

            <div className={styles.lobbyActions}>
              <button
                type="button"
                className={`${styles.startButton} ${canOpen ? styles.startButtonReady : ''}`}
                disabled={!canOpen}
                onClick={startExperience}
              >
                {canOpen ? 'Crear sala' : 'Esperando docentes…'}
              </button>
              <button type="button" className={styles.backButton} onClick={backToMap}>Volver al mapa</button>
            </div>

            <button type="button" className={styles.historyButton} onClick={() => { setLobbyOpen(false); setRoomOpen(true) }}>
              Ver historial anterior del caso
            </button>

            <p className={styles.lobbyFootnote}>Al comenzar, todos volveréis al mapa con la conversación colaborativa abierta.</p>
          </div>

          <div className={styles.lobbyGuide}>
            <OwlSprite className={styles.lobbyGuideOwl} />
            <div>
              <strong>{canOpen ? 'Perfecto. Ya somos dos.' : 'Estoy esperando al equipo.'}</strong>
              <span>{canOpen ? 'Podéis comenzar juntos y comentar cada paso del caso.' : 'Cuando llegue otro docente, os avisaré y podréis comenzar.'}</span>
            </div>
          </div>
        </div>
      )}


    </>
  )
}
