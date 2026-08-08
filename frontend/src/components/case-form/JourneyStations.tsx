/*
 * frontend/src/components/case-form/JourneyStations.tsx // a station as a
 * quest: the question first, then the consequence of the choice — never the
 * whole form at once.
 *
 * The five BRÚJULA stations share one answer shell, but each exposes the
 * narrative interaction attached to its choices: evidence and contrasts,
 * voices, intervention details, follow-up indicators, and stakeholder
 * reactions. The source content lives in the JourneyTemplate.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { ApiError } from '../../lib/http'
import type { QuestionType, StationOption, TemplateStation } from '../../journeys'
import type { StationAnswer, Student } from '../../cases'
import styles from './CaseForm.module.css'

/**
 * Deterministic particle burst for the completion beat — angles and delays
 * are fixed values, not `Math.random()`, so a render is reproducible (and a
 * test can assert the celebration without seeding anything).
 */
const BURST: ReadonlyArray<{ dx: number; dy: number; delay: number; size: number }> = [
  { dx: -84, dy: -38, delay: 0, size: 9 },
  { dx: 0, dy: -92, delay: 30, size: 7 },
  { dx: 84, dy: -38, delay: 60, size: 10 },
  { dx: 96, dy: 22, delay: 15, size: 7 },
  { dx: -96, dy: 22, delay: 45, size: 8 },
  { dx: 56, dy: 84, delay: 0, size: 7 },
  { dx: -56, dy: 84, delay: 75, size: 6 },
  { dx: 0, dy: 96, delay: 90, size: 8 },
  { dx: -30, dy: -70, delay: 105, size: 5 },
  { dx: 30, dy: -70, delay: 55, size: 5 },
]

export interface StationCardProps {
  station: TemplateStation
  student: Student
  answer: StationAnswer | null
  editable: boolean
  onAnswer: (
    orden: number,
    input: { opcionesSeleccionadas: string[]; comentario?: string },
  ) => Promise<void>
  onContinue?: () => void
  onFinish?: () => Promise<void>
  headerActionTargetId?: string
}

function optionContent(option: StationOption, key: string): unknown {
  return option.contenido?.[key]
}

function selectedOptions(station: TemplateStation, selected: string[]) {
  return station.opciones.filter((option) => selected.includes(option.id))
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function personalizeText(value: unknown, student: Student): string {
  return String(value ?? '').replace(/\bAlex\b/g, student.nombre || 'el alumno')
}

function caseIntroduction(student: Student): string {
  const name = student.nombre.trim() || 'El alumno'
  const details = [
    student.edad ? `${student.edad} años` : null,
    student.curso?.trim() || null,
  ].filter(Boolean).join(' · ')
  const description = student.descripcion.trim() || 'Este caso todavía no tiene una descripción.'
  return `${name}${details ? ` · ${details}` : ''}. ${description}`
}

function renderInteraction(station: TemplateStation, selected: string[], student: Student): ReactNode {
  const picked = selectedOptions(station, selected)

  if (station.id === 'explorar') {
    return (
      <div className={styles.interactionStack}>
        {picked.map((option) => {
          const evidence = optionContent(option, 'evidencia')
          const contrast = optionContent(option, 'lectura_alternativa')
          return (
            <article key={option.id} className={styles.interactionCard}>
              <strong>{option.icono} {option.texto}</strong>
              {typeof evidence === 'string' && <p>{personalizeText(evidence, student)}</p>}
              {typeof contrast === 'string' && (
                <p className={styles.contrast}>🔶 Otra lectura posible: {personalizeText(contrast, student)}</p>
              )}
              <span className={styles.cost}>−{String(optionContent(option, 'coste_dias') ?? 0)} día</span>
            </article>
          )
        })}
      </div>
    )
  }

  if (station.id === 'orientar') {
    return (
      <div className={styles.interactionStack}>
        {picked.map((option) => {
          const voices = optionContent(option, 'voces')
          return (
            <article key={option.id} className={styles.interactionCard}>
              <strong>{option.icono} {option.texto}</strong>
              {Array.isArray(voices) && voices.map((voice, index) => {
                const item = asRecord(voice)
                return (
                  <p key={index} className={styles.voice}>
                    <b>{personalizeText(item.autor ?? 'Voz', student)}:</b> “{personalizeText(item.texto ?? '', student)}”
                  </p>
                )
              })}
            </article>
          )
        })}
        {!picked.length && (
          <p className={styles.interactionHint}>
            Las voces asociadas aparecerán cuando sostengas una hipótesis.
          </p>
        )}
      </div>
    )
  }

  if (station.id === 'actuar') {
    return (
      <div className={styles.interactionStack}>
        {picked.map((option) => (
          <article key={option.id} className={styles.interactionCard}>
            <strong>{option.icono} {option.texto}</strong>
            {typeof optionContent(option, 'descripcion') === 'string' && (
              <p>{personalizeText(optionContent(option, 'descripcion'), student)}</p>
            )}
            {typeof optionContent(option, 'alineada_con') === 'string' && (
              <p className={styles.alignment}>
                🎯 Alineada con: {String(optionContent(option, 'alineada_con'))}
              </p>
            )}
            <span className={styles.cost}>−{String(optionContent(option, 'coste_dias') ?? 0)} día</span>
          </article>
        ))}
      </div>
    )
  }

  if (station.id === 'acompanar') {
    const indicators = station.contenido?.indicadores
    return (
      <div className={styles.interactionStack}>
        {Array.isArray(indicators) && (
          <div className={styles.indicators}>
            <span>Indicadores</span>
            <div>
              {indicators.map((indicator) => <b key={String(indicator)}>{String(indicator)}</b>)}
            </div>
          </div>
        )}
        {picked.map((option) => (
          <article key={option.id} className={styles.interactionCard}>
            <strong>{option.icono} {option.texto}</strong>
            <p>Impacto previsto en confianza: {String(optionContent(option, 'confianza') ?? 0)}</p>
          </article>
        ))}
      </div>
    )
  }

  if (station.id === 'compartir') {
    return (
      <div className={styles.interactionStack}>
        {picked.map((option) => (
          <article key={option.id} className={styles.interactionCard}>
            <strong>{option.icono} {option.texto}</strong>
            <p>La reacción dependerá de la coherencia entre tu hipótesis, la intervención y los datos.</p>
            {typeof optionContent(option, 'reaccion_coherente') === 'string' && (
              <p className={styles.reaction}>✓ {personalizeText(optionContent(option, 'reaccion_coherente'), student)}</p>
            )}
            {typeof optionContent(option, 'reaccion_incoherente') === 'string' && (
              <p className={styles.contrast}>↔ {personalizeText(optionContent(option, 'reaccion_incoherente'), student)}</p>
            )}
          </article>
        ))}
      </div>
    )
  }

  return null
}

export function StationCard({ station, student, answer, editable, onAnswer, onContinue, onFinish, headerActionTargetId }: StationCardProps) {
  const [selected, setSelected] = useState<string[]>(answer?.opcionesSeleccionadas ?? [])
  const [comentario, setComentario] = useState(answer?.comentario ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(Boolean(answer?.completado))
  const [editingAnswer, setEditingAnswer] = useState(false)
  const [finishState, setFinishState] = useState<'idle' | 'saving' | 'error'>('idle')
  // Re-read on every render so a header that mounts after this card is still
  // found; the direct read replaces the effect the set-state-in-effect rule
  // rejected.
  const headerActionTarget = headerActionTargetId ? document.getElementById(headerActionTargetId) : null

  const editButton = editable && showResult ? (
    <button
      type="button"
      className={`${styles.stationEditButton} ${headerActionTarget ? styles.stationEditButtonHeader : ''}`}
      onClick={() => {
        setEditingAnswer(true)
        setShowResult(false)
        setSaveState('idle')
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Zm13.5-16.5 3 3-1.5 1.5-3-3 1.5-1.5Z" /></svg>
      <span>Editar decisión</span>
    </button>
  ) : null

  function toggle(optionId: string) {
    // When correcting an already completed station, a new choice replaces
    // the previous decision instead of accumulating extra selections.
    if (editingAnswer) {
      setSelected([optionId])
      return
    }
    if (station.tipo === ('unica' as QuestionType)) {
      setSelected([optionId])
      return
    }
    setSelected((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveState('saving')
    setSaveError(null)
    try {
      await onAnswer(station.orden, { opcionesSeleccionadas: selected, comentario })
      setSaveState('saved')
      setShowResult(true)
      setEditingAnswer(false)
    } catch (cause) {
      setSaveState('error')
      setSaveError(cause instanceof ApiError ? cause.message : 'No se pudo guardar la estación.')
    }
  }

  const done = answer?.completado ?? false
  const interaction = renderInteraction(station, selected, student)

  /*
   * §8 — one decision at a time.
   *
   * A station opens as a question, not as a form to fill in: the consequence
   * of the choice, the notebook comment and the way forward only appear once
   * something has been chosen. Optional stations and already-answered ones
   * skip the gate, since there is no decision left to wait for.
   */
  const revealFollowUp = selected.length > 0 || !station.obligatoria || done

  return (
    <form
      className={styles.stationCard}
      data-testid={`station-${station.id}`}
      data-state={done ? 'completed' : 'pending'}
      data-step={revealFollowUp ? 'answering' : 'choosing'}
      onSubmit={handleSubmit}
    >
      <div className={styles.stationCardHeader}>
        <span className={styles.stationCardBadge}>{String(station.orden).padStart(2, '0')}</span>
        <div>
          <h4 className={styles.stationCardTitle}>{station.titulo}</h4>
          {station.subtitulo && <p className={styles.stationCardSubtitle}>{station.subtitulo}</p>}
        </div>
        {done && <span className={styles.stationCardDone}>Completada</span>}
      </div>

      {station.descripcion && <p className={styles.stationCardBody}>{station.descripcion}</p>}

      {typeof station.contenido?.introduccion === 'string' && (
        <p className={styles.stationIntro}>
          {station.id === 'explorar'
            ? caseIntroduction(student)
            : station.id === 'orientar'
            ? selected.length >= 2
              ? personalizeText(station.contenido.mensaje_dos_o_mas_pistas ?? station.contenido.introduccion, student)
              : personalizeText(station.contenido.mensaje_pocas_pistas ?? station.contenido.introduccion, student)
            : personalizeText(station.contenido.introduccion, student)}
        </p>
      )}

      <div
        className={styles.stationOptions}
        role={station.tipo === 'multiple' ? 'group' : 'radiogroup'}
        aria-label={station.titulo}
      >
        {station.opciones.map((option) => (
          <label key={option.id} className={`${styles.stationOption} ${selected.includes(option.id) ? styles.stationOptionSelected : ''}`}>
            <input
              type={station.tipo === 'multiple' ? 'checkbox' : 'radio'}
              name={`station-${station.id}`}
              checked={selected.includes(option.id)}
              disabled={!editable || showResult}
              onChange={() => toggle(option.id)}
            />
            <span>
              {option.icono && <span className={styles.optionIcon}>{option.icono}</span>}
              {option.texto}
            </span>
          </label>
        ))}
      </div>

      {revealFollowUp && (
        <div className={styles.stationFollowUp}>
          {interaction}

          <label className={styles.field}>
            Comentario (opcional)
            <textarea
              className={styles.textarea}
              value={comentario}
              // Both sides of the merge matter here: the comment waits for a
              // choice (§8), and it locks once the station is answered.
              disabled={!editable || showResult}
              onChange={(event) => setComentario(event.target.value)}
            />
          </label>
        </div>
      )}

      {showResult && (
        <div className={styles.stationResult} role="status" data-quest-state="done">
          <span className={styles.questBurst} data-testid="quest-burst" aria-hidden="true">
            {BURST.map((particle, index) => (
              <i
                key={index}
                className={styles.burstParticle}
                style={
                  {
                    '--dx': `${particle.dx}px`,
                    '--dy': `${particle.dy}px`,
                    '--delay': `${particle.delay}ms`,
                    '--size': `${particle.size}px`,
                  } as CSSProperties
                }
              />
            ))}
          </span>
          <span className={styles.stationResultIcon}>✦</span>
          <strong>
            {station.id === 'explorar' && 'Has investigado todo lo que había que ver aquí.'}
            {station.id === 'orientar' && 'HIPÓTESIS SOSTENIDA (no confirmada)'}
            {station.id === 'actuar' && 'Intervención preparada.'}
            {station.id === 'acompanar' && 'Seguimiento registrado en el cuaderno.'}
            {station.id === 'compartir' && 'Caso compartido con el equipo.'}
          </strong>
          {station.id === 'orientar' && <p>Aún no sabes si se sostendrá cuando lleguen los resultados.</p>}
          {editButton && (headerActionTarget ? createPortal(editButton, headerActionTarget) : editButton)}
          {editable && station.id === 'compartir' && onFinish ? (
            <button
              type="button"
              className={`btn-primary ${styles.stationChoiceAction}`}
              disabled={finishState === 'saving'}
              onClick={async () => {
                setFinishState('saving')
                try {
                  await onFinish()
                  onContinue?.()
                } catch {
                  setFinishState('error')
                }
              }}
            >
              {finishState === 'saving' ? 'Concluyendo…' : 'Concluir caso'}
            </button>
          ) : editable && onContinue ? (
            <button type="button" className={`btn-primary ${styles.stationChoiceAction}`} onClick={onContinue}>Continuar →</button>
          ) : null}
          {finishState === 'error' && <p className={styles.stationCardWarning}>⚠ No se pudo cerrar el caso.</p>}
        </div>
      )}

      {editable && !showResult && revealFollowUp && (
        <div className={styles.stationCardFooter}>
          <button
            type="submit"
            className="btn-secondary"
            disabled={saveState === 'saving' || (station.obligatoria && selected.length === 0)}
          >
            {saveState === 'saving'
              ? 'Guardando…'
              : editingAnswer
                ? 'Guardar cambios'
                : station.id === 'explorar'
                  ? 'Dar el caso por explorado'
                  : 'Continuar'}
          </button>
          {editingAnswer && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSelected(answer?.opcionesSeleccionadas ?? [])
                setComentario(answer?.comentario ?? '')
                setEditingAnswer(false)
                setShowResult(true)
              }}
            >
              Cancelar
            </button>
          )}
          {saveState === 'saved' && <span className={styles.stationCardSaved}>Guardado</span>}
        </div>
      )}

      {saveState === 'error' && (
        <p className={styles.stationCardWarning} role="alert">
          <span aria-hidden="true">⚠</span> {saveError}
        </p>
      )}
    </form>
  )
}
