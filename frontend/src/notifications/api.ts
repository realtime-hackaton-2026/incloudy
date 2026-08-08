/*
 * frontend/src/notifications/api.ts // client for GET /notifications and the
 * read markers. The backend already emits "Recorrido actualizado" when a
 * station advances; this is the UI side.
 */

import { apiFetch, jsonHeaders } from '../lib/http'

export interface AppNotification {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  case_id?: string | null
  read_at?: string | null
  created_at: string
}

export async function fetchNotifications(
  token: string,
  unreadOnly: boolean,
): Promise<AppNotification[]> {
  const response = await apiFetch(`/notifications?unread_only=${unreadOnly}`, {
    headers: jsonHeaders(token),
  })
  return (await response.json()) as AppNotification[]
}

export async function markNotificationRead(token: string, notificationId: string): Promise<void> {
  await apiFetch(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PUT',
    headers: jsonHeaders(token),
  })
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await apiFetch('/notifications/read-all', {
    method: 'PUT',
    headers: jsonHeaders(token),
  })
}
