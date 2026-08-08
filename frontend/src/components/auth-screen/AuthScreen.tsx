/**
 * The panel shared by Login and Registro, and the login's entrance
 * choreography.
 *
 * The world behind it belongs to `MapEnvironment` at the app root — this
 * component only floats inside it. That is what keeps "entering incloudy"
 * from feeling like two separate pages with matching wallpaper.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import logo from '../../assets/images/logo.webp'
import styles from './AuthScreen.module.css'

export interface AuthScreenProps {
  tagline: string
  /** The invitation above the form — "¿Listo para explorar?". */
  prompt: string
  children: ReactNode
  /**
   * Fires while any field is focused. The caller darkens the world behind
   * the panel to match — the focus transition is a composition change, not
   * just a border colour.
   */
  onFocusChange?: (focused: boolean) => void
  /** Scene 01 (black, then a point of light) only plays on a cold open. */
  showCurtain?: boolean
}

export function AuthScreen({
  tagline,
  prompt,
  children,
  onFocusChange,
  showCurtain = true,
}: AuthScreenProps) {
  const [focused, setFocused] = useState(false)

  function handleFocus(next: boolean) {
    setFocused(next)
    onFocusChange?.(next)
  }

  return (
    <div className={styles.screen}>
      {showCurtain && <div className={styles.curtain} aria-hidden="true" />}

      <div
        className={`${styles.panel} ${focused ? styles.panelFocused : ''}`}
        // Focus events bubble, so one pair of handlers on the panel covers
        // every field inside it without each form wiring them up.
        onFocus={() => handleFocus(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) handleFocus(false)
        }}
      >
        <div className={styles.branding}>
          <img className={styles.logo} src={logo} alt="" />
          <span className={styles.wordmark}>incloudy</span>
          <span className={styles.tagline}>{tagline}</span>
          <span className={styles.prompt}>{prompt}</span>
        </div>

        {children}
      </div>
    </div>
  )
}
