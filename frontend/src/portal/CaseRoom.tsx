import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { PortalProvider, useChannel } from '@portalsdk/react'
import { getPortalClient } from './client'
import { usePortalSession } from './usePortalSession'
import type { ChatMessage } from './types'
import styles from './CaseRoom.module.css'

export interface CaseRoomProps {
  token: string
  caseId: string
  minimumParticipants?: number
  /** Keeps the Portal channel mounted while the visual room/lobby is elsewhere. */
  hideUi?: boolean
  /** Increment to request a collaborative session start from the current teacher. */
  startSessionNonce?: number
  onSessionActiveChange?: (active: boolean) => void
}

export interface CaseRoomPresenceProps extends CaseRoomProps {
  onPresenceChange?: (presence: CaseRoomPresenceState) => void
}

export interface CaseRoomPresenceState {
  count: number
  participants: Array<{ id: string; username?: string; anon?: boolean }>
  detailed: boolean
  status: string
}

export function CaseRoom({
  token,
  caseId,
  minimumParticipants = 2,
  hideUi = false,
  startSessionNonce = 0,
  onSessionActiveChange,
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

  const client = getPortalClient(session.publishableKey)

  return (
    <PortalProvider client={client} token={session.token}>
      <RoomChannel
        channelId={session.channelId}
        minimumParticipants={minimumParticipants}
        hideUi={hideUi}
        startSessionNonce={startSessionNonce}
        onSessionActiveChange={onSessionActiveChange}
      />
    </PortalProvider>
  )
}

/**
 * Keeps the Portal channel mounted even while the visual room is closed.
 * This is what makes the owl know in real time when a second teacher arrives.
 */
export function CaseRoomPresence({ token, caseId, onPresenceChange }: CaseRoomPresenceProps) {
  const { session, status, error } = usePortalSession(token, caseId)

  if (status === 'loading') {
    return <div className={styles.presenceProbe} data-testid="case-room-presence" data-state="loading" />
  }

  if (status === 'unavailable') {
    return <PresenceBridge state={{ count: 0, participants: [], detailed: false, status: 'unavailable' }} onPresenceChange={onPresenceChange} />
  }

  if (status === 'error' || !session) {
    return <PresenceBridge state={{ count: 0, participants: [], detailed: false, status: 'error' }} onPresenceChange={onPresenceChange} />
  }

  const client = getPortalClient(session.publishableKey)

  return (
    <PortalProvider client={client} token={session.token}>
      <PresenceChannel channelId={session.channelId} onPresenceChange={onPresenceChange} />
    </PortalProvider>
  )
}

function PresenceChannel({ channelId, onPresenceChange }: { channelId: string; onPresenceChange?: (presence: CaseRoomPresenceState) => void }) {
  const { presence, status } = useChannel<ChatMessage>({ channelId, history: 0 })
  const participants = presence?.kind === 'detailed'
    ? presence.participants.map((participant) => ({
        id: participant.id,
        username: participant.username,
        anon: participant.anon,
      }))
    : []
  const count = presence?.kind === 'detailed' ? participants.length : presence?.count ?? 0

  const state = useMemo<CaseRoomPresenceState>(() => ({
    count,
    participants,
    detailed: presence?.kind === 'detailed',
    status,
  }), [count, participants, presence?.kind, status])

  return <PresenceBridge state={state} onPresenceChange={onPresenceChange} />
}

function PresenceBridge({ state, onPresenceChange }: { state: CaseRoomPresenceState; onPresenceChange?: (presence: CaseRoomPresenceState) => void }) {
  useEffect(() => {
    onPresenceChange?.(state)
  }, [onPresenceChange, state])

  return <div className={styles.presenceProbe} data-testid="case-room-presence" data-state={state.status} />
}

function RoomChannel({
  channelId,
  minimumParticipants,
  hideUi,
  startSessionNonce,
  onSessionActiveChange,
}: {
  channelId: string
  minimumParticipants: number
  hideUi: boolean
  startSessionNonce: number
  onSessionActiveChange?: (active: boolean) => void
}) {
  const { messages, send, presence, status, me, typing, sendTyping } = useChannel<ChatMessage>({
    channelId,
    history: 30,
  })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [lastStartNonce, setLastStartNonce] = useState(0)
  const onlineCount = presence?.kind === 'detailed' ? presence.participants.length : presence?.count ?? 0
  const unlocked = onlineCount >= minimumParticipants
  const sessionActive = messages.some((message) => isSessionStarted(message.content))
  const chatMessages = messages.filter((message) => !isSessionStarted(message.content))

  useEffect(() => {
    onSessionActiveChange?.(sessionActive)
  }, [onSessionActiveChange, sessionActive])

  useEffect(() => {
    if (!startSessionNonce || startSessionNonce <= lastStartNonce || !unlocked || sessionActive || starting) return
    setLastStartNonce(startSessionNonce)
    setStarting(true)
    void send({
      content: {
        type: 'session_started',
        body: 'La experiencia colaborativa ha comenzado.',
      },
    }).finally(() => setStarting(false))
  }, [lastStartNonce, send, sessionActive, startSessionNonce, starting, unlocked])

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

  function handleDraftChange(value: string) {
    setDraft(value)
    if (value.trim() && unlocked && sessionActive) sendTyping()
  }

  if (hideUi) {
    return <div className={styles.presenceProbe} data-testid="case-room" data-state={status} data-session-active={sessionActive ? 'true' : 'false'} />
  }

  return (
    <div className={styles.roomBody} data-testid="case-room" data-state={status} data-session-active={sessionActive ? 'true' : 'false'}>
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

      {sessionActive && (
        <>
          <ul className={styles.messages} aria-live="polite">
            {chatMessages.length === 0 && <li className={styles.empty}>Aún no hay aportes. Comparte la primera observación del caso.</li>}
            {chatMessages.map((message) => (
              <li key={message.id} className={styles.message}>
                <div className={styles.messageMeta}>
                  <span className={styles.messageAuthor}>{me && message.sender.id === me.id ? 'Tú' : message.sender.username ?? `Docente · ${message.sender.id.slice(-4)}`}</span>
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
          </form>
        </>
      )}

      {starting && <p className={styles.typing}>Iniciando la experiencia colaborativa…</p>}
    </div>
  )
}

function isSessionStarted(content: ChatMessage | string) {
  return typeof content !== 'string' && content.type === 'session_started'
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
