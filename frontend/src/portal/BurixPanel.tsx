/*
 * frontend/src/portal/BurixPanel.tsx // private per-teacher AI analysis of a
 * case and its live room comments, shareable to the room as burix_analysis.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestCaseAnalysis } from '../chat/api'
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

export function BurixPanel({ token, caseId, open, onClose, onShare }: BurixPanelProps) {
  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
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
      </section>
    </div>,
    document.body,
  )
}
