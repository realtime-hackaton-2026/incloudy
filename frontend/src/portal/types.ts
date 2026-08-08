export type PortalRoomMessageType = 'chat' | 'session_started' | 'session_closed' | 'ai_question' | 'ai_answer' | 'burix_analysis' | 'burix_reaction'

export interface ChatMessage {
  body: string
  /** App identity travels with chat so standard Portal channels never lose the display name. */
  authorUserId?: string
  authorName?: string
  /** System events share the same Portal channel but are never rendered as chat. */
  type?: PortalRoomMessageType
}
