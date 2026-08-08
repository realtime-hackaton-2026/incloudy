/*
 * frontend/src/guide/tips.ts // the owl's tip catalog. One place per
 * message so an id can never point at two different pieces of copy — add an
 * entry here, reference its id from <OwlTip>, nothing else to wire up.
 */

export type TipId = 'map-guide'

export const TIPS: Record<TipId, string> = {
  'map-guide':
    'Toca un lugar del mapa para responder esa estación. Complétalas en orden — ' +
    'si una sigue bloqueada, primero hay que cerrar la anterior.',
}
