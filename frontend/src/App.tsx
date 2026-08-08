import './App.css'
import { useAuth } from './context/useAuth'
import LoginForm from './components/LoginForm'
import CasesPanel from './components/CasesPanel'
import ChatPanel from './components/ChatPanel'

function App() {
  const { isAuthenticated, loading, email, logout } = useAuth()

  if (loading) {
    return (
      <section id="center">
        <p>Cargando…</p>
      </section>
    )
  }

  if (!isAuthenticated) {
    return (
      <section id="center">
        <LoginForm />
      </section>
    )
  }

  return (
    <section id="center">
      <header className="app-header">
        <span>Conectado como {email}</span>
        <button type="button" onClick={logout}>
          Cerrar sesión
        </button>
      </header>

      <div className="dashboard">
        <CasesPanel />
        <ChatPanel />
      </div>
    </section>
  )
}

export default App
