/*
 * frontend/src/debate/DebateRoom.tsx // the two guides arguing a case in the
 * open, with every turn broadcast to the room over the case's Portal channel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PortalProvider, useChannel } from '@portalsdk/react'
import { getPortalClient } from '../portal/client'
import { ConnectionStatus } from '../portal/ConnectionStatus'
import type { PortalConnectionStatus } from '../portal/connectionNotice'
import { usePortalSession } from '../portal/usePortalSession'
import { ConfirmDialog } from '../components/confirm-dialog'
import { DEBATE_RESET_EVENT, DEBATE_TURN_EVENT, useDebate } from './useDebate'
import { DEBATE_VOTE_EVENT, sharePercent, tallyVotes } from './votes'
import type { Ballot, Tally } from './votes'
import type { AgentId, DebateAgent, DebateTurn } from './api'
import styles from './DebateRoom.module.css'

/**
 * Shown before the first round, so the room can see what each guide will
 * argue for and judge the debate rather than receive a verdict. Mirrors the
 * personas in `backend/app/services/debate.py`.
 */
const STANCES: ReadonlyArray<DebateAgent> = [
  { id: 'burix', nombre: 'Búrix', postura: 'La evidencia primero' },
  { id: 'tero', nombre: 'Tero', postura: 'El apoyo no puede esperar' },
]

export interface DebateRoomProps {
  token: string
  caseId: string
  /** The pause between the two agents. Overridable for tests and demos. */
  replyDelayMs?: number
}

export function DebateRoom({ token, caseId, replyDelayMs }: DebateRoomProps) {
  const { session, status } = usePortalSession(token, caseId)

  // No Portal (or not configured yet) is not a reason to hide the debate:
  // it still runs, it just does not reach the rest of the room live.
  if (status !== 'ready' || !session) {
    return <OfflineDebate token={token} caseId={caseId} replyDelayMs={replyDelayMs} />
  }

  const client = getPortalClient(session.publishableKey, caseId)

  return (
    <PortalProvider client={client} token={session.token}>
      <LiveDebate token={token} caseId={caseId} channelId={session.channelId} replyDelayMs={replyDelayMs} />
    </PortalProvider>
  )
}

/**
 * Without a channel there is no room to tally, but the vote still has a
 * job: making the teacher commit to a reading before moving on. It counts
 * only them, and says so.
 */
function OfflineDebate({ token, caseId, replyDelayMs }: { token: string; caseId: string; replyDelayMs?: number }) {
  const [mine, setMine] = useState<AgentId | null>(null)

  // `at` only orders one voter's ballots against each other; with a single
  // local ballot there is nothing to order, so a constant keeps this pure.
  const tally = useMemo(
    () => tallyVotes(mine ? [{ voterId: 'me', agente: mine, at: 0 }] : [], 'me'),
    [mine],
  )

  const onVote = useCallback(async (agente: AgentId) => {
    setMine(agente)
  }, [])

  return (
    <DebateBody token={token} caseId={caseId} live={false} tally={tally} onVote={onVote} replyDelayMs={replyDelayMs} />
  )
}

function LiveDebate({
  token,
  caseId,
  channelId,
  replyDelayMs,
}: {
  token: string
  caseId: string
  channelId: string
  replyDelayMs?: number
}) {
  const { messages, send, me, status } = useChannel<Record<string, unknown>>({ channelId })

  const publish = useCallback(
    (turn: DebateTurn) => send({ content: { ...turn }, type: DEBATE_TURN_EVENT }),
    [send],
  )

  const castVote = useCallback(
    (agente: AgentId) => send({ content: { agente }, type: DEBATE_VOTE_EVENT }),
    [send],
  )

  // The marker every client reads to know the previous debate is over.
  const announceRestart = useCallback(
    () => send({ content: { at: Date.now() }, type: DEBATE_RESET_EVENT }),
    [send],
  )

  /*
   * Turns and ballots are *derived* from the channel, never copied into
   * state by an effect. That is what lets a teacher who did not run the
   * round still watch it arrive, and it keeps the tally correct without a
   * second source of truth to keep in sync.
   */
  const { channelTurns, ballots } = useMemo(() => {
    /*
     * Only what came after the most recent restart counts. Votes are cut at
     * the same point on purpose: a ballot judged the debate that was
     * argued, so carrying it into a fresh one would tally an opinion about
     * arguments nobody in the room can still read.
     */
    let start = 0
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].type === DEBATE_RESET_EVENT) {
        start = index + 1
        break
      }
    }

    const turns: DebateTurn[] = []
    const votes: Ballot[] = []
    for (const message of messages.slice(start)) {
      const content = message.content as Record<string, unknown> | undefined
      if (!content) continue
      if (message.type === DEBATE_TURN_EVENT) {
        turns.push(content as unknown as DebateTurn)
      } else if (message.type === DEBATE_VOTE_EVENT) {
        votes.push({
          voterId: message.sender.id,
          agente: content.agente as AgentId,
          at: message.timestamp,
        })
      }
    }
    return { channelTurns: turns, ballots: votes }
  }, [messages])

  return (
    <DebateBody
      token={token}
      caseId={caseId}
      live
      connection={status}
      publish={publish}
      announceRestart={announceRestart}
      channelTurns={channelTurns}
      tally={tallyVotes(ballots, me?.id)}
      onVote={castVote}
      replyDelayMs={replyDelayMs}
    />
  )
}

const AGENT_ORDER: Record<AgentId, number> = { burix: 0, tero: 1 }

function DebateBody({
  token,
  caseId,
  live,
  connection,
  publish,
  announceRestart,
  channelTurns = [],
  tally,
  onVote,
  replyDelayMs,
}: {
  token: string
  caseId: string
  live: boolean
  /** Portal's channel status; absent when the debate runs offline. */
  connection?: PortalConnectionStatus
  publish?: (turn: DebateTurn) => Promise<unknown>
  /** Publishes the restart marker. Absent offline: there is no room to tell. */
  announceRestart?: () => Promise<unknown>
  channelTurns?: readonly DebateTurn[]
  tally?: Tally
  onVote?: (agente: AgentId) => Promise<unknown>
  replyDelayMs?: number
}) {
  const { turns, agents, status, error, maxRounds, commentsRead, pendingAgent, runRound, reset } = useDebate({
    token,
    caseId,
    publish,
    replyDelayMs,
  })
  const [confirmingRestart, setConfirmingRestart] = useState(false)
  const [restarting, setRestarting] = useState(false)

  const stances = agents.length ? agents : STANCES
  const nameOf = useMemo(() => {
    const map = new Map<AgentId, string>()
    for (const agent of stances) map.set(agent.id, agent.nombre)
    return (id: AgentId) => map.get(id) ?? id
  }, [stances])

  /*
   * Our own turns and the channel's are the same events seen twice — the
   * round/agent pair identifies one, so merging on that key means a
   * spectator sees the debate without the runner seeing it doubled.
   */
  const visibleTurns = useMemo(() => {
    const byKey = new Map<string, DebateTurn>()
    for (const turn of [...channelTurns, ...turns]) {
      byKey.set(`${turn.ronda}:${turn.agente}`, turn)
    }
    return [...byKey.values()].sort(
      (a, b) => a.ronda - b.ronda || AGENT_ORDER[a.agente] - AGENT_ORDER[b.agente],
    )
  }, [channelTurns, turns])

  const round = Math.floor(visibleTurns.length / 2)

  const finished = round >= maxRounds
  const busy = status === 'thinking' || status === 'replying'

  /*
   * Who the room is waiting on. An odd turn count means one stance has been
   * heard and its counterpart has not, which is true for spectators too —
   * they receive the held-back turn late because it is published late, so
   * the same parity tells them the same thing without any extra message.
   * Skipped on error, where the missing turn is never coming.
   */
  const replying = useMemo(() => {
    if (pendingAgent) return pendingAgent
    if (status === 'error' || visibleTurns.length % 2 === 0) return null
    const spoke = visibleTurns[visibleTurns.length - 1].agente
    return stances.find((agent) => agent.id !== spoke) ?? null
  }, [pendingAgent, status, visibleTurns, stances])

  /*
   * Follow the debate the way a chat follows a conversation — but only while
   * the reader is already at the bottom. Someone scrolled up re-reading
   * Búrix's opening should not be yanked away when Tero answers, so whether
   * we were pinned is measured before the new turn paints, and acted on
   * after.
   */
  const turnsRef = useRef<HTMLOListElement>(null)
  const pinned = useRef(true)

  /*
   * Tracked as the reader scrolls, not measured when a turn arrives.
   *
   * Effects run *after* React has already put the new turn in the DOM, so
   * measuring there always found a screenful of unread content below and
   * concluded the reader had scrolled away — the scroll never fired. The
   * scroll event is the only moment that reports where they actually were.
   *
   * 48px of slack: "close enough to the bottom" has to survive sub-pixel
   * rounding and the gap under the last turn.
   */
  const trackPinned = useCallback(() => {
    const list = turnsRef.current
    if (!list) return
    pinned.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48
  }, [])

  useEffect(() => {
    const list = turnsRef.current
    if (!list || !pinned.current) return
    // Both guards are load-bearing: jsdom implements neither `scrollTo` on
    // elements nor `matchMedia`, and assigning scrollTop works everywhere.
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (typeof list.scrollTo === 'function') {
      list.scrollTo({ top: list.scrollHeight, behavior: calm ? 'auto' : 'smooth' })
    } else {
      list.scrollTop = list.scrollHeight
    }
  }, [visibleTurns.length, replying])

  async function restart() {
    setRestarting(true)
    try {
      // Tell the room first: if this fails, the debate is still standing for
      // everyone, and clearing our own view would be a lie about that.
      await announceRestart?.()
      reset()
      setConfirmingRestart(false)
    } finally {
      setRestarting(false)
    }
  }

  function requestRestart() {
    // Offline the debate is only on this screen, so there is nothing to warn
    // about. Live, it discards a debate the whole room watched.
    if (live) setConfirmingRestart(true)
    else void restart()
  }

  return (
    <section className={styles.debate} data-testid="debate-room" data-state={status}>
      <header className={styles.header}>
        <h4 className={styles.title}>Búrix y Tero debaten</h4>
        <span className={styles.hint}>
          {live ? 'En vivo para toda la sala' : 'Solo en tu pantalla'}
          {commentsRead > 0 && ` · leyeron ${commentsRead} comentario(s)`}
        </span>
      </header>

      {/* A stalled socket is why a spectator would stop seeing turns arrive,
          so the debate says so rather than just going quiet. */}
      {connection && <ConnectionStatus status={connection} testId="debate-connection" />}

      {visibleTurns.length === 0 && (
        <div className={styles.stances}>
          {stances.map((agent) => (
            <article
              key={agent.id}
              className={`${styles.stance} ${
                agent.id === 'burix' ? styles.stanceBurix : styles.stanceTero
              }`}
            >
              <span className={styles.stanceName}>{agent.nombre}</span>
              <span className={styles.stancePosture}>{agent.postura}</span>
            </article>
          ))}
        </div>
      )}

      {visibleTurns.length > 0 && (
        <ol className={styles.turns} ref={turnsRef} onScroll={trackPinned}>
          {visibleTurns.map((turn) => (
            <li
              key={`${turn.ronda}-${turn.agente}`}
              className={`${styles.turn} ${
                turn.agente === 'burix' ? styles.turnBurix : styles.turnTero
              }`}
              data-testid={`debate-turn-${turn.ronda}-${turn.agente}`}
            >
              <div className={styles.turnHead}>
                <span className={styles.turnName}>{nameOf(turn.agente)}</span>
                <span className={styles.turnRound}>Ronda {turn.ronda}</span>
              </div>
              <p className={styles.argument}>{turn.argumento}</p>

              {(turn.fortalezas.length > 0 || turn.riesgos.length > 0) && (
                <div className={styles.ledger}>
                  <div className={`${styles.ledgerCol} ${styles.gains}`}>
                    <h5>A favor</h5>
                    <ul>
                      {turn.fortalezas.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={`${styles.ledgerCol} ${styles.risks}`}>
                    <h5>Riesgo</h5>
                    <ul>
                      {turn.riesgos.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          ))}

          {replying && (
            <li
              className={`${styles.turn} ${styles.replying} ${
                replying.id === 'burix' ? styles.turnBurix : styles.turnTero
              }`}
              data-testid="debate-replying"
              aria-live="polite"
            >
              <div className={styles.turnHead}>
                <span className={styles.turnName}>{replying.nombre}</span>
              </div>
              <p className={styles.argument}>
                {replying.nombre} está preparando su respuesta
                <span className={styles.dots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </p>
            </li>
          )}
        </ol>
      )}

      {status === 'error' && (
        <p className={`${styles.state} ${styles.stateError}`} role="alert">
          {error}
        </p>
      )}

      {/* The vote opens as soon as there is something to judge, and stays
          open after the last round — the debate closes, the room's reading
          of it does not. */}
      {visibleTurns.length > 0 && tally && onVote && (
        <AudienceVote stances={stances} tally={tally} onVote={onVote} live={live} />
      )}

      <div className={styles.actions}>
        {finished ? (
          <p className={styles.closed}>
            El debate se cierra aquí. Ninguno de los dos decide: la lectura del caso es
            del equipo.
          </p>
        ) : (
          <>
            {/* The merged view is the real history: a spectator's own turns
                are empty, so passing it is what keeps the round number right. */}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void runRound(visibleTurns)}
              disabled={busy || restarting}
            >
              {busy
                ? 'Pensando…'
                : visibleTurns.length === 0
                  ? 'Abrir el debate'
                  : `Siguiente ronda (${round + 1}/${maxRounds})`}
            </button>
            {status === 'thinking' && (
              <span className={styles.thinking}>Búrix y Tero preparan su turno…</span>
            )}
          </>
        )}

        {/* Only offered once there is a debate to discard — including after
            the last round, which is exactly when starting over is wanted. */}
        {visibleTurns.length > 0 && (
          <button
            type="button"
            className={styles.restart}
            onClick={requestRestart}
            disabled={busy || restarting}
          >
            {restarting ? 'Reiniciando…' : '↺ Reiniciar debate'}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmingRestart}
        title="¿Reiniciar el debate?"
        description="Se borran los turnos y los votos para toda la sala. Búrix y Tero empezarán de cero."
        confirmLabel="Reiniciar"
        tone="danger"
        pending={restarting}
        onConfirm={() => void restart()}
        onCancel={() => setConfirmingRestart(false)}
      />
    </section>
  )
}

function AudienceVote({
  stances,
  tally,
  onVote,
  live,
}: {
  stances: ReadonlyArray<DebateAgent>
  tally: Tally
  onVote: (agente: AgentId) => Promise<unknown>
  live: boolean
}) {
  return (
    <div className={styles.vote} data-testid="debate-vote" data-live={live}>
      <div className={styles.voteHead}>
        <h5 className={styles.voteTitle}>¿Con qué postura te quedas?</h5>
        <span className={styles.voteCount}>
          {!live
            ? 'Solo tu voto — la sala no está conectada'
            : tally.total === 0
              ? 'Nadie ha votado todavía'
              : `${tally.total} voto(s) del equipo`}
        </span>
      </div>

      <div className={styles.voteOptions}>
        {stances.map((agent) => {
          const count = tally.counts[agent.id] ?? 0
          const percent = sharePercent(count, tally.total)
          const chosen = tally.mine === agent.id
          return (
            <button
              key={agent.id}
              type="button"
              className={`${styles.voteOption} ${
                agent.id === 'burix' ? styles.voteBurix : styles.voteTero
              }`}
              // Not colour alone: the button reports its own pressed state,
              // and the count is spelled out next to the bar.
              aria-pressed={chosen}
              data-chosen={chosen}
              onClick={() => onVote(agent.id)}
            >
              <span className={styles.voteName}>
                {chosen && <span aria-hidden="true">✓ </span>}
                {agent.nombre}
              </span>
              <span className={styles.voteBar} aria-hidden="true">
                <span className={styles.voteFill} style={{ width: `${percent}%` }} />
              </span>
              <span className={styles.voteTally}>
                {count} · {percent}%
              </span>
            </button>
          )
        })}
      </div>

      <p className={styles.voteFoot}>
        {tally.mine
          ? 'Puedes cambiar tu voto: cuenta el último.'
          : 'Tu voto no cierra el caso — deja constancia de la lectura del equipo.'}
      </p>
    </div>
  )
}
