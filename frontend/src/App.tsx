import { useEffect, useState } from 'react'
import { useSession } from './auth'
import type { Credentials } from './auth'
import { AppHeader } from './components/app-header'
import type { RouteName } from './components/app-header'
import { CaseForm } from './components/case-form'
import { CaseList } from './components/case-list'
import { CaseMap } from './components/case-map'
import type { CaseStage } from './components/case-map'
import { CinematicOverlay } from './components/cinematic-overlay'
import { Login } from './components/login'
import { MapEnvironment } from './components/map-environment'
import { Registro } from './components/registro'

type AuthScreenName = 'login' | 'registro'
type View = { name: 'cases' } | { name: 'case'; caseId: string } | { name: 'map-demo' }

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
  if (first === 'caso' && second) return { name: 'case', caseId: second }
  return { name: 'cases' }
}

function hashFor(view: View): string {
  if (view.name === 'case') return `#/caso/${view.caseId}`
  if (view.name === 'map-demo') return '#/mapa'
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

  // Demo only: the map has no real case wired in yet. The five fixed stages
  // here and the backend's freeform `estaciones` checklist are two
  // unreconciled data models — see docs/memoria.md for why this waits.
  const [demoStage, setDemoStage] = useState<CaseStage>('explorar')

  /** Only a fresh sign-in plays the entrance; restoring a token must not. */
  async function enterWorld(
    credentials: Credentials,
    authenticate: (credentials: Credentials) => Promise<boolean>,
  ) {
    if (await authenticate(credentials)) setEntering(true)
  }

  // A stored token is being checked. Rendering the login here would flash it
  // away half a second later for anyone already signed in.
  if (status === 'restoring') {
    return (
      <>
        <MapEnvironment depth="ambient" />
        <p className="app-restoring">Recuperando tu sesión…</p>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <MapEnvironment
          depth="full"
          // Scene 02 on a cold open; a focused field pushes the world back
          // so the panel owns the attention.
          phase={authFocused ? 'idle' : 'entering'}
        />
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

  const route: RouteName = view.name === 'map-demo' ? 'mapa' : 'casos'

  return (
    <>
      <MapEnvironment depth="ambient" phase={entering ? 'sharpening' : 'idle'} />
      {entering && <CinematicOverlay />}

      <main className="app">
        <AppHeader
          active={route}
          email={session.email}
          onNavigate={(next) => {
            location.hash = next === 'mapa' ? '#/mapa' : '#/casos'
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
        {view.name === 'map-demo' && (
          <CaseMap stage={demoStage} onSelectStage={setDemoStage} />
        )}
      </main>
    </>
  )
}

export default App
