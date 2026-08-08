import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PortalProvider, useChannel } from '@portalsdk/react'
import type { PortalError } from '@portalsdk/core'
import { getPortalClient } from './client'
import { usePortalSession } from './usePortalSession'
import type { ChatMessage } from './types'
import { createPortalSession } from './api'
import { askAssistant } from '../chat/api'
import styles from './CaseRoom.module.css'

export interface CaseRoomProps {
  token: string
  caseId: string
  minimumParticipants?: number
  onPresenceChange?: (presence: CaseRoomPresenceState) => void
  /** Keeps the Portal channel mounted while the visual room/lobby is elsewhere. */
  hideUi?: boolean
  /** Increment to request a collaborative session start from the current teacher. */
  startSessionNonce?: number
  /** Increment to close the current table for every connected teacher. */
  closeSessionNonce?: number
  onSessionActiveChange?: (active: boolean) => void
}

export interface CaseRoomPresenceState {
  count: number
  participants: Array<{ id: string; username?: string; anon?: boolean }>
  detailed: boolean
  status: string
  error?: string | null
}

export function CaseRoom({
  token,
  caseId,
  minimumParticipants = 2,
  hideUi = false,
  startSessionNonce = 0,
  closeSessionNonce = 0,
  onSessionActiveChange,
  onPresenceChange,
}: CaseRoomProps) {
  const { session, status, error } = usePortalSession(token, caseId)

  if (status === 'loading') {
    return hideUi
      ? <div className={styles.presenceProbe} data-testid="case-room" data-state="loading" />
      : <div className={styles.room} data-testid="case-room" data-state="loading"><p className={styles.state}>Abriendo la sala en vivo…</p></div>
  }

  if (status === 'unavailable') {
    return hideUi
      ? <div className={styles.presenceProbe} data-testid="case-room" data-state="unavailable" />
      : <div className={styles.room} data-testid="case-room" data-state="unavailable"><p className={styles.state}>La sala en vivo no está disponible todavía.</p></div>
  }

  if (status === 'error' || !session) {
    return hideUi
      ? <div className={styles.presenceProbe} data-testid="case-room" data-state="error" />
      : <div className={styles.room} data-testid="case-room" data-state="error"><p className={`${styles.state} ${styles.stateError}`} role="alert">{error ?? 'No se pudo abrir la sala colaborativa.'}</p></div>
  }

  const client = getPortalClient(session.publishableKey, session.channelId)

  // Portal recommends a token callback so the SDK can re-resolve the signed
  // credential after reconnect/expiry. The backend endpoint also guarantees
  // that the same teacher keeps the same case channel.
  const fetchFreshPortalToken = async () => {
    const fresh = await createPortalSession(token, caseId)
    if (fresh.channelId !== session.channelId) {
      throw new Error('Portal devolvió otro canal para este caso.')
    }
    return fresh.token
  }

  return (
    <PortalProvider client={client} token={fetchFreshPortalToken}>
      <RoomChannel
        token={token}
        caseId={caseId}
        channelId={session.channelId}
        minimumParticipants={minimumParticipants}
        hideUi={hideUi}
        startSessionNonce={startSessionNonce}
        closeSessionNonce={closeSessionNonce}
        onSessionActiveChange={onSessionActiveChange}
        onPresenceChange={onPresenceChange}
      />
    </PortalProvider>
  )
}

function RoomChannel({
  token,
  caseId,
  channelId,
  minimumParticipants,
  hideUi,
  startSessionNonce,
  closeSessionNonce,
  onSessionActiveChange,
  onPresenceChange,
}: {
  token: string
  caseId: string
  channelId: string
  minimumParticipants: number
  hideUi: boolean
  startSessionNonce: number
  closeSessionNonce: number
  onSessionActiveChange?: (active: boolean) => void
  onPresenceChange?: (presence: CaseRoomPresenceState) => void
}) {
  const [portalError, setPortalError] = useState<string | null>(null)
  const { messages, send, presence, status, me, typing, sendTyping } = useChannel<ChatMessage>({
    channelId,
    history: 30,
    metadata: { role: 'docente', surface: 'case-collaboration' },
    onError: (error: PortalError) => {
      setPortalError(`${error.code}: ${error.message}`)
    },
  })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [askingAi, setAskingAi] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  // A guard, not display state: it only decides whether this particular
  // nonce has already been acted on. Keeping it in state made the effect
  // write state synchronously on every bump, which is the cascading-render
  // pattern the lint rule flags.
  const lastStartNonce = useRef(0)
  const lastCloseNonce = useRef(0)
  // Memoized on its own: rebuilt inline it was a fresh array every render,
  // which made `presenceState` below re-memo every time and fire the
  // `onPresenceChange` effect on every render instead of on real changes.
  const participants = useMemo(
    () =>
      presence?.kind === 'detailed'
        ? presence.participants.map((participant) => ({
            id: participant.id,
            username: participant.username,
            anon: participant.anon,
          }))
        : [],
    [presence],
  )
  const onlineCount = presence?.kind === 'detailed' ? participants.length : presence?.count ?? 0
  const presenceState = useMemo<CaseRoomPresenceState>(() => ({
    count: onlineCount,
    participants,
    detailed: presence?.kind === 'detailed',
    status,
    error: portalError,
  }), [onlineCount, participants, presence?.kind, portalError, status])
  const unlocked = onlineCount >= minimumParticipants
  const latestControlIndex = messages.reduce(
    (latest, message, index) => isSessionControl(message.content) ? index : latest,
    -1,
  )
  const latestControl = latestControlIndex >= 0 ? messages[latestControlIndex] : null
  const sessionActive = latestControl ? isSessionStarted(latestControl.content) : false
  const currentMessages = messages.slice(latestControlIndex + 1).filter((message) => !isSessionControl(message.content))
  const previousMessages = messages.slice(0, Math.max(0, latestControlIndex)).filter((message) => !isSessionControl(message.content))

  useEffect(() => {
    onSessionActiveChange?.(sessionActive)
  }, [onSessionActiveChange, sessionActive])

  useEffect(() => {
    onPresenceChange?.(presenceState)
  }, [onPresenceChange, presenceState])

  useEffect(() => {
    if (!startSessionNonce || startSessionNonce <= lastStartNonce.current || !unlocked || sessionActive || starting) return
    lastStartNonce.current = startSessionNonce
    setStarting(true)
    void send({
      content: {
        type: 'session_started',
        body: 'La experiencia colaborativa ha comenzado.',
      },
    }).finally(() => setStarting(false))
  }, [send, sessionActive, startSessionNonce, starting, unlocked])

  useEffect(() => {
    if (!closeSessionNonce || closeSessionNonce <= lastCloseNonce.current || !sessionActive || closing) return
    lastCloseNonce.current = closeSessionNonce
    setClosing(true)
    void send({
      content: {
        type: 'session_closed',
        body: 'La mesa de docentes ha sido cerrada.',
      },
    }).finally(() => setClosing(false))
  }, [closeSessionNonce, closing, send, sessionActive])

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !unlocked || !sessionActive) return
    setSending(true)
    try {
      await send({ content: { body: text } })
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  async function handleAskForix() {
    const question = draft.trim()
    if (!question || !unlocked || !sessionActive || askingAi) return
    setDraft('')
    setAskingAi(true)
    setAiError(null)
    try {
      await send({ content: { type: 'ai_question', body: question } })
      const answer = await askAssistant(token, question, caseId)
      await send({ content: { type: 'ai_answer', body: answer } })
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : 'Forix no pudo responder.')
    } finally {
      setAskingAi(false)
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    if (value.trim() && unlocked && sessionActive) sendTyping()
  }

  if (hideUi) {
    return <div className={styles.presenceProbe} data-testid="case-room" data-state={status} data-session-active={sessionActive ? 'true' : 'false'} data-presence-count={onlineCount} data-portal-me={me?.id ?? ''} data-portal-error={portalError ?? ''} />
  }

  return (
    <div className={styles.roomBody} data-testid="case-room" data-state={status} data-session-active={sessionActive ? 'true' : 'false'}>
      {portalError && (
        <div className={styles.portalError} role="alert">Portal: {portalError}</div>
      )}

      <div className={styles.roomHeader}>
        <div>
          <h3 className={styles.roomTitle}>Mesa de docentes</h3>
          <p className={styles.roomHint}>
            {!sessionActive
              ? `Esperando a que el equipo comience la experiencia${unlocked ? '.' : ` · faltan ${minimumParticipants - onlineCount} docentes`}.`
              : unlocked
                ? 'La conversación está abierta mientras recorréis el caso.'
                : `La sala necesita ${minimumParticipants} docentes para continuar.`}
          </p>
        </div>
        <span className={`${styles.presence} ${unlocked ? styles.presenceReady : ''}`}>
          {onlineCount} {onlineCount === 1 ? 'conectado' : 'conectados'}
        </span>
      </div>

      {!sessionActive && (
        <div className={styles.waiting} role="status">
          <span className={styles.waitingIcon}>✦</span>
          <div>
            <strong>{unlocked ? 'Equipo preparado' : 'Esperando al equipo'}</strong>
            <p>{unlocked ? 'La sesión se puede iniciar. Volveréis al mapa con la conversación abierta.' : 'Cuando haya dos docentes presentes, la conversación quedará lista para comenzar.'}</p>
          </div>
        </div>
      )}

      {sessionActive && unlocked && (
        <div className={styles.liveStrip}>
          <span />
          <strong>Sala activa</strong>
          <span className={styles.liveCopy}>Comentad lo que estáis descubriendo en el mapa.</span>
        </div>
      )}

      {previousMessages.length > 0 && (
        <details className={styles.history} open={!sessionActive}>
          <summary>Historial anterior del caso · {previousMessages.length} aportes</summary>
          <ul className={styles.historyMessages}>
            {previousMessages.map((message) => (
              <li key={message.id}>
                <strong>{message.content && typeof message.content !== 'string' && message.content.type === 'ai_answer' ? 'Forix · IA' : message.sender.username ?? 'Docente'}</strong>
                <span>{messageBody(message.content)}</span>
                <time>{formatTime(message.timestamp)}</time>
              </li>
            ))}
          </ul>
        </details>
      )}

      {sessionActive && (
        <>
          <ul className={styles.messages} aria-live="polite">
            {currentMessages.length === 0 && <li className={styles.empty}>Aún no hay aportes. Comparte la primera observación del caso.</li>}
            {currentMessages.map((message) => (
              <li key={message.id} className={styles.message}>
                <div className={styles.messageMeta}>
                <span className={styles.messageAuthor}>
                  {message.content && typeof message.content !== 'string' && message.content.type === 'ai_answer'
                    ? 'Forix · IA'
                    : me && message.sender.id === me.id
                      ? 'Tú'
                      : message.sender.username ?? `Docente · ${message.sender.id.slice(-4)}`}
                </span>
                  <time>{formatTime(message.timestamp)}</time>
                </div>
                <p>{messageBody(message.content)}</p>
              </li>
            ))}
          </ul>

          <p className={styles.typing} aria-live="polite" data-testid="case-room-typing">
            {typing.length > 0 && (typing.length === 1 ? 'Alguien está escribiendo…' : `${typing.length} docentes están escribiendo…`)}
          </p>

          <form className={styles.composer} onSubmit={handleSend}>
            <input
              type="text"
              value={draft}
              maxLength={1000}
              placeholder={unlocked ? 'Comparte una observación del caso…' : 'Esperando al equipo…'}
              disabled={sending || !unlocked}
              onChange={(event) => handleDraftChange(event.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={sending || !unlocked || !draft.trim()}>
              {sending ? '…' : 'Enviar'}
            </button>
            <button type="button" className="btn-secondary" disabled={askingAi || !unlocked || !draft.trim()} onClick={() => void handleAskForix()}>
              {askingAi ? 'Pensando…' : 'Preguntar a Forix'}
            </button>
          </form>
          {aiError && <p className={styles.portalError} role="alert">{aiError}</p>}
        </>
      )}

      {starting && <p className={styles.typing}>Iniciando la experiencia colaborativa…</p>}
      {closing && <p className={styles.typing}>Cerrando la mesa para el equipo…</p>}
    </div>
  )
}

function isSessionStarted(content: ChatMessage | string) {
  return typeof content !== 'string' && content.type === 'session_started'
}

function isSessionControl(content: ChatMessage | string) {
  return typeof content !== 'string' && (content.type === 'session_started' || content.type === 'session_closed')
}

function messageBody(content: ChatMessage | string) {
  if (typeof content === 'string') return content
  return content.body
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
}
