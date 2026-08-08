/*
 * frontend/src/portal/client.ts // one Portal client per publishable key.
 * Construction is synchronous and opens no connection (confirmed in the
 * SDK's own docs), so memoizing here is just avoiding a second registry for
 * a project that only ever has one key.
 */

import { Portal } from '@portalsdk/core'

const clients = new Map<string, Portal>()

export function getPortalClient(apiKey: string): Portal {
  let client = clients.get(apiKey)
  if (!client) {
    client = new Portal({ apiKey })
    clients.set(apiKey, client)
  }
  return client
}
