import { useEffect, useState } from 'react'
import { useSession } from './auth'
import { CaseForm } from './components/case-form'
import { CaseList } from './components/case-list'
import { CaseMap } from './components/case-map'
import type { CaseStage } from './components/case-map'
import { Login } from './components/login'
import { Registro } from './components/registro'
import DataStationPage from './pages/DataStationPage'
import PistasPage from './pages/PistasPage'

type AuthScreenName = 'login' | 'registro'
type View =
  | { name: 'cases' }
  | { name: 'case'; caseId: string }
  | { name: 'map-demo' }
  | { name: 'data-station' }
  | { name: 'pistas' }

/*
 * Every screen has a URL (#/casos, #/caso/:id, #/mapa, #/data-station,
 * #/pistas, #/login, #/registro) so the frontend README and the browser
 * back button can point at it directly. State changes always go through
 * the hash; the hashchange event is the only writer of `view` and
 * `authScreen`.
 */

function viewFromHash(hash: string): View {
  const [first, second] = hash.replace(/^#\/?/, '').split('/')
  if (first === 'mapa') return { name: 'map-demo' }
  if (first === 'data-station') return { name: 'data-station' }
  if (first === 'pistas') return { name: 'pistas' }
  if (first === 'caso' && second) return { name: 'case', caseId: second }
  return { name: 'cases' }
}

function hashFor(view: View): string {
  if (view.name === 'case') return `#/caso/${view.caseId}`
  if (view.name === 'map-demo') return '#/mapa'
  if (view.name === 'data-station') return '#/data-station'
  if (view.name === 'pistas') return '#/pistas'
  return '#/casos'
}

function authScreenFromHash(hash: string): AuthScreenName {
  return hash.replace(/^#\/?/, '').startsWith('registro') ? 'registro' : 'login'
}

function App() {
  const { session, status, error, signIn, signUp, signOut } = useSession()
  const [authScreen, setAuthScreen] = useState<AuthScreenName>(() => authScreenFromHash(location.hash))
  const [view, setView] = useState<View>(() => viewFromHash(location.hash))

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

  // Demo only: the map has no real case wired in yet. The five fixed stages
  // here and the backend's freeform `estaciones` checklist are two
  // unreconciled data models — see docs/memoria.md for why this waits.
  const [demoStage, setDemoStage] = useState<CaseStage>('explorar')

  // A stored token is being checked. Rendering the login here would flash it
  // away half a second later for anyone already signed in.
  if (status === 'restoring') {
    return <p className="app-restoring">Recuperando tu sesión…</p>
  }

  if (!session) {
    return authScreen === 'login' ? (
      <Login
        onSubmit={signIn}
        pending={status === 'signing-in'}
        error={error}
        onSwitchToRegister={() => {
          location.hash = '#/registro'
        }}
      />
    ) : (
      <Registro
        onSubmit={signUp}
        pending={status === 'signing-in'}
        error={error}
        onSwitchToLogin={() => {
          location.hash = '#/login'
        }}
      />
    )
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>incloudy</h1>
        <p>Sigue a tus alumnos caso por caso, estación por estación.</p>
        <span className="app-session">
          {session.email}
          <button
            type="button"
            className="app-signout"
            onClick={() => {
              signOut()
              location.hash = '#/login'
            }}
          >
            Salir
          </button>
        </span>
      </header>

      <nav className="app-nav">
        <button
          type="button"
          className={view.name === 'cases' || view.name === 'case' ? 'app-nav-active' : ''}
          onClick={() => {
            location.hash = '#/casos'
          }}
        >
          Tus casos
        </button>
        <button
          type="button"
          className={view.name === 'map-demo' ? 'app-nav-active' : ''}
          onClick={() => {
            location.hash = '#/mapa'
          }}
        >
          Mapa (demo)
        </button>
        <button
          type="button"
          className={view.name === 'data-station' ? 'app-nav-active' : ''}
          onClick={() => {
            location.hash = '#/data-station'
          }}
        >
          Data Station
        </button>
        <button
          type="button"
          className={view.name === 'pistas' ? 'app-nav-active' : ''}
          onClick={() => {
            location.hash = '#/pistas'
          }}
        >
          Pistas
        </button>
      </nav>

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
        <>
          <p className="app-demo-note">
            Vista de demostración: todavía no refleja un caso real. Elige una estación para
            moverla.
          </p>
          <CaseMap stage={demoStage} onSelectStage={setDemoStage} />
        </>
      )}
      {view.name === 'data-station' && (
        <DataStationPage
          onBack={() => {
            location.hash = '#/casos'
          }}
        />
      )}
      {view.name === 'pistas' && (
        <PistasPage
          onBack={() => {
            location.hash = '#/casos'
          }}
        />
      )}
    </main>
  )
}

export default App
