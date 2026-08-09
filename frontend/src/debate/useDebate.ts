/*
 * frontend/src/debate/useDebate.ts // runs debate rounds and publishes each
 * turn to the case channel, so the whole room watches it unfold live.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/http'
import { requestDebateRound } from './api'
import type { DebateAgent, DebateTurn } from './api'

/** Portal message type. Keeps agent turns distinct from human comments. */
export const DEBATE_TURN_EVENT = 'debate.turn'

/**
 * Marks "everything before this no longer counts".
 *
 * A restart cannot be local-only: live turns are derived from channel
 * history, so clearing one client's state would leave the debate on screen
 * for everyone else — and back on screen for that client after any
 * re-render. Publishing the restart is what makes it true for the room.
 * Same shape as the session control messages in `portal/CaseRoom.tsx`.
 */
export const DEBATE_RESET_EVENT = 'debate.reset'

export type DebateStatus = 'idle' | 'thinking' | 'replying' | 'error'

/**
 * How long the room waits between the two agents of a round.
 *
 * The backend answers a whole round at once, so without this both stances
 * land in the same frame and read as one block rather than a reply. The
 * pause is presentation, not latency: it is applied on publish too, so
 * spectators see the same beat instead of a burst.
 */
export const REPLY_DELAY_MS = 2_600

export interface DebateState {
  turns: readonly DebateTurn[]
  agents: readonly DebateAgent[]
  status: DebateStatus
  error: string | null
  round: number
  maxRounds: number
  commentsRead: number
  /** The agent whose turn is composed but still held back. */
  pendingAgent: DebateAgent | null
  /** Accepts a turn that arrived over Portal rather than from our request. */
  receiveTurn: (turn: DebateTurn) => void
  /** Pass the merged view in a live room; defaults to this hook's own turns. */
  runRound: (history?: readonly DebateTurn[]) => Promise<void>
  /** Clears local round state. The channel marker is the caller's job. */
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
  /** Overridable so tests do not wait out the real pause. */
  replyDelayMs?: number
}

function turnKey(turn: DebateTurn): string {
  return `${turn.ronda}:${turn.agente}`
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}

export function useDebate({
  token,
  caseId,
  publish,
  replyDelayMs = REPLY_DELAY_MS,
}: UseDebateOptions): DebateState {
  const [turns, setTurns] = useState<DebateTurn[]>([])
  const [agents, setAgents] = useState<DebateAgent[]>([])
  const [status, setStatus] = useState<DebateStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [maxRounds, setMaxRounds] = useState(3)
  const [commentsRead, setCommentsRead] = useState(0)
  const [pendingAgent, setPendingAgent] = useState<DebateAgent | null>(null)

  // A round resolves across several awaits, so it can outlive the component.
  // Every setState after an await checks this first.
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

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

  /*
   * `history` is the caller's authoritative view of the debate so far — in a
   * live room that is the channel's turns merged with ours, not just ours.
   * Without it a spectator (whose local `turns` is empty) would ask for
   * round 1 again and argue a round the room already heard.
   */
  const runRound = useCallback(async (history: readonly DebateTurn[] = turns) => {
    setStatus('thinking')
    setError(null)
    try {
      const nextRound = history.length === 0 ? 1 : Math.floor(history.length / 2) + 1
      const result = await requestDebateRound(token, caseId, nextRound, history)
      setAgents(result.agentes)
      setMaxRounds(result.rondasMaximas)
      setCommentsRead(result.comentariosAnalizados)

      for (const [index, turn] of result.turnos.entries()) {
        if (index > 0) {
          // Announce who is answering before holding the turn back, so the
          // wait reads as a reply being written rather than a stall.
          const speaker = result.agentes.find((agent) => agent.id === turn.agente) ?? null
          if (!alive.current) return
          setPendingAgent(speaker)
          setStatus('replying')
          await wait(replyDelayMs)
          if (!alive.current) return
          setPendingAgent(null)
        }
        receiveTurn(turn)
        // If publishing fails the turn is already on screen for whoever
        // started the round; the room must not stall the debate.
        await publish?.(turn).catch(() => undefined)
      }
      if (!alive.current) return
      setStatus('idle')
    } catch (cause) {
      if (!alive.current) return
      setPendingAgent(null)
      setStatus('error')
      setError(cause instanceof ApiError ? cause.message : 'No se pudo abrir el debate.')
    }
  }, [token, caseId, turns, publish, receiveTurn, replyDelayMs])

  const reset = useCallback(() => {
    setTurns([])
    setStatus('idle')
    setError(null)
    setPendingAgent(null)
    // Describes the round that was just discarded, so it goes with it.
    // `agents` and `maxRounds` are template configuration, not round state:
    // keeping them avoids the stances flickering back to the defaults.
    setCommentsRead(0)
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
    pendingAgent,
    receiveTurn,
    runRound,
    reset,
  }
}
