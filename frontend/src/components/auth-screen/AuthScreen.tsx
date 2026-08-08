/**
 * The wood-and-paper panel shared by Login and Registro.
 *
 * Split out once a second screen needed the exact same chrome — same
 * backdrop, same double pixel border, same branding block — so nudging the
 * frame means touching one file instead of two drifting copies.
 */

import type { ReactNode } from 'react'
import mapArt from '../../assets/images/fondo.png'
import logo from '../../assets/images/logo.webp'
import styles from './AuthScreen.module.css'

export interface AuthScreenProps {
  tagline: string
  children: ReactNode
}

export function AuthScreen({ tagline, children }: AuthScreenProps) {
  return (
    <div className={styles.screen}>
      <div
        className={styles.backdrop}
        style={{ backgroundImage: `url(${mapArt})` }}
        aria-hidden="true"
      />
      <div className={styles.veil} aria-hidden="true" />

      <div className={styles.panel}>
        <div className={styles.paper}>
          <span className={`${styles.corner} ${styles.cornerTopLeft}`} aria-hidden="true" />
          <span className={`${styles.corner} ${styles.cornerTopRight}`} aria-hidden="true" />
          <span
            className={`${styles.corner} ${styles.cornerBottomLeft}`}
            aria-hidden="true"
          />
          <span
            className={`${styles.corner} ${styles.cornerBottomRight}`}
            aria-hidden="true"
          />

          <div className={styles.branding}>
            <img className={styles.logo} src={logo} alt="" />
            <h1 className={styles.wordmark}>incloudy</h1>
            <p className={styles.tagline}>{tagline}</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
