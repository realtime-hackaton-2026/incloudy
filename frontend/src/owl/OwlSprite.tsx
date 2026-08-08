/*
 * frontend/src/owl/OwlSprite.tsx // the project's owl, drawn as real pixel
 * art instead of a smooth vector icon: a 13x13 grid of square pixels, using
 * the same palette the guide bubble already used (`guide/OwlTip.module.css`
 * predates this file). One grid feeds both places the owl appears — the
 * guide icon in `OwlTip` and the door in `OwlDoor` — so they show the same
 * character instead of two different owls.
 *
 * The grid is authored as plain strings, one character per pixel, rather
 * than hand-written <rect> tags: adjusting the art means editing characters
 * here, not fighting a wall of coordinates.
 */

import type { ReactElement } from 'react'
import styles from './OwlSprite.module.css'

// '.' is transparent. Every other row must stay exactly as long as this one
// — that's what keeps the grid square once it's mapped into <rect>s below.
const GRID = [
  '....B...B....',
  '...BTB.BTB...',
  '..BTTB.BTTB..',
  '.BBBBBBBBBBB.',
  'BOOOOOOOOOOOB',
  'BOWWWOOOWWWOB',
  'BOWPWOOOWPWOB',
  'BOWWWOOOWWWOB',
  'BOOOOOKKOOOOB',
  '.BOOOOKKOOOB.',
  '..BOOOOOOOB..',
  '...BCCCCCB...',
  '....BFBFB....',
]

const PIXEL_COLORS: Record<string, string> = {
  B: '#241705', // outline, and the pupil — same ink, different job
  T: '#8a6a4a', // ear tufts
  O: '#a8825a', // body
  W: '#fdfbf7', // eye white
  P: '#241705', // pupil
  K: '#e2913f', // beak
  C: '#e6c995', // belly
  F: '#8a6a4a', // feet
}

const SIZE = GRID.length

export interface OwlSpriteProps {
  className?: string
  /**
   * A slow blink so the guide reads as alive, not as a static icon. Off by
   * default anywhere the sprite might repeat (a list of many owls blinking
   * out of sync is distracting) — on by default everywhere else, since
   * there's normally only one owl on screen at a time.
   */
  blink?: boolean
}

export function OwlSprite({ className, blink = true }: OwlSpriteProps) {
  const pixels: ReactElement[] = []
  const eyelids: ReactElement[] = []

  GRID.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const char = row[x]
      if (char === '.') continue
      pixels.push(
        <rect key={`px-${x}-${y}`} x={x} y={y} width={1} height={1} fill={PIXEL_COLORS[char]} />,
      )
      // The eyelid is the body color painted over the eye — closing it is
      // covering it, not swapping it for a different shape.
      if (char === 'W' || char === 'P') {
        eyelids.push(
          <rect key={`lid-${x}-${y}`} x={x} y={y} width={1} height={1} fill={PIXEL_COLORS.O} />,
        )
      }
    }
  })

  return (
    <svg
      className={className}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Búho guía"
    >
      {pixels}
      {blink && <g className={styles.eyelids}>{eyelids}</g>}
    </svg>
  )
}
