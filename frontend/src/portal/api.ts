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
  channel_id: string
  publishable_key: string
}

export async function createPortalSession(token: string, caseId: string): Promise<PortalSession> {
  const response = await apiFetch(`/portal/sessions/${caseId}`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  const wire = (await response.json()) as PortalSessionWire
  return {
    token: wire.token,
    expiresAt: wire.expires_at,
    channelId: wire.channel_id,
    publishableKey: wire.publishable_key,
  }
}
