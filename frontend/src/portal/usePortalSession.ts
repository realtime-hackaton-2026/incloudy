/*
 * frontend/src/portal/usePortalSession.ts // fetches a case's Portal session
 * and re-fetches shortly before it expires. A 503 ("Portal no está
 * configurado en el servidor") is its own status rather than an error — it
 * means the feature is off, not that the request failed.
 */

import { useEffect, useState } from 'react'
import { ApiError } from '../lib/http'
import { createPortalSession } from './api'
import type { PortalSession } from './api'

export type PortalSessionStatus = 'loading' | 'ready' | 'unavailable' | 'error'

export interface PortalSessionState {
  session: PortalSession | null
  status: PortalSessionStatus
  error: string | null
}

/** Refresh this many milliseconds before the token expires. Floored so a very short TTL still gets one retry. */
const REFRESH_MARGIN_MS = 30_000

export function usePortalSession(token: string, caseId: string): PortalSessionState {
  const [session, setSession] = useState<PortalSession | null>(null)
  const [status, setStatus] = useState<PortalSessionStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  // Bumped to force a re-fetch when the scheduled refresh fires.
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    // No synchronous setStatus('loading') here — `status` already starts
    // there for the first run, and a `generation` bump (the scheduled
    // token refresh) deliberately does NOT flip it back: swapping a token
    // behind the scenes shouldn't flash the room back to a loading state
    // the teacher never asked for.
    let active = true
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    createPortalSession(token, caseId)
      .then((loaded) => {
        if (!active) return
        setSession(loaded)
        setStatus('ready')

        const expiresInMs = new Date(loaded.expiresAt).getTime() - Date.now()
        const delay = Math.max(expiresInMs - REFRESH_MARGIN_MS, REFRESH_MARGIN_MS)
        if (Number.isFinite(delay)) {
          refreshTimer = setTimeout(() => {
            if (active) setGeneration((g) => g + 1)
          }, delay)
        }
      })
      .catch((cause) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 503) {
          setStatus('unavailable')
          return
        }
        setError(
          cause instanceof ApiError ? cause.message : 'No se pudo abrir la sala en vivo.',
        )
        setStatus('error')
      })

    return () => {
      active = false
      if (refreshTimer) clearTimeout(refreshTimer)
    }
  }, [token, caseId, generation])

  return { session, status, error }
}
