/*
 * frontend/src/chat/useChat.ts // local turn history for the Gemini
 * assistant. The backend has no memory between calls, so "history" here is
 * purely what's shown on screen — each ask() only ever sends the latest
 * message, never the transcript.
 */

import { useState } from 'react'
import { ApiError } from '../lib/http'
import { askAssistant } from './api'

export interface ChatTurn {
  id: string
  role: 'profesor' | 'asistente'
  text: string
}

export type ChatStatus = 'idle' | 'asking' | 'error'

export interface ChatState {
  turns: readonly ChatTurn[]
  status: ChatStatus
  error: string | null
  ask: (mensaje: string) => Promise<void>
}

let nextId = 0
function turnId(): string {
  nextId += 1
  return `turn-${nextId}`
}

export function useChat(token: string, caseId?: string): ChatState {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  async function ask(mensaje: string) {
    const question = mensaje.trim()
    if (!question) return
    setTurns((current) => [...current, { id: turnId(), role: 'profesor', text: question }])
    setStatus('asking')
    setError(null)
    try {
      const respuesta = await askAssistant(token, question, caseId)
      setTurns((current) => [...current, { id: turnId(), role: 'asistente', text: respuesta }])
      setStatus('idle')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof ApiError ? cause.message : 'No se pudo contactar al asistente.')
    }
  }

  return { turns, status, error, ask }
}
