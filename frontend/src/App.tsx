import { useState } from 'react'
import { useSession } from './auth'
import { CaseForm } from './components/case-form'
import { CaseList } from './components/case-list'
import { CaseMap } from './components/case-map'
import type { CaseStage } from './components/case-map'
import { Login } from './components/login'
import { Registro } from './components/registro'

type AuthScreenName = 'login' | 'registro'
type View = { name: 'cases' } | { name: 'case'; caseId: string } | { name: 'map-demo' }

function App() {
  const { session, status, error, signIn, signUp, signOut } = useSession()
  const [authScreen, setAuthScreen] = useState<AuthScreenName>('login')
  const [view, setView] = useState<View>({ name: 'cases' })

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
        onSwitchToRegister={() => setAuthScreen('registro')}
      />
    ) : (
      <Registro
        onSubmit={signUp}
        pending={status === 'signing-in'}
        error={error}
        onSwitchToLogin={() => setAuthScreen('login')}
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
          <button type="button" className="app-signout" onClick={signOut}>
            Salir
          </button>
        </span>
      </header>

      <nav className="app-nav">
        <button
          type="button"
          className={view.name === 'cases' || view.name === 'case' ? 'app-nav-active' : ''}
          onClick={() => setView({ name: 'cases' })}
        >
          Tus casos
        </button>
        <button
          type="button"
          className={view.name === 'map-demo' ? 'app-nav-active' : ''}
          onClick={() => setView({ name: 'map-demo' })}
        >
          Mapa (demo)
        </button>
      </nav>

      {view.name === 'cases' && (
        <CaseList
          token={session.token}
          ownerId={session.userId}
          onOpen={(caseId) => setView({ name: 'case', caseId })}
        />
      )}
      {view.name === 'case' && (
        <CaseForm
          key={view.caseId}
          token={session.token}
          caseId={view.caseId}
          ownerId={session.userId}
          onBack={() => setView({ name: 'cases' })}
          onDeleted={() => setView({ name: 'cases' })}
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
    </main>
  )
}

export default App
