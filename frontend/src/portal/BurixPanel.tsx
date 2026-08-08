/*
 * frontend/src/portal/BurixPanel.tsx // private per-teacher AI analysis of a
 * case and its live room comments, shareable to the room as burix_analysis.
 * Also the place to ask Búrix about the student: it works solo, with the room
 * closed and without a publish grant, because the answer never hits a channel.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FormEvent } from 'react'
import { askAssistant, requestCaseAnalysis } from '../chat/api'
import type { CaseAnalysis } from '../chat/api'
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
            <span className={styles.eyebrow}>ANÁLISIS PRIVADO · IA DEL EQUIPO</span>
            <h2 id="burix-title">Búrix analiza el caso</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar análisis de Búrix">×</button>
        </div>

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
          <>
            <p className={styles.meta} data-testid="burix-meta">
              Analizando {analysis.comentarios_analizados} {analysis.comentarios_analizados === 1 ? 'comentario' : 'comentarios'} de la sala en tiempo real
            </p>
            <div className={styles.body} data-testid="burix-analysis">{analysis.analisis}</div>
            <div className={styles.actions}>
              <button type="button" className="btn-primary" disabled={sharing}
                onClick={() => {
                  setSharing(true)
                  onShare(analysis.analisis)
                }}>
                {sharing ? 'Compartiendo…' : 'Compartir con la sala'}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}

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

        {exchanges.length > 0 && (
          <ul className={styles.exchanges} data-testid="burix-exchanges">
            {exchanges.map((item) => (
              <li key={`${item.pregunta}`} className={styles.exchange}>
                <p className={styles.exchangeQuestion}>{item.pregunta}</p>
                <p className={styles.exchangeAnswer}>{item.respuesta}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>,
    document.body,
  )
}
