/**
 * Account creation. Same shell as Login (see ../auth-screen) — this screen
 * only adds a password confirmation, since /auth/register logs the new
 * teacher in immediately and there's no separate verification step.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthScreen } from '../auth-screen'
import styles from '../auth-screen/AuthScreen.module.css'

export interface RegistroProps {
  onSubmit: (credentials: { email: string; password: string }) => void
  pending?: boolean
  /** Last failure, already in Spanish — from the server, or from the local mismatch check. */
  error?: string | null
  onSwitchToLogin: () => void
}

const MIN_PASSWORD_LENGTH = 8

export function Registro({ onSubmit, pending = false, error = null, onSwitchToLogin }: RegistroProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Only shown once both fields have something to compare — no red border
  // while the second field is still empty.
  const [localError, setLocalError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`El código secreto debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (password !== confirmPassword) {
      setLocalError('Los códigos no coinciden.')
      return
    }
    setLocalError(null)
    onSubmit({ email: email.trim(), password })
  }

  const shownError = localError ?? error

  return (
    <AuthScreen tagline="Crea tu cuenta de profesor">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="registro-email">
            ID de Explorador
          </label>
          <div className={styles.inputWrap}>
            <PersonIcon />
            <input
              className={styles.input}
              id="registro-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="tu@correo.com"
              value={email}
              disabled={pending}
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="registro-password">
            Código Secreto
          </label>
          <div className={styles.inputWrap}>
            <KeyIcon />
            <input
              className={styles.input}
              id="registro-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              disabled={pending}
              required
              minLength={MIN_PASSWORD_LENGTH}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="registro-confirm">
            Repite el Código Secreto
          </label>
          <div className={styles.inputWrap}>
            <KeyIcon />
            <input
              className={styles.input}
              id="registro-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              disabled={pending}
              required
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
        </div>

        {shownError && (
          <p className={styles.error} role="alert" aria-live="polite">
            <WarningIcon />
            {shownError}
          </p>
        )}

        <div className={styles.actions}>
          <button className={styles.submit} type="submit" disabled={pending}>
            <LoginIcon />
            {pending ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
          <button className={styles.help} type="button" onClick={onSwitchToLogin}>
            ¿Ya tienes cuenta? Inicia sesión
          </button>
        </div>
      </form>
    </AuthScreen>
  )
}

function PersonIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5Z" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15 3a6 6 0 1 0-5.7 8L7 13.3V16H4v3h5.7l6-6A6 6 0 0 0 15 3Zm1.5 5.5a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" />
    </svg>
  )
}

function LoginIcon() {
  return (
    <svg
      className={styles.submitIcon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8v-2h8V5h-8V3Z" />
      <path d="m10.6 7.4 4.6 4.6-4.6 4.6-1.4-1.4 2.2-2.2H3v-2h8.4L9.2 8.8l1.4-1.4Z" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg
      className={styles.errorIcon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2 1 21h22L12 2Zm1 14v2h-2v-2h2Zm0-7v5h-2V9h2Z" />
    </svg>
  )
}
