/**
 * One Portal client per publishable key + room scope. A client owns its token
 * source, so scoping it by channel prevents a previously mounted case from
 * leaking its Portal credential into another case.
 */
import { Portal } from '@portalsdk/core'

const clients = new Map<string, Portal>()

export function getPortalClient(apiKey: string, scope = 'default'): Portal {
  const key = `${apiKey}:${scope}`
  let client = clients.get(key)
  if (!client) {
    client = new Portal({ apiKey })
    clients.set(key, client)
  }
  return client
}
