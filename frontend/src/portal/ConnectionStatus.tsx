/*
 * frontend/src/portal/ConnectionStatus.tsx // makes a degraded Portal socket
 * visible instead of silent.
 *
 * Portal's ChannelStatus carries four states that mean "what you see may be
 * stale" — reconnecting, degraded, degraded-http, blocked. They were being
 * written to `data-state` only, so a dropped socket looked exactly like a
 * quiet room. Each is announced here, and none of them blocks the UI: the
 * composer stays usable because `degraded-http` can still publish over HTTP.
 */

import { connectionNotice } from './connectionNotice'
import type { PortalConnectionStatus } from './connectionNotice'
import styles from './ConnectionStatus.module.css'

export interface ConnectionStatusProps {
  status: PortalConnectionStatus
  /** Names the surface for tests and for anyone reading the DOM. */
  testId?: string
}

export function ConnectionStatus({ status, testId = 'portal-connection' }: ConnectionStatusProps) {
  const notice = connectionNotice(status)
  if (!notice) return null

  return (
    <p
      className={`${styles.banner} ${notice.urgent ? styles.urgent : styles.transient}`}
      data-testid={testId}
      data-connection={status}
      role={notice.urgent ? 'alert' : 'status'}
      aria-live={notice.urgent ? 'assertive' : 'polite'}
    >
      <span className={styles.dot} aria-hidden="true" />
      {notice.text}
    </p>
  )
}
