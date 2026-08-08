/**
 * Inline field icons for the auth screens.
 *
 * The original mockup pulled these from the Material Symbols web font;
 * inlining them drops a render-blocking request and keeps the forms
 * readable offline. Shared so Login and Registro cannot drift apart.
 */

import styles from './AuthScreen.module.css'

export function PersonIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5Z" />
    </svg>
  )
}

export function KeyIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15 3a6 6 0 1 0-5.7 8L7 13.3V16H4v3h5.7l6-6A6 6 0 0 0 15 3Zm1.5 5.5a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" />
    </svg>
  )
}

/** The gateway arrow on the primary call to action. */
export function ArrowIcon() {
  return (
    <svg
      className={styles.submitIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function WarningIcon() {
  return (
    <svg
      className={styles.errorIcon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2 1 21h22L12 2Zm1 14v2h-2v-2h2Zm0-7v5h-2V9h2Z" />
    </svg>
  )
}
