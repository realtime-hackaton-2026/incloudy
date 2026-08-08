/**
 * The application header: brand left, route centred, session right.
 *
 * Routes are declared here rather than passed in, because the header is the
 * one place that has to agree with `App`'s hash router about what the top
 * level of the product is.
 */

import logo from '../../assets/images/logo.webp'
import styles from './AppHeader.module.css'

export type RouteName = 'casos' | 'mapa'

export interface AppHeaderProps {
  active: RouteName
  email: string
  signingOut?: boolean
  onNavigate: (route: RouteName) => void
  onSignOut: () => void
}

const ROUTES: ReadonlyArray<{ name: RouteName; label: string }> = [
  { name: 'casos', label: 'Aventuras' },
  { name: 'mapa', label: 'Mapa' },
]

export function AppHeader({
  active,
  email,
  signingOut = false,
  onNavigate,
  onSignOut,
}: AppHeaderProps) {
  return (
    <header className={`${styles.header} ${signingOut ? styles.signingOut : ''}`}>
      <div className={styles.brand}>
        <img className={styles.mark} src={logo} alt="" />
        incloudy
      </div>

      <nav className={styles.nav}>
        {ROUTES.map((route) => (
          <button
            key={route.name}
            type="button"
            className={`${styles.navItem} ${active === route.name ? styles.navItemActive : ''}`}
            aria-current={active === route.name ? 'page' : undefined}
            onClick={() => onNavigate(route.name)}
          >
            {route.label}
          </button>
        ))}
      </nav>

      <div className={styles.user}>
        <span className={styles.email} title={email}>
          {email}
        </span>
        <button type="button" className={styles.signOut} onClick={onSignOut}>
          Salir
        </button>
      </div>
    </header>
  )
}
