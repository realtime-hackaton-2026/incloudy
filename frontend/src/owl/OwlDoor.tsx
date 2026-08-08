import { useCallback, useEffect, useState } from 'react'
import { addCollaborator, listCases } from '../cases/api'
import type { Case, CollaboratorRole } from '../cases/api'
import { stationFor } from '../components/case-map/stations'
import type { CaseStage } from '../components/case-map/stations'
import { CaseRoom } from '../portal'
import type { CaseRoomPresenceState } from '../portal'
import { OwlSprite } from './OwlSprite'
import styles from './OwlDoor.module.css'

export interface OwlDoorProps {
  token: string
  caseId: string
  joinCode: string
  stage: CaseStage
}

export function OwlDoor({ token, caseId, joinCode, stage }: OwlDoorProps) {
  const [lobbyOpen, setLobbyOpen] = useState(false)
  const [roomOpen, setRoomOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CollaboratorRole>('comentarista')
  const [inviteState, setInviteState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [inviteError, setInviteError] = useState<string | null>(null)
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
  const [forixCases, setForixCases] = useState<Case[]>([])
  const station = stationFor(stage)
  const portalReady = presence.status === 'ready'
  const portalBlocked = presence.status === 'blocked' || presence.status === 'error' || Boolean(presence.error)
  const canOpen = portalReady && presence.count >= 2
  const presenceLabel = !portalReady
    ? portalBlocked
      ? presence.error ?? 'Portal no ha podido conectar'
      : 'Conectando con Portal…'
    : `${presence.count} ${presence.count === 1 ? 'docente conectado' : 'docentes conectados'}`

  const handlePresenceChange = useCallback((next: CaseRoomPresenceState) => {
    setPresence(next)
  }, [])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null
    const refresh = () => {
      void listCases(token).then((cases) => {
        if (active) setForixCases(cases.filter((item) => item.forixShared))
      }).catch(() => {})
    }
    refresh()
    timer = setInterval(refresh, 5_000)
    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [token])

  function openForixCase(selectedCaseId: string) {
    if (!selectedCaseId || selectedCaseId === caseId) return
    location.hash = `#/caso/${selectedCaseId}`
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

  async function handleInvite() {
    const value = email.trim()
    if (!value) return
    setInviteState('sending')
    setInviteError(null)
    try {
      await addCollaborator(token, caseId, value, role)
      setEmail('')
      setInviteState('sent')
    } catch (cause) {
      setInviteState('error')
      setInviteError(cause instanceof Error ? cause.message : 'No se pudo añadir al docente.')
    }
  }

  function enterLobby() {
    setRosterOpen(false)
    setInviteOpen(false)
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
                <strong>{portalReady ? `${presence.count}/5 docentes` : 'Portal · conexión'}</strong>
              </div>
              <div className={styles.roomHeaderActions}>
                {sessionActive && (
                  <button type="button" className={styles.endRoom} onClick={() => setCloseSessionNonce((current) => current + 1)}>
                    <span aria-hidden="true">■</span> Cerrar mesa
                  </button>
                )}
                <button type="button" className={styles.closeRoom} onClick={() => setRoomOpen(false)} aria-label="Ocultar sala">✕</button>
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
                {presence.detailed && presence.participants.length > 0 ? (
                  <ul className={styles.participants}>
                    {presence.participants.map((participant) => (
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
          token={token}
          caseId={caseId}
          minimumParticipants={2}
          hideUi={!roomOpen}
          startSessionNonce={startSessionNonce}
          closeSessionNonce={closeSessionNonce}
          onSessionActiveChange={handleSessionActiveChange}
          onPresenceChange={handlePresenceChange}
        />

        {sessionActive && (
          <div className={styles.inviteBlock}>
            <button type="button" className={styles.inviteToggle} onClick={() => setInviteOpen((current) => !current)}>
              {inviteOpen ? 'Cerrar invitación' : 'Invitar a otro docente'}
            </button>
            {inviteOpen && (
              <div className={styles.inviteForm}>
                <p className={styles.inviteHint}>La invitación añade al docente al caso; al entrar aparecerá en presencia en tiempo real.</p>
                <div className={styles.inviteRow}>
                  <input className={styles.inviteInput} type="email" value={email} placeholder="correo@colegio.edu" onChange={(event) => setEmail(event.target.value)} />
                  <select className={styles.inviteSelect} value={role} onChange={(event) => setRole(event.target.value as CollaboratorRole)}>
                    <option value="comentarista">Comentarista</option>
                    <option value="editor">Editor</option>
                    <option value="lector">Lector</option>
                  </select>
                  <button type="button" className="btn-secondary" disabled={!email.trim() || inviteState === 'sending'} onClick={() => void handleInvite()}>
                    {inviteState === 'sending' ? 'Invitando…' : 'Invitar'}
                  </button>
                </div>
                {inviteState === 'sent' && <p className={styles.inviteSuccess}>Acceso concedido. Ya puede entrar en este caso.</p>}
                {inviteState === 'error' && <p className={styles.inviteError}>{inviteError}</p>}
              </div>
            )}
          </div>
        )}
      </aside>

      {sessionActive && !roomOpen && (
        <div className={styles.activeBanner} role="status">
          <span className={styles.activeBannerDot} />
          <div className={styles.activeBannerCopy}>
            <strong>Sala de trabajo activa</strong>
            <span>{portalReady ? `${presence.count}/5 docentes · Búrix facilita la conversación en tiempo real` : presenceLabel}</span>
          </div>
          <button type="button" className={styles.bannerButton} onClick={() => setRoomOpen(true)}>
            Ver sala
          </button>
        </div>
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
              <button
                type="button"
                className={styles.viewButton}
                onClick={() => {
                  if (sessionActive) setRoomOpen(true)
                  else setLobbyOpen(true)
                  setRosterOpen(true)
                }}
              >
                Ver sala · {portalReady ? presence.count : '…'}
              </button>
              {!sessionActive && (
                <button
                  type="button"
                  className={`${styles.openButton} ${canOpen ? styles.openButtonReady : ''}`}
                  disabled={!canOpen}
                  onClick={enterLobby}
                  title={canOpen ? 'Abrir la sala de trabajo' : 'Necesitáis al menos dos docentes conectados'}
                >
                  Abrir sala
                </button>
              )}
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
            <p className={styles.lobbyCode}>Comparte este caso con tus colegas · código {joinCode}</p>

            <label className={styles.forixCasePicker}>
              Caso compartido con Forix
              <select value={caseId} onChange={(event) => openForixCase(event.target.value)}>
                {forixCases.length === 0 && <option value={caseId}>Este caso aún no está compartido</option>}
                {forixCases.map((item) => (
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

            <div className={styles.lobbyInvite}>
              <button type="button" className={styles.inviteToggle} onClick={() => setInviteOpen((current) => !current)}>
                {inviteOpen ? 'Ocultar invitación' : 'Invitar docentes a este caso'}
              </button>
              {inviteOpen && (
                <div className={styles.inviteForm}>
                  <p className={styles.inviteHint}>Invita por correo antes de comenzar la mesa.</p>
                  <div className={styles.inviteRow}>
                    <input className={styles.inviteInput} type="email" value={email} placeholder="correo@colegio.edu" onChange={(event) => setEmail(event.target.value)} />
                    <select className={styles.inviteSelect} value={role} onChange={(event) => setRole(event.target.value as CollaboratorRole)}>
                      <option value="comentarista">Comentarista</option>
                      <option value="editor">Editor</option>
                      <option value="lector">Lector</option>
                    </select>
                    <button type="button" className="btn-secondary" disabled={!email.trim() || inviteState === 'sending'} onClick={() => void handleInvite()}>{inviteState === 'sending' ? 'Invitando…' : 'Invitar'}</button>
                  </div>
                  {inviteState === 'sent' && <p className={styles.inviteSuccess}>Invitación enviada y acceso concedido.</p>}
                  {inviteState === 'error' && <p className={styles.inviteError}>{inviteError}</p>}
                </div>
              )}
            </div>

            <div className={styles.lobbyActions}>
              <button
                type="button"
                className={`${styles.startButton} ${canOpen ? styles.startButtonReady : ''}`}
                disabled={!canOpen}
                onClick={startExperience}
              >
                {canOpen ? 'Comenzar experiencia' : 'Esperando docentes…'}
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
