import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PortalProvider, useChannel } from '@portalsdk/react'
import type { PortalError } from '@portalsdk/core'
import { getPortalClient } from './client'
import { ConnectionStatus } from './ConnectionStatus'
import { usePortalSession } from './usePortalSession'
import type { ChatMessage } from './types'
import { createPortalSession } from './api'
import { askAssistant } from '../chat/api'
import { BurixPanel } from './BurixPanel'
import logo from '../assets/images/logo.webp'
import styles from './CaseRoom.module.css'

const REACTION_DEBOUNCE_MS = 5_000
const REACTION_COOLDOWN_MS = 45_000

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
  const { messages, send, presence, status, me, typing, sendTyping, setMetadata } = useChannel<ChatMessage>({
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
  const [burixOpen, setBurixOpen] = useState(false)
  // A guard, not display state: it only decides whether this particular
  // nonce has already been acted on. Keeping it in state made the effect
  // write state synchronously on every bump, which is the cascading-render
  // pattern the lint rule flags.
  const lastStartNonce = useRef(0)
  const lastCloseNonce = useRef(0)
  // Memoized on its own: rebuilt inline it was a fresh array every render,
  // which made `presenceState` below re-memo every time and fire the
  // `onPresenceChange` effect on every render instead of on real changes.
  // Portal does not ship sender usernames on standard channels — display data
  // is joined app-side. We carry ours in presence metadata, and fall back to
  // a derived label when a teammate has not published theirs yet.
  const participants = useMemo(
    () =>
      presence?.kind === 'detailed'
        ? presence.participants.map((participant) => ({
            id: participant.id,
            username: participant.username
              ?? (typeof participant.metadata?.username === 'string' ? participant.metadata.username : undefined),
            anon: participant.anon,
          }))
        : [],
    [presence],
  )
  /*
   * `canPublish` mirrors the backend's own `publish` grant (see
   * `services/portal.py`) — a lector, or anyone in a closed case, never has
   * it. `setMetadata` sends a `meta` frame, and the wire protocol gates
   * upstream frames identically to publishes, so attempting it without the
   * grant is a guaranteed `not_permitted` — not a possible failure to
   * handle, a certain one to avoid. Reading a claim already on `me` costs
   * nothing extra; re-deriving the rule client-side would just be the same
   * logic kept in sync by hand in two languages.
   */
  const canPublish = me?.claims?.canPublish === true

  // Publish the current teacher's name once the verified identity arrives, so
  // teammates' rosters show real names instead of "Docente · abcd".
  const identityShared = useRef(false)
  useEffect(() => {
    const username = me?.claims?.username
    if (typeof username === 'string' && canPublish && !identityShared.current) {
      identityShared.current = true
      setMetadata?.({ role: 'docente', surface: 'case-collaboration', username })
    }
  }, [me?.claims?.username, canPublish, setMetadata])
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
  // The bubble mirrors the room: the latest thing Búrix said — an answer to a
  // question or a proactive reaction to the team's comments — or a greeting
  // while he has nothing to say yet.
  const burixLine = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const content = messages[index].content
      if (typeof content !== 'string' && (content.type === 'ai_answer' || content.type === 'burix_reaction')) {
        return content.body
      }
    }
    return null
  }, [messages])
  const burixBubbleText = burixLine
    ?? (sessionActive
      ? 'Sala abierta. Comentad lo que estáis viendo: leo el caso y respondo aquí, al momento.'
      : 'Espero al equipo. Cuando abráis la sala, contadme lo que veis en el caso.')
  // Guard against the reaction effect running while a question is in flight,
  // and a count of the comments already considered, so the debounce only
  // restarts when a genuinely new comment arrives.
  const reactionInFlight = useRef(false)
  const lastReactionCheck = useRef(0)

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
    if (!text || !unlocked || !sessionActive || !canPublish) return
    setSending(true)
    try {
      await send({ content: { body: text } })
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  const reactToComments = useCallback(
    async (comments: string[]) => {
      if (reactionInFlight.current) return
      reactionInFlight.current = true
      try {
        const evidence = comments.length === 1
          ? comments[0]
          : `${comments.slice(0, -1).map((item) => `«${item}»`).join(', ')} y «${comments[comments.length - 1]}»`
        const answer = await askAssistant(
          token,
          `El equipo de docentes acaba de comentar en la sala: ${evidence}. ` +
            'Como Búrix, el búho guía del caso (ficticio o anonimizado), reacciona con una ' +
            'observación breve y cálida: refuerza, matiza o pregunta, conectándola con el caso. Máximo dos frases.',
          caseId,
        )
        if (answer.trim()) await send({ content: { type: 'burix_reaction', body: answer.trim() } })
      } catch {
        // Búrix pierde esta vez; un fallo de IA no debe romper la sala.
      } finally {
        reactionInFlight.current = false
      }
    },
    [caseId, send, token],
  )

  // Proactive Búrix: when the team writes comments during an open session, the
  // owl waits for a quiet moment and answers the burst with one reaction,
  // respecting a cooldown so the assistant is not called on every keystroke.
  useEffect(() => {
    const othersChat = messages.filter(
      (message) =>
        typeof message.content !== 'string' &&
        !message.content.type &&
        message.sender.id !== me?.id,
    )
    const newCount = othersChat.length
    if (newCount === lastReactionCheck.current) return
    lastReactionCheck.current = newCount
    if (!sessionActive || !unlocked || askingAi || newCount === 0) return
    let lastAiIndex = -1
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const content = messages[index].content
      if (typeof content !== 'string' && (content.type === 'ai_answer' || content.type === 'burix_reaction' || content.type === 'ai_question')) {
        lastAiIndex = index
        break
      }
    }
    const lastMessage = messages[messages.length - 1]
    const lastMessageContent = lastMessage?.content
    if (lastMessageContent && typeof lastMessageContent !== 'string' && lastMessageContent.type === 'ai_question') return
    const lastAiAt = lastAiIndex >= 0 ? messages[lastAiIndex].timestamp : undefined
    if (typeof lastAiAt === 'number' && Date.now() - lastAiAt < REACTION_COOLDOWN_MS) return
    const comments = messages
      .slice(lastAiIndex + 1)
      .filter(
        (message) =>
          typeof message.content !== 'string' &&
          !message.content.type &&
          message.sender.id !== me?.id,
      )
      .slice(-3)
      .map((message) => (typeof message.content !== 'string' ? message.content.body : ''))
    if (comments.length === 0) return
    const timer = window.setTimeout(() => {
      void reactToComments(comments)
    }, REACTION_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [askingAi, me?.id, messages, reactToComments, sessionActive, unlocked])

  async function handleAskBurix() {
    const question = draft.trim()
    if (!question || !unlocked || !sessionActive || !canPublish || askingAi) return
    setDraft('')
    setAskingAi(true)
    setAiError(null)
    try {
      await send({ content: { type: 'ai_question', body: question } })
      const answer = await askAssistant(token, question, caseId)
      await send({ content: { type: 'ai_answer', body: answer } })
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : 'Búrix no pudo responder.')
    } finally {
      setAskingAi(false)
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    if (value.trim() && unlocked && sessionActive && canPublish) sendTyping()
  }

  function handleShareAnalysis(analysis: string) {
    if (!sessionActive || !unlocked || !canPublish) return
    void send({ content: { type: 'burix_analysis', body: analysis } })
    setBurixOpen(false)
  }

  if (hideUi) {
    return <div className={styles.presenceProbe} data-testid="case-room" data-state={status} data-session-active={sessionActive ? 'true' : 'false'} data-presence-count={onlineCount} data-portal-me={me?.id ?? ''} data-portal-error={portalError ?? ''} />
  }

  return (
    <div className={styles.roomBody} data-testid="case-room" data-state={status} data-session-active={sessionActive ? 'true' : 'false'}>
      {/* A dropped socket used to be recorded only in `data-state`, which made
          a stalled room look like a quiet one. */}
      <ConnectionStatus status={status} testId="case-room-connection" />

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
        <div className={styles.headerActions}>
          <button type="button" className={styles.burixButton} onClick={() => setBurixOpen(true)} aria-label="Abrir análisis de Búrix">
            Búrix · IA
          </button>
          <span className={`${styles.presence} ${unlocked ? styles.presenceReady : ''}`}>
            {onlineCount} {onlineCount === 1 ? 'conectado' : 'conectados'}
          </span>
        </div>
      </div>

      <div className={styles.burixStrip} data-testid="burix-bubble">
        <img className={styles.burixOwl} src={logo} alt="Búrix" />
        <div className={styles.burixBubble}>
          <span className={styles.burixName}>Búrix · guía de la sala</span>
          <p>{burixBubbleText}</p>
        </div>
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
                <strong>{messageAuthorLabel(message, me?.id)}</strong>
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
                  {messageAuthorLabel(message, me?.id)}
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

          {/* A lector (or anyone in a closed case) has no publish grant —
              the input explains that instead of accepting text that a send
              would then refuse. */}
          {!canPublish && (
            <p className={styles.state} data-testid="case-room-read-only">
              Puedes leer la sala, pero no tienes permiso para escribir en ella.
            </p>
          )}
          <form className={styles.composer} onSubmit={handleSend}>
            <input
              type="text"
              value={draft}
              maxLength={1000}
              placeholder={
                !canPublish
                  ? 'Solo lectura'
                  : unlocked
                    ? 'Comparte una observación del caso…'
                    : 'Esperando al equipo…'
              }
              disabled={sending || !unlocked || !canPublish}
              onChange={(event) => handleDraftChange(event.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={sending || !unlocked || !canPublish || !draft.trim()}>
              {sending ? '…' : 'Enviar'}
            </button>
            <button type="button" className="btn-secondary" disabled={askingAi || !unlocked || !canPublish || !draft.trim()} onClick={() => void handleAskBurix()}>
              {askingAi ? 'Pensando…' : 'Preguntar a Búrix'}
            </button>
          </form>
          {aiError && <p className={styles.portalError} role="alert">{aiError}</p>}
        </>
      )}

      {starting && <p className={styles.typing}>Iniciando la experiencia colaborativa…</p>}
      {closing && <p className={styles.typing}>Cerrando la mesa para el equipo…</p>}

      <BurixPanel
        token={token}
        caseId={caseId}
        open={burixOpen}
        onClose={() => setBurixOpen(false)}
        onShare={handleShareAnalysis}
      />
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

function messageAuthorLabel(message: { content: ChatMessage | string; sender: { id: string; username?: string } }, meId?: string) {
  const content = message.content
  if (typeof content !== 'string' && content.type === 'burix_analysis') return 'Búrix · análisis'
  if (typeof content !== 'string' && content.type === 'burix_reaction') return 'Búrix'
  if (typeof content !== 'string' && content.type === 'ai_answer') return 'Búrix · IA'
  if (meId && message.sender.id === meId) return 'Tú'
  return message.sender.username ?? `Docente · ${message.sender.id.slice(-4)}`
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
}
