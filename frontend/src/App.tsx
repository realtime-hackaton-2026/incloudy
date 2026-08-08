import { useEffect, useState } from 'react'
import { useSession } from './auth'
import type { Credentials } from './auth'
import { AvatarPicker, useAvatar } from './avatar'
import { useCases } from './cases'
import { OwlTip } from './guide'
import { AppHeader } from './components/app-header'
import type { RouteName } from './components/app-header'
import { CaseForm } from './components/case-form'
import { CaseList } from './components/case-list'
import { CaseMap, toCaseStage } from './components/case-map'
import { CinematicOverlay } from './components/cinematic-overlay'
import { Login } from './components/login'
import { Registro } from './components/registro'
import { Scene } from './components/scene'
import { Dashboard } from './dashboard/Dashboard'
import type { SceneVariant } from './components/scene'

type AuthScreenName = 'login' | 'registro'
type View = { name: 'cases' } | { name: 'case'; caseId: string } | { name: 'map-demo' } | { name: 'dashboard' }

/** How long the login → casos transition runs. Matches --cinematic. */
const ENTRANCE_MS = 1600

/*
 * Every screen has a URL (#/casos, #/caso/:id, #/mapa, #/login, #/registro)
 * so the frontend README and the browser back button can point at it
 * directly. State changes always go through the hash; the hashchange event
 * is the only writer of `view` and `authScreen`.
 */

function viewFromHash(hash: string): View {
  const [first, second] = hash.replace(/^#\/?/, '').split('/')
  if (first === 'mapa') return { name: 'map-demo' }
  if (first === 'dashboard') return { name: 'dashboard' }
  if (first === 'caso' && second) return { name: 'case', caseId: second }
  return { name: 'cases' }
}

function hashFor(view: View): string {
  if (view.name === 'case') return `#/caso/${view.caseId}`
  if (view.name === 'map-demo') return '#/mapa'
  if (view.name === 'dashboard') return '#/dashboard'
  return '#/casos'
}

function authScreenFromHash(hash: string): AuthScreenName {
  return hash.replace(/^#\/?/, '').startsWith('registro') ? 'registro' : 'login'
}

function App() {
  const { session, status, error, signIn, signUp, signOut } = useSession()
  const [authScreen, setAuthScreen] = useState<AuthScreenName>(() =>
    authScreenFromHash(location.hash),
  )
  const [view, setView] = useState<View>(() => viewFromHash(location.hash))
  // True only while the entrance transition plays, so the map sharpening and
  // the veil stay in step with each other.
  const [entering, setEntering] = useState(false)
  // A focused field darkens the world behind the panel — see AuthScreen.
  const [authFocused, setAuthFocused] = useState(false)

  useEffect(() => {
    function onHashChange() {
      setView(viewFromHash(location.hash))
      setAuthScreen(authScreenFromHash(location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Signed in, but the URL still points at an auth screen — e.g. the teacher
  // just registered through #/registro. Point it at the screen being shown.
  useEffect(() => {
    if (!session) return
    const hash = location.hash
    if (hash.startsWith('#/registro') || hash.startsWith('#/login')) {
      history.replaceState(null, '', hashFor(view))
    }
  }, [session, view])

  useEffect(() => {
    if (!entering) return
    const timer = setTimeout(() => setEntering(false), ENTRANCE_MS)
    return () => clearTimeout(timer)
  }, [entering])

  /**
   * Only a fresh sign-in plays the entrance; restoring a token must not.
   *
   * Signing in lands on the map, not on casos: the map is the reward for
   * entering, and it is the only screen that shows it.
   */
  async function enterWorld(
    credentials: Credentials,
    authenticate: (credentials: Credentials) => Promise<boolean>,
  ) {
    if (!(await authenticate(credentials))) return
    location.hash = '#/mapa'
    setEntering(true)
  }

  // A stored token is being checked. Rendering the login here would flash it
  // away half a second later for anyone already signed in.
  if (status === 'restoring') {
    return (
      <>
        <Scene variant="journal" />
        <p className="app-restoring" data-testid="app-restoring">
          Recuperando tu sesión…
        </p>
      </>
    )
  }

  if (!session) {
    return (
      <>
        {/* The campsite at dusk — deliberately not the map. Seeing the map
            here would spend its impact before the user ever arrives. */}
        <Scene variant="gate" entering attentive={authFocused} />
        {authScreen === 'login' ? (
          <Login
            onSubmit={(credentials) => enterWorld(credentials, signIn)}
            pending={status === 'signing-in'}
            error={error}
            onFocusChange={setAuthFocused}
            onSwitchToRegister={() => {
              location.hash = '#/registro'
            }}
          />
        ) : (
          <Registro
            onSubmit={(credentials) => enterWorld(credentials, signUp)}
            pending={status === 'signing-in'}
            error={error}
            onFocusChange={setAuthFocused}
            onSwitchToLogin={() => {
              location.hash = '#/login'
            }}
          />
        )}
      </>
    )
  }

  const route: RouteName = view.name === 'map-demo' ? 'mapa' : view.name === 'dashboard' ? 'dashboard' : 'casos'
  // The map is the world; everything else happens at the explorer's desk.
  const scene: SceneVariant = view.name === 'map-demo' ? 'world' : 'journal'

  return (
    <>
      <Scene variant={scene} entering={entering} />
      {entering && <CinematicOverlay caption="Tu mundo te espera" />}

      <main
        className="app"
        data-testid="app"
        data-route={route}
        data-state={entering ? 'entering' : 'idle'}
      >
        <AppHeader
          active={route}
          email={session.email}
          onNavigate={(next) => {
            location.hash = next === 'mapa' ? '#/mapa' : next === 'dashboard' ? '#/dashboard' : '#/casos'
          }}
          onSignOut={() => {
            signOut()
            location.hash = '#/login'
          }}
        />

        {view.name === 'cases' && (
          <CaseList
            token={session.token}
            ownerId={session.userId}
            onOpen={(caseId) => {
              location.hash = `#/caso/${caseId}`
            }}
          />
        )}
        {view.name === 'case' && (
          <CaseForm
            key={view.caseId}
            token={session.token}
            caseId={view.caseId}
            ownerId={session.userId}
            onBack={() => {
              location.hash = '#/casos'
            }}
            onDeleted={() => {
              location.hash = '#/casos'
            }}
          />
        )}
        {view.name === 'map-demo' && <MapOverview token={session.token} />}
        {view.name === 'dashboard' && <Dashboard token={session.token} />}
      </main>
    </>
  )
}

/**
 * The map isn't a case editor — it just shows where the most recently
 * touched case stands. Its own hooks so they only run while this route is
 * actually mounted, instead of every route paying for a second case fetch.
 */
function MapOverview({ token }: { token: string }) {
  const { cases, status } = useCases(token)
  const { avatarId, setAvatarId } = useAvatar()

  if (status === 'loading') return <p className="app-restoring">Abriendo el mapa…</p>
  if (cases.length === 0) {
    return <p className="app-restoring">Crea tu primera aventura para ver el mapa.</p>
  }

  const latest = cases[0]
  return (
    <>
      <AvatarPicker avatarId={avatarId} onSelect={setAvatarId} />
      <OwlTip tipId="map-guide" />
      <CaseMap stage={toCaseStage(latest.estadoInteractivo.estacionActual)} />
    </>
  )
}

export default App
