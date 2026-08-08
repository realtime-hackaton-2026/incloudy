/**
 * The world every screen sits inside.
 *
 * Rendered once, at the app root, and never unmounted — that is the whole
 * point. Login and casos are not two pages with similar backgrounds; they
 * are two views onto one environment that stays put underneath them.
 */

import mapArt from '../../assets/images/fondo.png'
import styles from './MapEnvironment.module.css'

export type EnvironmentDepth =
  /** Login: the world is close, readable, only lightly veiled. */
  | 'full'
  /** Working UI: the same world, pushed back so content reads on top. */
  | 'ambient'

export type EnvironmentPhase =
  /** Steady state — ambient drift only. */
  | 'idle'
  /** Scene 02 of the login entrance: the world comes into focus. */
  | 'entering'
  /** Login → casos: the world sharpens, then settles into the background. */
  | 'sharpening'

export interface MapEnvironmentProps {
  depth: EnvironmentDepth
  phase?: EnvironmentPhase
}

export function MapEnvironment({ depth, phase = 'idle' }: MapEnvironmentProps) {
  const classes = [styles.environment, styles[depth]]
  if (phase !== 'idle') classes.push(styles[phase])

  return (
    <div className={classes.join(' ')} aria-hidden="true">
      <div
        // The drift is suspended during choreographed moments so two
        // animations never fight over the same transform.
        className={phase === 'idle' ? `${styles.map} ${styles.drifting}` : styles.map}
        style={{ backgroundImage: `url(${mapArt})` }}
      />
      <div className={styles.light} />
      <div className={styles.grain} />
      <div className={styles.vignette} />
    </div>
  )
}
