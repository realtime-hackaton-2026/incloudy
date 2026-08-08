/*
 * frontend/src/components/app-header/InboxBell.tsx // notification bell on the
 * Portal inbox: one user-scoped token per sign-in, zero polling, read state
 * flipped through the SDK store (per-item markAsRead), not the REST API.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { PortalProvider, useInbox } from '@portalsdk/react'
import { getPortalClient } from '../../portal/client'
import { createUserPortalSession } from '../../portal/api'
import styles from './AppHeader.module.css'

// Dedicated client scope: a case-scoped client must never lend its channel
// grants to the inbox, nor the other way around.
const INBOX_SCOPE = 'inbox'

export interface InboxItemData {
  caseId: string
  mensaje: string
}

interface InboxBellProps {
  /** Signed Portal+API token. Absent or no env key: inert bell, no provider. */
  token?: string
}

export function InboxBell({ token }: InboxBellProps) {
  const [open, setOpen] = useState(false)
  const publishableKey = import.meta.env.VITE_PORTAL_PUBLISHABLE_KEY

  if (!token || !publishableKey) {
    return <BellButton unreadCount={0} />
  }

  const client = getPortalClient(publishableKey, INBOX_SCOPE)

  // Token callback so the SDK can re-resolve the credential after reconnect or
  // expiry; a fresh function identity does not reconnect (see @portalsdk/react).
  const fetchFreshPortalToken = async () => (await createUserPortalSession(token)).token

  return (
    <PortalProvider client={client} token={fetchFreshPortalToken}>
      <InboxPanel open={open} onToggle={setOpen} />
    </PortalProvider>
  )
}

function InboxPanel({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: (open: boolean) => void
}) {
  const { items, counter, markAllRead } = useInbox<InboxItemData>()
  const unread = items.filter((item) => !item.read)
  return (
    <>
      <BellButton unreadCount={counter} onClick={() => onToggle(!open)} />
      {open && createPortal(
        <div className={styles.notificationsBackdrop} role="presentation" onMouseDown={() => onToggle(false)}>
          <section className={styles.notificationsPanel} role="dialog" aria-modal="true" aria-labelledby="notifications-title"
            onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.settingsHeading}>
              <div><span>AVISOS</span><h2 id="notifications-title">Notificaciones</h2></div>
              <button type="button" onClick={() => onToggle(false)} aria-label="Cerrar notificaciones">×</button>
            </div>
            {unread.length === 0 && (
              <p className={styles.notificationsEmpty}>Sin avisos pendientes. Recibirás uno cuando un caso avance de estación.</p>
            )}
            <ul className={styles.notificationsList}>
              {unread.map((item) => (
                <li key={item.id} className={styles.notificationItem}>
                  <button type="button" className={styles.notificationBody} onClick={() => item.markAsRead()}>
                    <span className={styles.notificationDot} aria-hidden="true" />
                    <span className={styles.notificationCopy}>
                      <strong>{item.title}</strong>
                      <small>{item.data?.mensaje}</small>
                    </span>
                    <time>{new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.at))}</time>
                  </button>
                  <button type="button" className={styles.notificationDismiss} aria-label={`Descartar aviso: ${item.title ?? ''}`}
                    onClick={() => item.markAsRead()}>×</button>
                </li>
              ))}
            </ul>
            {unread.length > 0 && (
              <button type="button" className={styles.markAllRead} onClick={markAllRead}>
                Marcar todas como leídas
              </button>
            )}
          </section>
        </div>
      , document.body)}
    </>
  )
}

function BellButton({
  unreadCount,
  onClick,
}: {
  unreadCount: number
  onClick?: () => void
}) {
  return (
    <button type="button" className={styles.bell} aria-label="Abrir notificaciones"
      title="Notificaciones" onClick={onClick} data-unread={unreadCount}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unreadCount > 0 && (
        <span className={styles.bellBadge} data-testid="notifications-badge">{unreadCount}</span>
      )}
    </button>
  )
}
