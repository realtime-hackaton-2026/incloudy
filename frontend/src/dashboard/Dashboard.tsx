import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useCases } from '../cases'
import type { Case } from '../cases'
import { OwlDoor } from '../owl'
import { toCaseStage } from '../components/case-map'
import { listCaseComments, listCaseEvents } from './api'
import type { CaseEvent, PortalComment } from './api'
import styles from './Dashboard.module.css'

const STAGES = [
  { id: 'explorar', label: 'Explorar' },
  { id: 'orientar', label: 'Orientar' },
  { id: 'actuar', label: 'Actuar' },
  { id: 'acompanar', label: 'Acompañar' },
  { id: 'compartir', label: 'Compartir' },
]

function stageLabel(stage: string) {
  return STAGES.find((item) => item.id === stage)?.label ?? stage.replaceAll('_', ' ')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function messageText(comment: PortalComment) {
  const body = comment.content.body
  return typeof body === 'string' ? body : 'Nuevo comentario del equipo.'
}

function eventText(event: CaseEvent) {
  const labels: Record<string, string> = {
    estacion_respondida: 'El recorrido avanzó en una estación',
    seguimiento_agregado: 'Se añadió un seguimiento',
    comentario_portal: 'Nuevo comentario en la sala',
    resumen_editado: 'Se actualizó el resumen',
    caso_completado: 'El caso quedó completado',
    caso_publicado: 'El caso fue publicado',
  }
  return labels[event.event] ?? event.event.replaceAll('_', ' ')
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
}

export interface DashboardProps {
  token: string
}

export function Dashboard({ token }: DashboardProps) {
  const { cases, status } = useCases(token)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [events, setEvents] = useState<CaseEvent[]>([])
  const [comments, setComments] = useState<PortalComment[]>([])

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedId) ?? cases[0] ?? null,
    [cases, selectedId],
  )

  const selectedCaseId = selectedCase?.id

  useEffect(() => {
    if (!selectedCaseId) return
    let active = true
    Promise.all([listCaseEvents(token, selectedCaseId), listCaseComments(token, selectedCaseId)])
      .then(([nextEvents, nextComments]) => {
        if (!active) return
        setEvents(nextEvents)
        setComments(nextComments)
      })
    return () => {
      active = false
    }
  }, [token, selectedCaseId])

  const activeCases = cases.filter((item) => !['cerrado', 'archivado'].includes(item.status))
  const averageProgress = average(activeCases.map((item) => item.progreso.porcentaje))
  const averageConfidence = average(activeCases.map((item) => item.estadoInteractivo.confianzaEquipo))
  const totalXp = activeCases.reduce((sum, item) => sum + item.estadoInteractivo.xpTotal, 0)

  const activity = useMemo(() => {
    const eventItems = events.map((item) => ({
      id: `event-${item.id}`,
      date: item.createdAt,
      kind: 'event' as const,
      text: eventText(item),
    }))
    const commentItems = comments.map((item) => ({
      id: `comment-${item.id}`,
      date: item.portalTimestamp,
      kind: 'comment' as const,
      text: messageText(item),
    }))
    return [...eventItems, ...commentItems].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8)
  }, [events, comments])

  if (status === 'loading') return <p className={styles.state}>Preparando el panel…</p>
  if (status === 'error') return <p className={`${styles.state} ${styles.error}`}>No se pudo cargar el panel.</p>

  return (
    <section className={styles.dashboard} data-testid="dashboard">
      <header className={styles.hero}>
        <div>
          <p className="eyebrow">Panel docente · visión del recorrido</p>
          <h1>Dashboard</h1>
          <p className={styles.lead}>Una lectura limpia de lo que está ocurriendo en las aventuras de tu equipo.</p>
        </div>
        <div className={styles.liveBadge}><span /> En vivo</div>
      </header>

      <div className={styles.metrics}>
        <Metric label="Casos activos" value={String(activeCases.length)} />
        <Metric label="Progreso medio" value={`${averageProgress}%`} />
        <Metric label="Confianza del equipo" value={`${averageConfidence}%`} />
        <Metric label="XP acumulado" value={String(totalXp)} />
      </div>

      {cases.length === 0 ? (
        <div className={styles.emptyPanel}>
          <p className="eyebrow">Sin recorrido todavía</p>
          <h2>El mapa está esperando su primera aventura.</h2>
          <p>Crea un caso desde Aventuras y aquí aparecerán su progreso, decisiones y actividad del equipo.</p>
        </div>
      ) : (
        <div className={styles.layout}>
          <aside className={styles.caseRail} aria-label="Casos">
            <div className={styles.sectionHeading}>
              <div>
                <p className="eyebrow">Seguimiento</p>
                <h2>Mis casos</h2>
              </div>
              <span>{cases.length}</span>
            </div>
            <div className={styles.caseList}>
              {cases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.caseItem} ${selectedCase?.id === item.id ? styles.caseItemActive : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className={styles.caseDot} />
                  <span className={styles.caseCopy}>
                    <strong>{item.alumno.nombre}</strong>
                    <small>{stageLabel(item.estadoInteractivo.estacionActual)}</small>
                  </span>
                  <span className={styles.casePercent}>{item.progreso.porcentaje}%</span>
                </button>
              ))}
            </div>
          </aside>

          {selectedCase && (
            <DashboardCase
              token={token}
              item={selectedCase}
              activity={activity}
              onLiveComment={(message) => {
                setComments((current: PortalComment[]) => [message, ...current.filter((comment) => comment.messageId !== message.messageId)])
              }}
            />
          )}
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

interface DashboardCaseProps {
  token: string
  item: Case
  activity: { id: string; date: string; kind: 'event' | 'comment'; text: string }[]
  onLiveComment: (message: PortalComment) => void
}

function DashboardCase({ token, item, activity, onLiveComment }: DashboardCaseProps) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === item.estadoInteractivo.estacionActual)
  const clues = item.estadoInteractivo.pistasRecogidas
  return (
    <main className={styles.detail}>
      <div className={styles.detailTop}>
        <div>
          <p className="eyebrow">Caso seleccionado</p>
          <h2>{item.alumno.nombre}</h2>
          <p>{item.alumno.curso ?? 'Sin curso'} · {stageLabel(item.estadoInteractivo.estacionActual)}</p>
        </div>
        <div className={styles.progressRing} style={{ '--progress': `${item.progreso.porcentaje}%` } as CSSProperties}>
          <strong>{item.progreso.porcentaje}%</strong>
          <span>recorrido</span>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <div><p className="eyebrow">Ruta</p><h3>Las cinco estaciones</h3></div>
          <span>{item.progreso.completadas}/{item.progreso.total}</span>
        </div>
        <div className={styles.journey}>
          {STAGES.map((stage, index) => (
            <div key={stage.id} className={`${styles.station} ${index <= currentIndex ? styles.stationDone : ''} ${index === currentIndex ? styles.stationCurrent : ''}`}>
              <span className={styles.stationMarker}>{index + 1}</span>
              <span>{stage.label}</span>
              {index < STAGES.length - 1 && <i />}
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary" onClick={() => { location.hash = `#/caso/${item.id}` }}>
          Abrir recorrido e interactuar con la estación
        </button>
      </section>

      <div className={styles.signalGrid}>
        <Signal label="Confianza" value={`${item.estadoInteractivo.confianzaEquipo}%`} />
        <Signal label="Días restantes" value={String(item.estadoInteractivo.diasRestantes)} />
        <Signal label="Pistas" value={String(clues.length)} />
        <Signal label="XP" value={String(item.estadoInteractivo.xpTotal)} />
      </div>

      <div className={styles.lowerGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeading}><div><p className="eyebrow">Lectura del recorrido</p><h3>Decisiones clave</h3></div></div>
          <div className={styles.decisions}>
            <Decision label="Hipótesis" value={item.estadoInteractivo.hipotesisSostenida} />
            <Decision label="Estrategia" value={item.estadoInteractivo.estrategiaElegida} />
            <Decision label="Seguimiento" value={item.estadoInteractivo.seguimientoElegido} />
          </div>
          {clues.length > 0 && <div className={styles.clues}><span className="eyebrow">Pistas recogidas</span><div>{clues.map((clue) => <span key={clue}>{clue}</span>)}</div></div>}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeading}><div><p className="eyebrow">Actividad</p><h3>Lo que está pasando</h3></div></div>
          {activity.length === 0 ? <p className={styles.muted}>Todavía no hay actividad registrada.</p> : (
            <ul className={styles.activity}>
              {activity.map((entry) => <li key={entry.id}><span className={entry.kind === 'comment' ? styles.activityDotLive : styles.activityDot} /><div><strong>{entry.text}</strong><small>{formatDate(entry.date)}</small></div></li>)}
            </ul>
          )}
        </section>
      </div>

      <section className={styles.chatCard}>
        <div className={styles.chatIntro}>
          <p className="eyebrow">Colaboración en tiempo real</p>
          <h3>Sala del equipo</h3>
          <p>Abre al búho para entrar en la sala privada del caso. Desde ahí puedes invitar a otra persona y conversar en tiempo real.</p>
        </div>
        <OwlDoor
          token={token}
          caseId={item.id}
          stage={toCaseStage(item.estadoInteractivo.estacionActual)}
          onMessage={(message) => {
            onLiveComment({
              id: message.id,
              messageId: message.id,
              caseId: item.id,
              authorId: message.sender.id,
              content: { body: message.content.body },
              portalTimestamp: new Date(message.timestamp).toISOString(),
            })
          }}
        />
      </section>
    </main>
  )
}

function Signal({ label, value }: { label: string; value: string }) {
  return <article className={styles.signal}><span>{label}</span><strong>{value}</strong></article>
}

function Decision({ label, value }: { label: string; value: string | null }) {
  return <div className={styles.decision}><span>{label}</span><strong>{value ?? 'Pendiente'}</strong></div>
}
