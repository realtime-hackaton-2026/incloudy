import { useState } from 'react'
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
}

export function CaseRoom({ token, caseId, minimumParticipants = 2 }: CaseRoomProps) {
  const { session, status, error } = usePortalSession(token, caseId)

  if (status === 'loading') {
    return <div className={styles.room} data-testid="case-room" data-state="loading"><p className={styles.state}>Abriendo la sala en vivo…</p></div>
  }

  if (status === 'unavailable') {
    return <div className={styles.room} data-testid="case-room" data-state="unavailable"><p className={styles.state}>La sala en vivo no está disponible todavía.</p></div>
  }

  if (status === 'error' || !session) {
    return <div className={styles.room} data-testid="case-room" data-state="error"><p className={`${styles.state} ${styles.stateError}`} role="alert">{error ?? 'No se pudo abrir la sala colaborativa.'}</p></div>
  }

  const client = getPortalClient(session.publishableKey)

  return (
    <PortalProvider client={client} token={session.token}>
      <RoomChannel channelId={session.channelId} minimumParticipants={minimumParticipants} />
    </PortalProvider>
  )
}

function RoomChannel({ channelId, minimumParticipants }: { channelId: string; minimumParticipants: number }) {
  const { messages, send, presence, status, me, typing, sendTyping } = useChannel<ChatMessage>({
    channelId,
    history: 30,
  })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const onlineCount = presence?.kind === 'detailed' ? presence.participants.length : presence?.count ?? 0
  const unlocked = onlineCount >= minimumParticipants

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !unlocked) return
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
    if (value.trim() && unlocked) sendTyping()
  }

  return (
    <div className={styles.roomBody} data-testid="case-room" data-state={status}>
      <div className={styles.roomHeader}>
        <div>
          <h3 className={styles.roomTitle}>Mesa de docentes</h3>
          <p className={styles.roomHint}>
            {unlocked ? 'La conversación está abierta.' : `Falta ${minimumParticipants - onlineCount} docente para abrir la conversación.`}
          </p>
        </div>
        <span className={`${styles.presence} ${unlocked ? styles.presenceReady : ''}`}>
          {onlineCount} {onlineCount === 1 ? 'conectado' : 'conectados'}
        </span>
      </div>

      {!unlocked && (
        <div className={styles.waiting} role="status">
          <span className={styles.waitingIcon}>✦</span>
          <div>
            <strong>Esperando a tu colega</strong>
            <p>Podéis permanecer aquí mientras recorréis el caso. En cuanto se conecte otro docente, el intercambio se activa automáticamente.</p>
          </div>
        </div>
      )}

      {unlocked && (
        <div className={styles.liveStrip}>
          <span />
          <strong>Sala activa</strong>
          <span className={styles.liveCopy}>Comentad lo que estáis descubriendo en el mapa.</span>
        </div>
      )}

      <ul className={styles.messages} aria-live="polite">
        {messages.length === 0 && <li className={styles.empty}>Aún no hay aportes. Puedes abrir la conversación con una primera observación.</li>}
        {messages.map((message) => (
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
          placeholder={unlocked ? 'Comparte una observación del caso…' : 'Esperando al segundo docente…'}
          disabled={sending || !unlocked}
          onChange={(event) => handleDraftChange(event.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={sending || !unlocked || !draft.trim()}>
          {sending ? '…' : 'Enviar'}
        </button>
      </form>
    </div>
  )
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
