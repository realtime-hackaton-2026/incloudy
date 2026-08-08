/**
 * The first screen: nothing else renders until someone signs in.
 *
 * Presentational, like the case map — it collects two fields and hands them
 * over. Whether that call hits the API, a mock or a demo fixture is the
 * caller's business.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import mapArt from '../../assets/images/fondo.png'
import logo from '../../assets/images/logo.webp'
import styles from './Login.module.css'

export interface LoginProps {
  onSubmit: (credentials: { email: string; password: string }) => void
  /** Credentials are in flight: the form locks and the button says so. */
  pending?: boolean
  /** Last failure, already in Spanish. */
  error?: string | null
}

export function Login({ onSubmit, pending = false, error = null }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    onSubmit({ email: email.trim(), password })
  }

  return (
    <div className={styles.screen}>
      <div
        className={styles.backdrop}
        style={{ backgroundImage: `url(${mapArt})` }}
        aria-hidden="true"
      />
      <div className={styles.veil} aria-hidden="true" />

      <div className={styles.panel}>
        <div className={styles.paper}>
          <span className={`${styles.corner} ${styles.cornerTopLeft}`} aria-hidden="true" />
          <span className={`${styles.corner} ${styles.cornerTopRight}`} aria-hidden="true" />
          <span
            className={`${styles.corner} ${styles.cornerBottomLeft}`}
            aria-hidden="true"
          />
          <span
            className={`${styles.corner} ${styles.cornerBottomRight}`}
            aria-hidden="true"
          />

          <div className={styles.branding}>
            <img className={styles.logo} src={logo} alt="" />
            <h1 className={styles.wordmark}>incloudy</h1>
            <p className={styles.tagline}>Un lugar acogedor para aprender</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-email">
                ID de Explorador
              </label>
              <div className={styles.inputWrap}>
                <PersonIcon />
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
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-password">
                Código Secreto
              </label>
              <div className={styles.inputWrap}>
                <KeyIcon />
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
                <LoginIcon />
                {pending ? 'Entrando…' : 'Entrar al mapa'}
              </button>
              <a className={styles.help} href="#recuperar-codigo">
                ¿Olvidaste el código?
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/*
 * The mockup pulled these from the Material Symbols web font. Inlining them
 * drops a render-blocking request and keeps the form readable offline.
 */

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
