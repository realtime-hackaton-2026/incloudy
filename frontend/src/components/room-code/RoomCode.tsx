/*
 * frontend/src/components/room-code/RoomCode.tsx // the six-character room
 * code, on both sides: copy it to share, paste it to enter.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { normaliseCode } from './code'
import styles from './RoomCode.module.css'

/** How long the "copied" confirmation stays up. */
const COPIED_MS = 1_800

export interface CodeChipProps {
  code: string
  label?: string
}

/**
 * The owner's view: the code plus a one-click copy.
 *
 * The confirmation replaces the icon rather than appearing beside it, so the
 * control never changes width and the row does not jump when it fires.
 */
export function CodeChip({ code, label = 'Código' }: CodeChipProps) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setFailed(false)
    } catch {
      // Denied permission or an insecure origin. Saying so beats a button
      // that silently does nothing — the code is on screen to copy by hand.
      setFailed(true)
      setCopied(false)
    }
    timer.current = setTimeout(() => {
      setCopied(false)
      setFailed(false)
    }, COPIED_MS)
  }, [code])

  return (
    <span className={styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <code className={styles.chipCode}>{code}</code>
      <button
        type="button"
        className={styles.copyButton}
        onClick={() => void copy()}
        aria-label={copied ? 'Código copiado' : `Copiar el código ${code}`}
        data-testid="room-code-copy"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      {/* Announced, not just drawn: the icon swap alone is invisible to a
          screen reader. */}
      <span className={styles.srStatus} role="status">
        {copied ? 'Código copiado' : failed ? 'No se pudo copiar el código' : ''}
      </span>
      {failed && <span className={styles.copyHint}>Copia el código a mano.</span>}
    </span>
  )
}

export interface CodeInputProps {
  value: string
  onChange: (code: string) => void
  id?: string
  label?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * The guest's view: right-click pastes the code straight in.
 *
 * A code arrives copied from a message, so the default path is right-click →
 * find Paste → click. Reading the clipboard on `contextmenu` collapses that
 * to one action. The read can be refused (permission, or a non-secure
 * origin), and by then the native menu is already suppressed — so a refusal
 * says how to paste manually instead of failing silently.
 */
export function CodeInput({
  value,
  onChange,
  id,
  label = 'Código de la sala',
  placeholder = 'ABC123',
  className,
  disabled,
}: CodeInputProps) {
  const [hint, setHint] = useState<string | null>(null)

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      const code = normaliseCode(text)
      if (!code) {
        setHint('No hay ningún código en el portapapeles.')
        return
      }
      onChange(code)
      setHint(null)
    } catch {
      setHint('Pega el código con Ctrl + V.')
    }
  }, [onChange])

  return (
    <span className={`${styles.inputWrap} ${className ?? ''}`}>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(normaliseCode(event.target.value))}
        onContextMenu={(event) => {
          if (disabled) return
          event.preventDefault()
          void pasteFromClipboard()
        }}
        placeholder={placeholder}
        aria-label={label}
        aria-describedby={hint ? `${id ?? 'room-code'}-hint` : undefined}
        autoComplete="off"
        maxLength={6}
        disabled={disabled}
        data-testid="room-code-input"
      />
      <span className={styles.pasteTip}>Clic derecho para pegar</span>
      {hint && (
        <span
          id={`${id ?? 'room-code'}-hint`}
          className={styles.pasteHint}
          role="status"
        >
          {hint}
        </span>
      )}
    </span>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <rect x="5.25" y="5.25" width="8" height="8" rx="1.6"
        fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.75 2.75H3.9c-.63 0-1.15.52-1.15 1.15v6.85"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
