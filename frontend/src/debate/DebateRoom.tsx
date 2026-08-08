/*
 * frontend/src/debate/DebateRoom.tsx // the two guides arguing a case in the
 * open, with every turn broadcast to the room over the case's Portal channel.
 */

import { useCallback, useMemo } from 'react'
import { PortalProvider, useChannel } from '@portalsdk/react'
import { getPortalClient } from '../portal/client'
import { usePortalSession } from '../portal/usePortalSession'
import { DEBATE_TURN_EVENT, useDebate } from './useDebate'
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
}

export function DebateRoom({ token, caseId }: DebateRoomProps) {
  const { session, status } = usePortalSession(token, caseId)

  // No Portal (or not configured yet) is not a reason to hide the debate:
  // it still runs, it just does not reach the rest of the room live.
  if (status !== 'ready' || !session) {
    return <DebateBody token={token} caseId={caseId} live={false} />
  }

  const client = getPortalClient(session.publishableKey, caseId)

  return (
    <PortalProvider client={client} token={session.token}>
      <LiveDebate token={token} caseId={caseId} channelId={session.channelId} />
    </PortalProvider>
  )
}

function LiveDebate({
  token,
  caseId,
  channelId,
}: {
  token: string
  caseId: string
  channelId: string
}) {
  const { send } = useChannel<Record<string, unknown>>({ channelId })

  const publish = useCallback(
    (turn: DebateTurn) => send({ content: { ...turn }, type: DEBATE_TURN_EVENT }),
    [send],
  )

  return <DebateBody token={token} caseId={caseId} live publish={publish} />
}

function DebateBody({
  token,
  caseId,
  live,
  publish,
}: {
  token: string
  caseId: string
  live: boolean
  publish?: (turn: DebateTurn) => Promise<unknown>
}) {
  const { turns, agents, status, error, round, maxRounds, commentsRead, runRound } = useDebate({
    token,
    caseId,
    publish,
  })

  const stances = agents.length ? agents : STANCES
  const nameOf = useMemo(() => {
    const map = new Map<AgentId, string>()
    for (const agent of stances) map.set(agent.id, agent.nombre)
    return (id: AgentId) => map.get(id) ?? id
  }, [stances])

  const finished = round >= maxRounds
  const busy = status === 'thinking'

  return (
    <section className={styles.debate} data-testid="debate-room" data-state={status}>
      <header className={styles.header}>
        <h4 className={styles.title}>Búrix y Tero debaten</h4>
        <span className={styles.hint}>
          {live ? 'En vivo para toda la sala' : 'Solo en tu pantalla'}
          {commentsRead > 0 && ` · leyeron ${commentsRead} comentario(s)`}
        </span>
      </header>

      {turns.length === 0 && (
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

      {turns.length > 0 && (
        <ol className={styles.turns}>
          {turns.map((turn) => (
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
        </ol>
      )}

      {status === 'error' && (
        <p className={`${styles.state} ${styles.stateError}`} role="alert">
          {error}
        </p>
      )}

      {finished ? (
        <p className={styles.closed}>
          El debate se cierra aquí. Ninguno de los dos decide: la lectura del caso es
          del equipo.
        </p>
      ) : (
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={runRound} disabled={busy}>
            {busy
              ? 'Pensando…'
              : turns.length === 0
                ? 'Abrir el debate'
                : `Siguiente ronda (${round + 1}/${maxRounds})`}
          </button>
          {busy && <span className={styles.thinking}>Búrix y Tero preparan su turno…</span>}
        </div>
      )}
    </section>
  )
}
