/**
 * The backdrop for a route.
 *
 * Three worlds, not one: the login is a campsite at dusk, casos is the
 * explorer's journal, and the map appears only on the map route. Reusing a
 * single environment everywhere is what made the map feel like wallpaper —
 * keeping it to one screen is what makes arriving there mean something.
 */

import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import mapArt from '../../assets/images/fondo.png'
import styles from './Scene.module.css'

export type SceneVariant = 'gate' | 'journal' | 'world'

export interface SceneProps {
  variant: SceneVariant
  /** Play the staged entrance rather than opening at rest. */
  entering?: boolean
  /** Gate only: a field has focus, so the world leans in. */
  attentive?: boolean
}

const FIREFLY_COUNT = 12

interface Firefly {
  style: CSSProperties
}

/**
 * Fireflies with individually random paths, speeds and phases.
 *
 * Deliberately not a shared timeline: durations that never divide evenly
 * are what keep the swarm from falling into step, which is the thing that
 * makes an ambient loop start looking like a GIF.
 */
function makeFireflies(): Firefly[] {
  return Array.from({ length: FIREFLY_COUNT }, () => {
    const flyDuration = 7 + Math.random() * 11
    const glowDuration = 1.8 + Math.random() * 2.6
    return {
      style: {
        left: `${8 + Math.random() * 84}%`,
        top: `${34 + Math.random() * 52}%`,
        ['--dx' as string]: `${(Math.random() - 0.5) * 160}px`,
        ['--dy' as string]: `${(Math.random() - 0.5) * 120}px`,
        animationDuration: `${flyDuration}s, ${glowDuration}s`,
        animationDelay: `${-Math.random() * flyDuration}s, ${-Math.random() * glowDuration}s`,
      } as CSSProperties,
    }
  })
}

export function Scene({ variant, entering = false, attentive = false }: SceneProps) {
  // Generated once: re-rolling on every render would make the swarm jump.
  const fireflies = useMemo(() => makeFireflies(), [])

  const classes = [styles.scene, styles[variant]]
  if (entering) classes.push(styles.entering)
  if (attentive) classes.push(styles.attentive)

  return (
    <div className={classes.join(' ')} aria-hidden="true">
      {variant === 'gate' && (
        <>
          <div className={`${styles.layer} ${styles.starsFar}`} />
          <div className={`${styles.layer} ${styles.stars}`} />
          <div className={`${styles.layer} ${styles.clouds}`} />
          <div className={`${styles.layer} ${styles.treesFar}`} />
          <div className={`${styles.layer} ${styles.emberGlow}`} />
          <div className={`${styles.layer} ${styles.treesNear}`} />
          <div className={styles.campfire} />
          {fireflies.map((firefly, index) => (
            <span key={index} className={styles.firefly} style={firefly.style} />
          ))}
        </>
      )}

      {variant === 'journal' && (
        <>
          <div className={`${styles.layer} ${styles.motes}`} />
          <div className={`${styles.layer} ${styles.paperGrain}`} />
        </>
      )}

      {variant === 'world' && (
        <>
          <div
            className={`${styles.layer} ${styles.worldMap}`}
            style={{ backgroundImage: `url(${mapArt})` }}
          />
          <div className={`${styles.layer} ${styles.worldLight}`} />
          <div className={`${styles.layer} ${styles.worldVignette}`} />
        </>
      )}
    </div>
  )
}
