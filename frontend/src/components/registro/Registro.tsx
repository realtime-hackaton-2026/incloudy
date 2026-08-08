/**
 * Account creation. Same panel and choreography as Login (see
 * ../auth-screen) — this screen only adds a password confirmation, since
 * /auth/register signs the new teacher in immediately.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthScreen, ArrowIcon, KeyIcon, PersonIcon, WarningIcon } from '../auth-screen'
import styles from '../auth-screen/AuthScreen.module.css'

export interface RegistroProps {
  onSubmit: (credentials: { email: string; password: string }) => void
  pending?: boolean
  /** Last failure, already in Spanish — from the server, or the local check. */
  error?: string | null
  onSwitchToLogin: () => void
  onFocusChange?: (focused: boolean) => void
  showCurtain?: boolean
}

const MIN_PASSWORD_LENGTH = 8

export function Registro({
  onSubmit,
  pending = false,
  error = null,
  onSwitchToLogin,
  onFocusChange,
  showCurtain,
}: RegistroProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    <AuthScreen
      tagline="Un lugar acogedor para aprender"
      prompt="Empieza tu primera aventura"
      onFocusChange={onFocusChange}
      showCurtain={showCurtain}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="registro-email">
            ID de Explorador
          </label>
          <div className={styles.inputWrap}>
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
            <PersonIcon />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="registro-password">
            Código Secreto
          </label>
          <div className={styles.inputWrap}>
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
            <KeyIcon />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="registro-confirm">
            Repite el Código
          </label>
          <div className={styles.inputWrap}>
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
            <KeyIcon />
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
            {pending ? 'Creando cuenta…' : 'Crear cuenta'}
            <ArrowIcon />
          </button>
          <button className={styles.help} type="button" onClick={onSwitchToLogin}>
            ¿Ya tienes cuenta? Inicia sesión
          </button>
        </div>
      </form>
    </AuthScreen>
  )
}
