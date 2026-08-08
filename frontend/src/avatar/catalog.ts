/*
 * frontend/src/avatar/catalog.ts // the playable avatar catalog. Adding one:
 * drop a resized image in assets/images/avatars/ (see the script in
 * docs/memoria.md for the resize step — the source art in
 * assets/images/presonajes/ is full-resolution portrait art, ~1MB each, not
 * sized for a picker thumbnail), import it, add an entry. Nothing else
 * changes — the picker and the badge both read this list.
 */

import brasil from '../assets/images/avatars/brasil.jpg'
import chileno from '../assets/images/avatars/chileno.jpg'
import gaucho from '../assets/images/avatars/gaucho.jpg'
import joven from '../assets/images/avatars/joven.jpg'
import moderno from '../assets/images/avatars/moderno.jpg'
import paraguayo from '../assets/images/avatars/paraguayo.jpg'
import peruano from '../assets/images/avatars/peruano.jpg'
import tradicional from '../assets/images/avatars/tradicional.jpg'

export interface Avatar {
  id: string
  name: string
  src: string
}

export const AVATARS: readonly Avatar[] = [
  { id: 'gaucho', name: 'Gaucho', src: gaucho },
  { id: 'brasil', name: 'Brasil', src: brasil },
  { id: 'chileno', name: 'Chileno', src: chileno },
  { id: 'peruano', name: 'Peruano', src: peruano },
  { id: 'paraguayo', name: 'Paraguayo', src: paraguayo },
  { id: 'tradicional', name: 'Tradicional', src: tradicional },
  { id: 'joven', name: 'Joven', src: joven },
  { id: 'moderno', name: 'Moderno', src: moderno },
]

export const DEFAULT_AVATAR_ID = AVATARS[0].id

export function avatarById(id: string): Avatar {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0]
}
