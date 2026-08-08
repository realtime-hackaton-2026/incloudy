/*
 * frontend/src/auth/useSession.ts // who is signed in, for the whole app. The
 * token lives in localStorage so a reload does not throw the teacher back to
 * the login screen mid-case; it's trusted only after /auth/me confirms it,
 * which also covers the token expiring while the tab was closed.
 */

import { useCallback, useEffect, useState } from 'react'
import { registerAccount, fetchCurrentUser, requestToken } from './api'
import type { Credentials } from './api'
import { ApiError } from '../lib/http'

const TOKEN_KEY = 'incloudy.token'

export interface Session {
  token: string
  email: string
  userId: string
}

export type SessionStatus =
  /** Checking a token left over from a previous visit. Nothing to show yet. */
  | 'restoring'
  /** Waiting on the login or registro screen. */
  | 'anonymous'
  /** Credentials sent, no answer yet. */
  | 'signing-in'
  /** Signed in. */
  | 'active'

export interface SessionState {
  session: Session | null
  status: SessionStatus
  /** Last sign-in/registro failure, in Spanish, or null. Cleared on the next attempt. */
  error: string | null
  /** Resolves true when the session started — the caller uses that to play
      the entrance transition, which an effect watching `session` could not
      tell apart from restoring a stored token on reload. */
  signIn: (credentials: Credentials) => Promise<boolean>
  signUp: (credentials: Credentials) => Promise<boolean>
  signOut: () => void
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null)
  // Decided during the first render, not in the effect below: with no token to
  // check there is nothing to restore, and going through 'restoring' would only
  // cost an extra render and a flash of the wrong screen.
  const [status, setStatus] = useState<SessionStatus>(() =>
    readStoredToken() ? 'restoring' : 'anonymous',
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = readStoredToken()
    if (!token) return

    // StrictMode runs this twice in development; the flag keeps the unmounted
    // first pass from writing state after the second one already did.
    let active = true
    fetchCurrentUser(token)
      .then((user) => {
        if (!active) return
        setSession({ token, email: user.email, userId: user.id })
        setStatus('active')
      })
      .catch(() => {
        if (!active) return
        // A stored token that /auth/me rejects is dead weight. Drop it silently:
        // the teacher did not just type anything, so there is no error to report.
        clearStoredToken()
        setStatus('anonymous')
      })

    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (credentials: Credentials) => {
    setStatus('signing-in')
    setError(null)
    try {
      const token = await requestToken(credentials)
      const user = await fetchCurrentUser(token)
      storeToken(token)
      setSession({ token, email: user.email, userId: user.id })
      setStatus('active')
      return true
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo iniciar sesión.')
      setStatus('anonymous')
      return false
    }
  }, [])

  const signUp = useCallback(async (credentials: Credentials) => {
    setStatus('signing-in')
    setError(null)
    try {
      const token = await registerAccount(credentials)
      const user = await fetchCurrentUser(token)
      storeToken(token)
      setSession({ token, email: user.email, userId: user.id })
      setStatus('active')
      return true
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo crear la cuenta.')
      setStatus('anonymous')
      return false
    }
  }, [])

  const signOut = useCallback(() => {
    clearStoredToken()
    setSession(null)
    setError(null)
    setStatus('anonymous')
  }, [])

  return { session, status, error, signIn, signUp, signOut }
}

// Private browsing and locked-down browsers make localStorage throw rather than
// return null. Losing persistence is fine; crashing the app over it is not.

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Session lasts until the tab closes. Nothing else changes.
  }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing was stored to begin with.
  }
}
