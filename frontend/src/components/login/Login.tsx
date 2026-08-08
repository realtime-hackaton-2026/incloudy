/**
 * The gateway. Nothing else renders until someone signs in.
 *
 * Presentational, like the case map — it collects two fields and hands them
 * over. Whether that call hits the API, a mock or a demo fixture is the
 * caller's business.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthScreen, ArrowIcon, KeyIcon, PersonIcon, WarningIcon } from '../auth-screen'
import styles from '../auth-screen/AuthScreen.module.css'

export interface LoginProps {
  onSubmit: (credentials: { email: string; password: string }) => void
  /** Credentials are in flight: the form locks and the button says so. */
  pending?: boolean
  /** Last failure, already in Spanish. */
  error?: string | null
  onSwitchToRegister: () => void
  onFocusChange?: (focused: boolean) => void
  showCurtain?: boolean
}

export function Login({
  onSubmit,
  pending = false,
  error = null,
  onSwitchToRegister,
  onFocusChange,
  showCurtain,
}: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    onSubmit({ email: email.trim(), password })
  }

  return (
    <AuthScreen
      tagline="Sigue el caso"
      onFocusChange={onFocusChange}
      showCurtain={showCurtain}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-email">
            ID de Explorador
          </label>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              id="login-email"
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
          <label className={styles.label} htmlFor="login-password">
            Código Secreto
          </label>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              disabled={pending}
              required
              onChange={(event) => setPassword(event.target.value)}
            />
            <KeyIcon />
          </div>
        </div>

        {error && (
          // Polite, not assertive: the message appears next to a control the
          // teacher is still holding, so it should not cut off the reader.
          <p className={styles.error} role="alert" aria-live="polite">
            <WarningIcon />
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button className={styles.submit} type="submit" disabled={pending}>
            {pending ? 'Entrando…' : 'Entrar al mapa'}
            <ArrowIcon />
          </button>
          <button className={styles.help} type="button" onClick={onSwitchToRegister}>
            ¿No tienes cuenta? Regístrate
          </button>
        </div>
      </form>
    </AuthScreen>
  )
}
