/*
 * frontend/src/chat/CaseChat.tsx // the Gemini assistant for one case —
 * private to whoever is asking, unlike the team's Portal room. Deliberately
 * styled and labelled to never be mistaken for that other chat: cool blue
 * instead of parchment, "solo tú ves esta conversación" spelled out, no
 * presence or collaborator UI at all (there's no "team" here to show).
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useChat } from './useChat'
import styles from './CaseChat.module.css'

export interface CaseChatProps {
  token: string
  caseId: string
}

export function CaseChat({ token, caseId }: CaseChatProps) {
  const { turns, status, error, ask } = useChat(token, caseId)
  const [draft, setDraft] = useState('')

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = draft.trim()
    if (!question) return
    setDraft('')
    await ask(question)
  }

  return (
    <div className={styles.chat} data-testid="case-chat" data-state={status}>
      <div className={styles.chatHeader}>
        <h4 className={styles.chatTitle}>Asistente de IA</h4>
        <span className={styles.chatHint}>Privado — solo tú ves esta conversación</span>
      </div>

      <ul className={styles.turns}>
        {turns.length === 0 && (
          <li className={styles.empty}>Pregúntale al asistente sobre este caso.</li>
        )}
        {turns.map((turn) => (
          <li
            key={turn.id}
            className={turn.role === 'profesor' ? styles.turnProfesor : styles.turnAsistente}
          >
            {turn.text}
          </li>
        ))}
        {status === 'asking' && <li className={styles.asking}>Pensando…</li>}
      </ul>

      {status === 'error' && (
        <p className={`${styles.state} ${styles.stateError}`} role="alert">
          {error}
        </p>
      )}

      <form className={styles.composer} onSubmit={handleAsk}>
        <input
          type="text"
          value={draft}
          placeholder="Pregunta algo sobre este caso…"
          disabled={status === 'asking'}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          className={styles.askButton}
          disabled={status === 'asking' || !draft.trim()}
        >
          Preguntar
        </button>
      </form>
    </div>
  )
}
