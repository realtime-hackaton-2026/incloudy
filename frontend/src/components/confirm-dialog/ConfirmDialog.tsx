/**
 * A yes/no gate for actions that can't be undone: deleting a case,
 * publishing it, dropping a collaborator. Stays mounted and renders nothing
 * when `open` is false, so callers just flip a boolean — no portal needed
 * since it's already `position: fixed`.
 */

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import styles from './ConfirmDialog.module.css'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  /** The confirmed action is in flight: both buttons lock. */
  pending?: boolean
  /** Last confirmation failed: show why instead of closing silently. */
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'default',
  pending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className={styles.overlay} role="presentation" onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        data-testid="confirm-dialog"
        data-state={pending ? 'pending' : 'open'}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h2>
        {description && <div className={styles.description}>{description}</div>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? `btn-primary ${styles.confirmDanger}` : 'btn-primary'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Un momento…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
