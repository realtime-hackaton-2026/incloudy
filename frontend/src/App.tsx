import { useState } from 'react'
import { useSession } from './auth'
import { CaseMap } from './components/case-map'
import type { CaseStage } from './components/case-map'
import { Login } from './components/login'

function App() {
  const { session, status, error, signIn, signOut } = useSession()

  // Local for now. Once the case API is wired, this comes from the selected
  // case and moves when the backend says it moved.
  const [stage, setStage] = useState<CaseStage>('explorar')

  // A stored token is being checked. Rendering the login here would flash it
  // away half a second later for anyone already signed in.
  if (status === 'restoring') {
    return <p className="app-restoring">Recuperando tu sesión…</p>
  }

  if (!session) {
    return <Login onSubmit={signIn} pending={status === 'signing-in'} error={error} />
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>incloudy</h1>
        <p>El caso de un alumno avanza por cinco etapas. Elige una estación para moverlo.</p>
        <span className="app-session">
          {session.email}
          <button type="button" className="app-signout" onClick={signOut}>
            Salir
          </button>
        </span>
      </header>

      <CaseMap stage={stage} onSelectStage={setStage} />
    </main>
  )
}

export default App
