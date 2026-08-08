/**
 * The application header: brand left, route centred, session right.
 *
 * Routes are declared here rather than passed in, because the header is the
 * one place that has to agree with `App`'s hash router about what the top
 * level of the product is.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import logo from '../../assets/images/logo.webp'
import type { ProfileUpdate } from '../../auth'
import { useNotifications } from '../../notifications/useNotifications'
import styles from './AppHeader.module.css'

export type RouteName = 'casos' | 'mapa' | 'dashboard'

export interface AppHeaderProps {
  active: RouteName
  nombre?: string
  email: string
  seccion?: string | null
  signingOut?: boolean
  /** Signed Portal+API token; enables the notification bell. */
  token?: string
  onNavigate: (route: RouteName) => void
  onSignOut: () => void
  onUpdateProfile?: (input: ProfileUpdate) => Promise<boolean>
}

const ROUTES: ReadonlyArray<{ name: RouteName; label: string }> = [
  { name: 'casos', label: 'Aventuras' },
  { name: 'mapa', label: 'Mapa' },
]

export function AppHeader({
  active,
  nombre = 'Docente',
  email,
  seccion,
  signingOut = false,
  token,
  onNavigate,
  onSignOut,
  onUpdateProfile = async () => false,
}: AppHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profile, setProfile] = useState({ nombre, email, seccion: seccion ?? '', currentPassword: '', newPassword: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const notifications = useNotifications(token)

  function openNotifications() {
    setNotificationsOpen(true)
    void notifications.refresh()
  }

  // The draft is seeded when the dialog opens, not synced from props — an
  // effect would either clobber what the teacher is typing or fight the
  // linter; neither is worth it.
  function openSettings() {
    setProfile({ nombre, email, seccion: seccion ?? '', currentPassword: '', newPassword: '' })
    setSettingsOpen(true)
  }

  useEffect(() => {
    if (!settingsOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', closeWithEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeWithEscape)
    }
  }, [settingsOpen])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    const saved = await onUpdateProfile(profile)
    setSaving(false)
    setMessage(saved ? 'Perfil actualizado.' : 'No se pudo actualizar. Revisa tu contraseña actual.')
    if (saved) setProfile((current) => ({ ...current, currentPassword: '', newPassword: '' }))
  }
  return (
    <header
      className={`${styles.header} ${signingOut ? styles.signingOut : ''}`}
      data-testid="app-header"
      data-active-route={active}
      data-state={signingOut ? 'signing-out' : 'idle'}
    >
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
            data-state={active === route.name ? 'active' : 'idle'}
            onClick={() => onNavigate(route.name)}
          >
            {route.label}
          </button>
        ))}
      </nav>

      <div className={styles.user}>
        <button
          type="button"
          className={`${styles.dashboardLink} ${active === 'dashboard' ? styles.dashboardLinkActive : ''}`}
          aria-current={active === 'dashboard' ? 'page' : undefined}
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </button>
        <span className={styles.teacher} title={`${nombre} · ${email}`}>
          Docente: <strong>{nombre}</strong>
        </span>
        <button type="button" className={styles.bell} aria-label="Abrir notificaciones"
          title="Notificaciones" onClick={openNotifications} data-unread={notifications.unreadCount}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {notifications.unreadCount > 0 && (
            <span className={styles.bellBadge} data-testid="notifications-badge">{notifications.unreadCount}</span>
          )}
        </button>
        <button type="button" className={styles.settingsButton} aria-label="Abrir ajustes del perfil"
          title="Ajustes" onClick={openSettings}>⚙</button>
        <button type="button" className={styles.signOut} onClick={onSignOut}>
          Salir
        </button>
      </div>

      {settingsOpen && createPortal(
        <div className={styles.settingsBackdrop} role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className={styles.settingsPanel} role="dialog" aria-modal="true" aria-labelledby="settings-title"
            onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.settingsHeading}>
              <div><span>PERFIL DOCENTE</span><h2 id="settings-title">Ajustes de cuenta</h2></div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar ajustes">×</button>
            </div>
            <form className={styles.settingsForm} onSubmit={saveProfile}>
              <label>Nombre del docente<input required autoComplete="name" value={profile.nombre} onChange={(e) => setProfile({ ...profile, nombre: e.target.value })} /></label>
              <label>Sección o tutoría<input value={profile.seccion} placeholder="Ej. Tutor de 3.º B" onChange={(e) => setProfile({ ...profile, seccion: e.target.value })} /></label>
              <label>Correo actual<input required type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
              <div className={styles.passwordGrid}>
                <label>Contraseña actual<input type="password" autoComplete="current-password" value={profile.currentPassword} onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })} /></label>
                <label>Nueva contraseña<input type="password" minLength={8} autoComplete="new-password" value={profile.newPassword} onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })} /></label>
              </div>
              <p className={styles.settingsHelp}>La contraseña actual solo es necesaria si cambias el correo o la contraseña.</p>
              {message && <p className={styles.settingsMessage} role="status">{message}</p>}
              <button className={styles.saveButton} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            </form>
          </section>
        </div>
      , document.body)}
      {notificationsOpen && createPortal(
        <div className={styles.notificationsBackdrop} role="presentation" onMouseDown={() => setNotificationsOpen(false)}>
          <section className={styles.notificationsPanel} role="dialog" aria-modal="true" aria-labelledby="notifications-title"
            onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.settingsHeading}>
              <div><span>AVISOS</span><h2 id="notifications-title">Notificaciones</h2></div>
              <button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Cerrar notificaciones">×</button>
            </div>
            {notifications.error && <p className={styles.settingsMessage} role="alert">{notifications.error}</p>}
            {notifications.unread.length === 0 && !notifications.error && (
              <p className={styles.notificationsEmpty}>Sin avisos pendientes. Recibirás uno cuando un caso avance de estación.</p>
            )}
            <ul className={styles.notificationsList}>
              {notifications.unread.map((item) => (
                <li key={item.id} className={styles.notificationItem}>
                  <button type="button" className={styles.notificationBody} onClick={() => void notifications.markRead(item.id)}>
                    <span className={styles.notificationDot} aria-hidden="true" />
                    <span className={styles.notificationCopy}>
                      <strong>{item.titulo}</strong>
                      <small>{item.mensaje}</small>
                    </span>
                    <time>{new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at))}</time>
                  </button>
                  <button type="button" className={styles.notificationDismiss} aria-label={`Descartar aviso: ${item.titulo}`}
                    onClick={() => void notifications.markRead(item.id)}>×</button>
                </li>
              ))}
            </ul>
            {notifications.unreadCount > 0 && (
              <button type="button" className={styles.markAllRead} onClick={() => void notifications.markAllRead()}>
                Marcar todas como leídas
              </button>
            )}
          </section>
        </div>
      , document.body)}
    </header>
  )
}
