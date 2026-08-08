/*
 * frontend/src/portal/CaseRoom.tsx // the case's live comment channel — one
 * Portal room per case, opened with a session minted fresh by the backend so
 * the publish grant always matches the caller's current role.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { PortalProvider, useChannel } from '@portalsdk/react'
import { getPortalClient } from './client'
import { usePortalSession } from './usePortalSession'
import styles from './CaseRoom.module.css'

export interface CaseRoomProps {
  token: string
  caseId: string
}

export function CaseRoom({ token, caseId }: CaseRoomProps) {
  const { session, status, error } = usePortalSession(token, caseId)

  if (status === 'loading') {
    return (
      <div className={styles.room} data-testid="case-room" data-state="loading">
        <p className={styles.state}>Abriendo la sala en vivo…</p>
      </div>
    )
  }

  if (status === 'unavailable') {
    return (
      <div className={styles.room} data-testid="case-room" data-state="unavailable">
        <p className={styles.state}>La sala en vivo no está disponible todavía.</p>
      </div>
    )
  }

  if (status === 'error' || !session) {
    return (
      <div className={styles.room} data-testid="case-room" data-state="error">
        <p className={`${styles.state} ${styles.stateError}`} role="alert">
          {error ?? 'No se pudo abrir la sala en vivo.'}
        </p>
      </div>
    )
  }

  const client = getPortalClient(session.publishableKey)

  return (
    <PortalProvider client={client} token={session.token}>
      <RoomChannel channelId={session.channelId} />
    </PortalProvider>
  )
}

function RoomChannel({ channelId }: { channelId: string }) {
  const { messages, send, presence, status, me, typing, sendTyping } = useChannel<string>({
    channelId,
  })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      await send({ content: text })
      setDraft('')
    } catch {
      // The failed message stays in the box so the teacher can retry it.
    } finally {
      setSending(false)
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    // The SDK throttles this itself — safe to call on every keystroke.
    if (value.trim()) sendTyping()
  }

  return (
    <div className={styles.room} data-testid="case-room" data-state={status}>
      <div className={styles.roomHeader}>
        <h4 className={styles.roomTitle}>Sala del equipo</h4>
        <span className={styles.presence}>{presence?.count ?? 0} conectados</span>
      </div>

      <ul className={styles.messages}>
        {messages.length === 0 && <li className={styles.empty}>Nadie ha escrito todavía.</li>}
        {messages.map((message) => (
          <li key={message.id} className={styles.message}>
            <span className={styles.messageAuthor}>
              {me && message.sender.id === me.id ? 'Tú' : `Colega #${message.sender.id.slice(-4)}`}
            </span>
            {message.content}
          </li>
        ))}
      </ul>

      <p className={styles.typing} aria-live="polite" data-testid="case-room-typing">
        {typing.length > 0 &&
          (typing.length === 1
            ? 'Alguien está escribiendo…'
            : `${typing.length} personas están escribiendo…`)}
      </p>

      <form className={styles.composer} onSubmit={handleSend}>
        <input
          type="text"
          value={draft}
          placeholder="Escribe un comentario…"
          disabled={sending}
          onChange={(event) => handleDraftChange(event.target.value)}
        />
        <button type="submit" className="btn-secondary" disabled={sending || !draft.trim()}>
          Enviar
        </button>
      </form>
    </div>
  )
}
