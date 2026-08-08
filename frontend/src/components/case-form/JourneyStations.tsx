/*
 * frontend/src/components/case-form/JourneyStations.tsx // one journey
 * station's real form — options, a comment, and its own save. Station order
 * isn't enforced here; the server is authoritative on unlocking and already
 * returns a specific, Spanish, show-as-is message on a locked one, which
 * this renders as a themed warning rather than a plain error line.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../../lib/http'
import type { QuestionType, TemplateStation } from '../../journeys'
import type { StationAnswer } from '../../cases'
import styles from './CaseForm.module.css'

export interface StationCardProps {
  station: TemplateStation
  answer: StationAnswer | null
  editable: boolean
  onAnswer: (
    orden: number,
    input: { opcionesSeleccionadas: string[]; comentario?: string },
  ) => Promise<void>
}

export function StationCard({ station, answer, editable, onAnswer }: StationCardProps) {
  const [selected, setSelected] = useState<string[]>(answer?.opcionesSeleccionadas ?? [])
  const [comentario, setComentario] = useState(answer?.comentario ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  function toggle(optionId: string) {
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
    } catch (cause) {
      setSaveState('error')
      setSaveError(cause instanceof ApiError ? cause.message : 'No se pudo guardar la estación.')
    }
  }

  const done = answer?.completado ?? false

  return (
    <form
      className={styles.stationCard}
      data-testid={`station-${station.id}`}
      data-state={done ? 'completed' : 'pending'}
      onSubmit={handleSubmit}
    >
      <div className={styles.stationCardHeader}>
        <span className={styles.stationCardBadge}>
          {String(station.orden).padStart(2, '0')}
        </span>
        <div>
          <h4 className={styles.stationCardTitle}>{station.titulo}</h4>
          {station.subtitulo && (
            <p className={styles.stationCardSubtitle}>{station.subtitulo}</p>
          )}
        </div>
        {done && <span className={styles.stationCardDone}>Completada</span>}
      </div>

      {station.descripcion && <p className={styles.stationCardBody}>{station.descripcion}</p>}

      <div
        className={styles.stationOptions}
        role={station.tipo === 'multiple' ? 'group' : 'radiogroup'}
        aria-label={station.titulo}
      >
        {station.opciones.map((option) => (
          <label key={option.id} className={styles.stationOption}>
            <input
              type={station.tipo === 'multiple' ? 'checkbox' : 'radio'}
              name={`station-${station.id}`}
              checked={selected.includes(option.id)}
              disabled={!editable}
              onChange={() => toggle(option.id)}
            />
            <span>{option.texto}</span>
          </label>
        ))}
      </div>

      <label className={styles.field}>
        Comentario (opcional)
        <textarea
          className={styles.textarea}
          value={comentario}
          disabled={!editable}
          onChange={(event) => setComentario(event.target.value)}
        />
      </label>

      {editable && (
        <div className={styles.stationCardFooter}>
          <button
            type="submit"
            className="btn-secondary"
            disabled={saveState === 'saving' || (station.obligatoria && selected.length === 0)}
          >
            {saveState === 'saving' ? 'Guardando…' : 'Guardar respuesta'}
          </button>
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
