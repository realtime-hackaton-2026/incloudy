/**
 * Who is signed in, for the whole app.
 *
 * The token lives in localStorage so a reload does not throw the teacher back
 * to the login screen mid-case. It is trusted only after /auth/me confirms it,
 * which also covers the token expiring while the tab was closed.
 */

import { useCallback, useEffect, useState } from 'react'
import { AuthError, fetchCurrentUser, requestToken } from './api'
import type { Credentials } from './api'

const TOKEN_KEY = 'incloudy.token'

export interface Session {
  token: string
  email: string
}

export type SessionStatus =
  /** Checking a token left over from a previous visit. Nothing to show yet. */
  | 'restoring'
  /** Waiting on the login screen. */
  | 'anonymous'
  /** Credentials sent, no answer yet. */
  | 'signing-in'
  /** Signed in. */
  | 'active'

export interface SessionState {
  session: Session | null
  status: SessionStatus
  /** Last sign-in failure, in Spanish, or null. Cleared on the next attempt. */
  error: string | null
  signIn: (credentials: Credentials) => Promise<void>
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
      .then((email) => {
        if (!active) return
        setSession({ token, email })
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
      storeToken(token)
      setSession({ token, email: credentials.email })
      setStatus('active')
    } catch (cause) {
      setError(
        cause instanceof AuthError ? cause.message : 'No se pudo iniciar sesión.',
      )
      setStatus('anonymous')
    }
  }, [])

  const signOut = useCallback(() => {
    clearStoredToken()
    setSession(null)
    setError(null)
    setStatus('anonymous')
  }, [])

  return { session, status, error, signIn, signOut }
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
