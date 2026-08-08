/*
 * frontend/src/portal/BurixPanel.tsx // private per-teacher conversation with
 * Búrix: the case analysis is the opening message, follow-up questions hang
 * below it. Works solo, with the room closed and without a publish grant,
 * because the answer never hits a channel.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FormEvent } from 'react'
import { askAssistant, requestCaseAnalysis } from '../chat/api'
import type { CaseAnalysis } from '../chat/api'
import { RichText } from '../chat/RichText'
import logo from '../assets/images/logo.webp'
import styles from './BurixPanel.module.css'

export interface BurixPanelProps {
  token: string
  caseId: string
  open: boolean
  onClose: () => void
  onShare: (analysis: string) => void
}

interface Exchange {
  pregunta: string
  respuesta: string
}

export function BurixPanel({ token, caseId, open, onClose, onShare }: BurixPanelProps) {
  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  // Each open is a fresh analysis: a stale answer for an older case would be
  // actively misleading, so a ref guards against double-fetch on re-open.
  const lastCaseId = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (lastCaseId.current === caseId) return
    lastCaseId.current = caseId
    setState('loading')
    setError(null)
    void requestCaseAnalysis(token, caseId)
      .then((result) => {
        setAnalysis(result)
        setState('ready')
      })
      .catch((cause: unknown) => {
        setState('error')
        setError(cause instanceof Error ? cause.message : 'Búrix no pudo analizar el caso.')
      })
  }, [open, token, caseId])

  useEffect(() => {
    if (!open) return
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [open, onClose])

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = question.trim()
    if (!text || asking) return
    setAsking(true)
    setAskError(null)
    try {
      const respuesta = await askAssistant(token, text, caseId)
      setExchanges((current) => [...current, { pregunta: text, respuesta }])
      setQuestion('')
    } catch (cause) {
      setAskError(cause instanceof Error ? cause.message : 'Búrix no pudo responder.')
    } finally {
      setAsking(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="burix-title"
        onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.heading}>
          <img className={styles.avatar} src={logo} alt="" />
          <div>
            <span className={styles.eyebrow}>PRIVADO · BÚRIX Y TÚ</span>
            <h2 id="burix-title">Conversa con Búrix</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar conversación con Búrix">×</button>
        </div>

        <div className={styles.conversation}>
          {state === 'loading' && (
            <p className={styles.status} role="status" data-testid="burix-status">
              Búrix está leyendo el caso y la sala…
            </p>
          )}

          {state === 'error' && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
              <button type="button" className={styles.retry} onClick={() => {
                lastCaseId.current = null
                setState('loading')
                setError(null)
                void requestCaseAnalysis(token, caseId)
                  .then((result) => {
                    setAnalysis(result)
                    setState('ready')
                  })
                  .catch((cause: unknown) => {
                    setState('error')
                    setError(cause instanceof Error ? cause.message : 'Búrix no pudo analizar el caso.')
                  })
              }}>
                Reintentar
              </button>
            </div>
          )}

          {state === 'ready' && analysis && (
            <article className={`${styles.bubble} ${styles.burixBubble}`}>
              <span className={styles.bubbleAuthor}>Búrix · análisis del caso</span>
              <p className={styles.meta} data-testid="burix-meta">
                {analysis.comentarios_analizados} {analysis.comentarios_analizados === 1 ? 'comentario' : 'comentarios'} de la sala
              </p>
              <div className={styles.bubbleBody} data-testid="burix-analysis">
                <RichText text={analysis.analisis} />
              </div>
              <button type="button" className={styles.bubbleShare} disabled={sharing}
                onClick={() => {
                  setSharing(true)
                  onShare(analysis.analisis)
                }}>
                {sharing ? 'Compartiendo…' : 'Compartir con la sala'}
              </button>
            </article>
          )}

          {exchanges.length > 0 && (
            <div data-testid="burix-exchanges">
              {exchanges.map((item) => (
                <div key={`${item.pregunta}`} className={styles.exchange}>
                  <article className={`${styles.bubble} ${styles.teacherBubble}`}>
                    <span className={styles.bubbleAuthor}>Tú</span>
                    <p className={styles.bubbleBody}>{item.pregunta}</p>
                  </article>
                  <article className={`${styles.bubble} ${styles.burixBubble}`}>
                    <span className={styles.bubbleAuthor}>Búrix</span>
                    <div className={styles.bubbleBody}>
                      <RichText text={item.respuesta} />
                    </div>
                  </article>
                </div>
              ))}
            </div>
          )}
        </div>

        <form className={styles.ask} onSubmit={handleAsk}>
          <label htmlFor="burix-question" className={styles.askLabel}>
            Pregúntale a Búrix sobre el caso
          </label>
          <div className={styles.askRow}>
            <input
              id="burix-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ej. ¿me gustaría saber datos de Pablo?"
              maxLength={500}
              aria-label="Pregunta privada a Búrix"
            />
            <button type="submit" className="btn-primary" disabled={asking || !question.trim()}>
              {asking ? 'Pensando…' : 'Preguntar'}
            </button>
          </div>
          <p className={styles.askHint}>Respuesta privada: nadie más en la sala la ve.</p>
          {askError && <p className={styles.askError} role="alert">{askError}</p>}
        </form>
      </section>
    </div>,
    document.body,
  )
}
