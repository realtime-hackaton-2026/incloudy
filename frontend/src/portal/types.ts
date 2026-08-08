export type PortalRoomMessageType = 'chat' | 'session_started' | 'session_closed' | 'ai_question' | 'ai_answer'

export interface ChatMessage {
  body: string
  /** System events share the same Portal channel but are never rendered as chat. */
  type?: PortalRoomMessageType
}
