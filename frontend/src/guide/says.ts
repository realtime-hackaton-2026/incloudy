/*
 * frontend/src/guide/says.ts // what the owl says, and in which of its five
 * roles — teach, guide, celebrate, collaborate, explain.
 *
 * Pure on purpose: every message is derived from state the caller already
 * has, so the guide can never become a second source of truth about
 * progress (Invariant 10). Nothing here reads a store or fires a request.
 */

export type GuideTone = 'teach' | 'guide' | 'celebrate' | 'collaborate' | 'explain'

export interface Guidance {
  /** Stable per message so repeats replace rather than stack. */
  id: string
  tone: GuideTone
  text: string
  /** Transient messages fade on their own; steady ones wait to be dismissed. */
  transient: boolean
}

/** "Esta estación está bloqueada" — but say what unlocks it. */
export function lockedStation(blocked: string, mustFinishFirst: string | null): Guidance {
  return {
    id: `locked:${blocked}`,
    tone: 'guide',
    text: mustFinishFirst
      ? `${blocked} todavía está cerrada. Primero termina ${mustFinishFirst}.`
      : `${blocked} todavía está cerrada.`,
    transient: true,
  }
}

/** A station just answered. Small praise, and what it earned. */
export function stationCleared(station: string, xpGained: number): Guidance {
  return {
    id: `cleared:${station}`,
    tone: 'celebrate',
    text: xpGained > 0
      ? `¡Muy bien! ${station} queda cerrada. +${xpGained} XP.`
      : `¡Muy bien! ${station} queda cerrada.`,
    transient: true,
  }
}

/** How much of the journey is left, in words rather than a percentage. */
export function journeyProgress(remaining: number): Guidance {
  if (remaining <= 0) {
    return {
      id: 'journey:done',
      tone: 'celebrate',
      text: 'Recorriste las cinco estaciones. Ya puedes cerrar el caso.',
      transient: false,
    }
  }
  return {
    id: `journey:${remaining}`,
    tone: 'explain',
    text: remaining === 1
      ? 'Te falta una estación para completar el recorrido.'
      : `Te faltan ${remaining} estaciones para completar el recorrido.`,
    transient: false,
  }
}

/** Someone else arrived in the case room. */
export function teammateArrived(name: string | null): Guidance {
  return {
    id: 'team:arrived',
    tone: 'collaborate',
    text: name ? `¡Llegó ${name}! Ya hay más gente en la sala.` : 'Ya llegó otra persona del equipo.',
    transient: true,
  }
}

/** The opening lesson: how the map works at all. */
export function howTheMapWorks(): Guidance {
  return {
    id: 'teach:map',
    tone: 'teach',
    text:
      'Toca un lugar del mapa para responder esa estación. Complétalas en orden — ' +
      'si una sigue bloqueada, primero hay que cerrar la anterior.',
    transient: false,
  }
}

/** The emoji the owl leads with, so a tone is legible before the text is read. */
export const TONE_MARK: Record<GuideTone, string> = {
  teach: '🧭',
  guide: '🔒',
  celebrate: '⭐',
  collaborate: '👋',
  explain: '📖',
}
