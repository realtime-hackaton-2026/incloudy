/*
 * frontend/src/portal/api.ts // client for POST /portal/sessions/{caseId} —
 * a short-lived, channel-scoped Portal token, minted fresh per case per
 * teacher so the grant (connect vs connect+publish) always matches their
 * current role.
 */

import { apiFetch, authHeaders } from '../lib/http'

export interface PortalSession {
  token: string
  expiresAt: string
  channelId: string
  publishableKey: string
}

interface PortalSessionWire {
  token: string
  expires_at: string
  channel_id?: string
  publishable_key: string
}

export async function createPortalSession(token: string, caseId: string): Promise<PortalSession> {
  const response = await apiFetch(`/portal/sessions/${caseId}`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  const wire = (await response.json()) as PortalSessionWire
  const publishableKey = wire.publishable_key || import.meta.env.VITE_PORTAL_PUBLISHABLE_KEY || ''
  if (!wire.token || !wire.channel_id || !publishableKey) {
    throw new Error('La sesión de Portal está incompleta: faltan token, canal o publishable key.')
  }
  return {
    token: wire.token,
    expiresAt: wire.expires_at,
    channelId: wire.channel_id,
    publishableKey,
  }
}

export interface PortalUserSession {
  token: string
  expiresAt: string
  publishableKey: string
}

// User-scoped Portal token for the realtime inbox: no channel grants. The
// bell subscribes once per login instead of polling the backend REST API.
export async function createUserPortalSession(token: string): Promise<PortalUserSession> {
  const response = await apiFetch('/portal/sessions', {
    method: 'POST',
    headers: authHeaders(token),
  })
  const wire = (await response.json()) as PortalSessionWire
  const publishableKey = wire.publishable_key || import.meta.env.VITE_PORTAL_PUBLISHABLE_KEY || ''
  if (!wire.token || !publishableKey) {
    throw new Error('La sesión de Portal está incompleta: faltan token o publishable key.')
  }
  return {
    token: wire.token,
    expiresAt: wire.expires_at,
    publishableKey,
  }
}
