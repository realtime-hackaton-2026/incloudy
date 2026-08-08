/*
 * frontend/src/debate/useDebate.ts // runs debate rounds and publishes each
 * turn to the case channel, so the whole room watches it unfold live.
 */

import { useCallback, useState } from 'react'
import { ApiError } from '../lib/http'
import { requestDebateRound } from './api'
import type { DebateAgent, DebateTurn } from './api'

/** Portal message type. Keeps agent turns distinct from human comments. */
export const DEBATE_TURN_EVENT = 'debate.turn'

export type DebateStatus = 'idle' | 'thinking' | 'error'

export interface DebateState {
  turns: readonly DebateTurn[]
  agents: readonly DebateAgent[]
  status: DebateStatus
  error: string | null
  round: number
  maxRounds: number
  commentsRead: number
  /** Accepts a turn that arrived over Portal rather than from our request. */
  receiveTurn: (turn: DebateTurn) => void
  runRound: () => Promise<void>
  reset: () => void
}

export interface UseDebateOptions {
  token: string
  caseId: string
  /**
    * Publishes a turn to the channel. Injected because the component owns
    * the channel, not the hook — which also lets the hook be tested without
    * Portal in front of it.
    */
  publish?: (turn: DebateTurn) => Promise<unknown>
}

function turnKey(turn: DebateTurn): string {
  return `${turn.ronda}:${turn.agente}`
}

export function useDebate({ token, caseId, publish }: UseDebateOptions): DebateState {
  const [turns, setTurns] = useState<DebateTurn[]>([])
  const [agents, setAgents] = useState<DebateAgent[]>([])
  const [status, setStatus] = useState<DebateStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [maxRounds, setMaxRounds] = useState(3)
  const [commentsRead, setCommentsRead] = useState(0)

  /*
   * A turn can arrive twice: once as our own response, once echoed back off
   * the channel. Round + agent identifies it, so dedupe on that key rather
   * than accumulating duplicates.
   */
  const receiveTurn = useCallback((turn: DebateTurn) => {
    setTurns((current) =>
      current.some((item) => turnKey(item) === turnKey(turn)) ? current : [...current, turn],
    )
  }, [])

  const runRound = useCallback(async () => {
    setStatus('thinking')
    setError(null)
    try {
      const nextRound = turns.length === 0 ? 1 : Math.floor(turns.length / 2) + 1
      const result = await requestDebateRound(token, caseId, nextRound, turns)
      setAgents(result.agentes)
      setMaxRounds(result.rondasMaximas)
      setCommentsRead(result.comentariosAnalizados)
      for (const turn of result.turnos) {
        receiveTurn(turn)
        // If publishing fails the turn is already on screen for whoever
        // started the round; the room must not stall the debate.
        await publish?.(turn).catch(() => undefined)
      }
      setStatus('idle')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof ApiError ? cause.message : 'No se pudo abrir el debate.')
    }
  }, [token, caseId, turns, publish, receiveTurn])

  const reset = useCallback(() => {
    setTurns([])
    setStatus('idle')
    setError(null)
  }, [])

  const round = Math.floor(turns.length / 2)

  return {
    turns,
    agents,
    status,
    error,
    round,
    maxRounds,
    commentsRead,
    receiveTurn,
    runRound,
    reset,
  }
}
