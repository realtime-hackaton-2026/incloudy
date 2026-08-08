/*
 * frontend/src/test/debate-vote.test.tsx // the tally is derived, so the
 * rules that matter are: one ballot per teacher, the last one wins, and a
 * late joiner replaying history lands on the same numbers.
 */

import { describe, expect, it } from 'vitest'
import { sharePercent, tallyVotes } from '../debate'
import type { Ballot } from '../debate'

const ballot = (voterId: string, agente: 'burix' | 'tero', at: number): Ballot => ({
  voterId,
  agente,
  at,
})

describe('tallyVotes', () => {
  it('counts nothing, and never divides by zero, before anyone votes', () => {
    const tally = tallyVotes([])
    expect(tally.total).toBe(0)
    expect(tally.counts).toEqual({ burix: 0, tero: 0 })
    expect(sharePercent(tally.counts.burix, tally.total)).toBe(0)
  })

  it('counts one ballot per teacher, not one per message', () => {
    const tally = tallyVotes([
      ballot('u-1', 'burix', 1),
      ballot('u-2', 'tero', 2),
      ballot('u-3', 'burix', 3),
    ])
    expect(tally.counts).toEqual({ burix: 2, tero: 1 })
    expect(tally.total).toBe(3)
  })

  it('moves the count when a teacher changes their mind instead of adding a vote', () => {
    const tally = tallyVotes([ballot('u-1', 'burix', 1), ballot('u-1', 'tero', 5)])
    expect(tally.counts).toEqual({ burix: 0, tero: 1 })
    expect(tally.total).toBe(1)
  })

  it('takes the later ballot even if history replays out of order', () => {
    const tally = tallyVotes([ballot('u-1', 'tero', 9), ballot('u-1', 'burix', 2)])
    expect(tally.counts.tero).toBe(1)
    expect(tally.counts.burix).toBe(0)
  })

  it('reports the caller their own current vote so the button can show it', () => {
    const ballots = [ballot('u-1', 'burix', 1), ballot('u-2', 'tero', 2)]
    expect(tallyVotes(ballots, 'u-1').mine).toBe('burix')
    expect(tallyVotes(ballots, 'u-2').mine).toBe('tero')
    expect(tallyVotes(ballots, 'u-9').mine).toBeNull()
    expect(tallyVotes(ballots).mine).toBeNull()
  })

  it('ignores a ballot for an agent that is not in the debate', () => {
    const rogue = { voterId: 'u-1', agente: 'nadie', at: 1 } as unknown as Ballot
    const tally = tallyVotes([rogue, ballot('u-2', 'tero', 2)])
    expect(tally.counts).toEqual({ burix: 0, tero: 1 })
  })
})

describe('sharePercent', () => {
  it('is a whole percent of the total', () => {
    expect(sharePercent(1, 3)).toBe(33)
    expect(sharePercent(2, 3)).toBe(67)
    expect(sharePercent(3, 3)).toBe(100)
  })
})
