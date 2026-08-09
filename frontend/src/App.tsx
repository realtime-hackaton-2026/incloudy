import { useEffect, useState } from 'react'
import { useSession } from './auth'
import type { Credentials } from './auth'
import { useCases } from './cases'
import { avatarById, readAvatarId } from './avatar'
import { AppHeader } from './components/app-header'
import type { RouteName } from './components/app-header'
import { CaseForm } from './components/case-form'
import { CaseList } from './components/case-list'
import { CinematicOverlay } from './components/cinematic-overlay'
import { Login } from './components/login'
import { Registro } from './components/registro'
import { Scene } from './components/scene'
import { Dashboard } from './dashboard/Dashboard'
import type { SceneVariant } from './components/scene'
import { toCaseStage } from './components/case-map'
import { OwlDoor } from './owl'
import { TourOverlay, useTour } from './tour'

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
  const { session, status, error, signIn, signUp, updateProfile, signOut } = useSession()
  const [authScreen, setAuthScreen] = useState<AuthScreenName>(() =>
    authScreenFromHash(location.hash),
  )
  const [view, setView] = useState<View>(() => viewFromHash(location.hash))
  // True only while the entrance transition plays, so the map sharpening and
  // the veil stay in step with each other.
  const [entering, setEntering] = useState(false)
  // A focused field darkens the world behind the panel — see AuthScreen.
  const [authFocused, setAuthFocused] = useState(false)
  // Up here with the other hooks: the auth screens return early below, and a
  // hook cannot live on the far side of a return. `null` while signed out
  // keeps the tour from arming behind the login.
  const tour = useTour(session ? view.name : null)

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
  async function enterWorld<T extends Credentials>(
    credentials: T,
    authenticate: (credentials: T) => Promise<boolean>,
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
      {/* Held back until the entrance finishes: the tour points at elements
          the cinematic is still sliding into place. */}
      {!entering && tour.step !== null && (
        <TourOverlay
          screen={view.name}
          step={tour.step}
          total={tour.total}
          onNext={tour.next}
          onBack={tour.back}
          onSkip={tour.skip}
          onSkipAll={tour.skipAll}
        />
      )}

      <main
        className="app"
        data-testid="app"
        data-route={route}
        data-state={entering ? 'entering' : 'idle'}
      >
        <AppHeader
          active={route}
          nombre={session.nombre}
          email={session.email}
          seccion={session.seccion}
          token={session.token}
          onUpdateProfile={updateProfile}
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
        {view.name === 'map-demo' && <MapOverview token={session.token} ownerId={session.userId} />}
        {view.name === 'dashboard' && <Dashboard token={session.token} />}
      </main>

      {view.name !== 'dashboard' && (
        <PersistentRoomAccess
          token={session.token}
          currentCaseId={view.name === 'case' ? view.caseId : null}
        />
      )}
    </>
  )
}

function PersistentRoomAccess({ token, currentCaseId }: { token: string; currentCaseId: string | null }) {
  const { cases, status } = useCases(token)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() =>
    currentCaseId ?? localStorage.getItem('burix-active-room-case'),
  )
  const [routeCaseId, setRouteCaseId] = useState(currentCaseId)

  if (routeCaseId !== currentCaseId) {
    setRouteCaseId(currentCaseId)
    if (currentCaseId) setSelectedCaseId(currentCaseId)
  }

  if (status === 'loading' || cases.length === 0) return null

  const selected = cases.find((item) => item.id === selectedCaseId)
  const current = cases.find((item) => item.id === currentCaseId)
  const roomCase = selected ?? current ?? cases.find((item) => item.burixShared) ?? cases[0]

  function selectRoomCase(caseId: string) {
    if (!cases.some((item) => item.id === caseId)) return
    setSelectedCaseId(caseId)
    localStorage.setItem('burix-active-room-case', caseId)
  }

  return (
    <OwlDoor
      token={token}
      caseId={roomCase.id}
      joinCode={roomCase.joinCode}
      studentName={roomCase.alumno.nombre || 'Alumno sin nombre'}
      studentAge={roomCase.alumno.edad}
      studentCourse={roomCase.alumno.curso}
      studentDescription={roomCase.alumno.descripcion}
      stage={toCaseStage(roomCase.estadoInteractivo.estacionActual)}
      onSelectCase={selectRoomCase}
    />
  )
}

/**
 * The map isn't a case editor — it just shows where the most recently
 * touched case stands. Its own hooks so they only run while this route is
 * actually mounted, instead of every route paying for a second case fetch.
 */
function MapOverview({ token, ownerId }: { token: string; ownerId: string | null }) {
  const { cases, status } = useCases(token)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [avatarRevision, setAvatarRevision] = useState(0)

  if (status === 'loading') return <p className="app-restoring">Abriendo el mapa…</p>
  if (cases.length === 0) {
    return <p className="app-restoring">Crea tu primera aventura para ver el mapa.</p>
  }

  // Derived, not synced: a stale or empty id simply resolves to the first
  // case, so nothing needs an effect to keep the selection valid.
  const selected = cases.find((item) => item.id === selectedCaseId) ?? cases[0]
  return (
    <>
      <section className="map-case-selector" aria-labelledby="map-case-selector-title" data-avatar-revision={avatarRevision}>
        <div className="map-case-selector__heading">
          <div>
            <span>Recorridos disponibles</span>
            <h1 id="map-case-selector-title">Selecciona un caso</h1>
          </div>
          <strong>{cases.length} {cases.length === 1 ? 'caso' : 'casos'}</strong>
        </div>
        <div className="map-case-selector__list" role="listbox" aria-label="Casos del mapa">
          {cases.map((item) => {
            const active = item.id === selected.id
            const shared = ownerId !== null && item.profesorId !== ownerId
            const avatar = avatarById(readAvatarId(item.id))
            return (
              <article key={item.id} className={`map-case-option ${active ? 'map-case-option--active' : ''}`}>
                <button
                  type="button"
                  className="map-case-option__select"
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelectedCaseId(item.id)}
                >
                  <img src={avatar.src} alt="" />
                  <span>
                    <strong>{item.alumno.nombre || 'Alumno sin nombre'}</strong>
                    <small>{shared ? 'Compartido contigo' : `${item.progreso.porcentaje}% completado`}</small>
                  </span>
                </button>
                {!shared && (
                  <button
                    type="button"
                    className="map-case-option__edit"
                    onClick={() => { location.hash = `#/caso/${item.id}` }}
                    aria-label={`Editar el caso de ${item.alumno.nombre || 'este alumno'}`}
                  >
                    ✎ Editar
                  </button>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <CaseForm
        key={selected.id}
        token={token}
        caseId={selected.id}
        ownerId={ownerId}
        onBack={() => {}}
        onDeleted={() => {}}
        onAvatarChange={() => setAvatarRevision((value) => value + 1)}
        mapOnly
      />
    </>
  )
}

export default App
