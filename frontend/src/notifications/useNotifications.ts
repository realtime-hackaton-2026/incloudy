/*
 * frontend/src/notifications/useNotifications.ts // polling list of unread
 * notifications, refreshed on a fixed interval while the teacher is signed in.
 * Portal has no notification webhook, so a quiet poll is the honest transport.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './api'
import type { AppNotification } from './api'

const POLL_INTERVAL_MS = 15_000

export interface NotificationsState {
  unread: AppNotification[]
  unreadCount: number
  error: string | null
  markRead: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<void>
  refresh: () => Promise<void>
}

export function useNotifications(token?: string): NotificationsState {
  const [unread, setUnread] = useState<AppNotification[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const items = await fetchNotifications(token, true)
      setUnread(items)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las notificaciones.')
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    let active = true
    const poll = () => {
      fetchNotifications(token, true)
        .then((items) => {
          if (active) {
            setUnread(items)
            setError(null)
          }
        })
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las notificaciones.')
        })
    }
    poll()
    const interval = window.setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [token])

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!token) return
      await markNotificationRead(token, notificationId)
      setUnread((current) => current.filter((item) => item.id !== notificationId))
    },
    [token],
  )

  const markAllRead = useCallback(async () => {
    if (!token) return
    await markAllNotificationsRead(token)
    setUnread([])
  }, [token])

  return {
    unread,
    unreadCount: unread.length,
    error,
    markRead,
    markAllRead,
    refresh,
  }
}
