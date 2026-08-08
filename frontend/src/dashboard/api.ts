import { apiFetch, authHeaders } from '../lib/http'

export interface CaseEvent {
  id: string
  caseId: string
  userId: string
  event: string
  details: Record<string, unknown>
  createdAt: string
}

interface CaseEventWire {
  _id?: string
  id?: string
  case_id: string
  user_id: string
  event: string
  details: Record<string, unknown>
  created_at: string
}

export interface PortalComment {
  id: string
  messageId: string
  caseId: string
  authorId: string
  content: Record<string, unknown>
  portalTimestamp: string
}

interface PortalCommentWire {
  _id?: string
  id?: string
  message_id: string
  case_id: string
  author_id: string
  content: Record<string, unknown>
  portal_timestamp: string
  retracted: boolean
}

export async function listCaseEvents(token: string, caseId: string): Promise<CaseEvent[]> {
  const response = await apiFetch(`/cases/${caseId}/events`, { headers: authHeaders(token) })
  const items = (await response.json()) as CaseEventWire[]
  return items.map((item) => ({
    id: item.id ?? item._id ?? crypto.randomUUID(),
    caseId: item.case_id,
    userId: item.user_id,
    event: item.event,
    details: item.details ?? {},
    createdAt: item.created_at,
  }))
}

export async function listCaseComments(token: string, caseId: string): Promise<PortalComment[]> {
  const response = await apiFetch(`/cases/${caseId}/comments`, { headers: authHeaders(token) })
  const items = (await response.json()) as PortalCommentWire[]
  return items
    .filter((item) => !item.retracted)
    .map((item) => ({
      id: item.id ?? item._id ?? crypto.randomUUID(),
      messageId: item.message_id,
      caseId: item.case_id,
      authorId: item.author_id,
      content: item.content ?? {},
      portalTimestamp: item.portal_timestamp,
    }))
}
