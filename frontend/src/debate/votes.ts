/*
 * frontend/src/debate/votes.ts // the room's vote, derived from the channel
 * rather than stored: one ballot per teacher, the last one they cast wins.
 */

import type { AgentId } from './api'

/** Portal message type for a ballot. Kept apart from turns and comments. */
export const DEBATE_VOTE_EVENT = 'debate.vote'

export interface Ballot {
  voterId: string
  agente: AgentId
  at: number
}

export interface Tally {
  counts: Record<AgentId, number>
  total: number
  /** What this browser's own user last voted, if anything. */
  mine: AgentId | null
}

const EMPTY: Tally = { counts: { burix: 0, tero: 0 }, total: 0, mine: null }

/**
 * Later ballots replace earlier ones from the same voter, so changing your
 * mind moves the count instead of stuffing it. Portal replays channel
 * history to late joiners, so someone arriving mid-debate sees the tally as
 * it stands rather than starting from zero.
 */
export function tallyVotes(ballots: readonly Ballot[], myId?: string | null): Tally {
  if (!ballots.length) return EMPTY

  const latest = new Map<string, Ballot>()
  for (const ballot of ballots) {
    const previous = latest.get(ballot.voterId)
    if (!previous || ballot.at >= previous.at) latest.set(ballot.voterId, ballot)
  }

  const counts: Record<AgentId, number> = { burix: 0, tero: 0 }
  for (const ballot of latest.values()) {
    if (ballot.agente in counts) counts[ballot.agente] += 1
  }

  return {
    counts,
    total: counts.burix + counts.tero,
    mine: (myId && latest.get(myId)?.agente) || null,
  }
}

/** Whole percent, and 0 when nobody has voted — never NaN in the bar width. */
export function sharePercent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}
