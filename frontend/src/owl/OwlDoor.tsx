import { useState } from 'react'
import { addCollaborator } from '../cases/api'
import type { CollaboratorRole } from '../cases/api'
import { stationFor } from '../components/case-map/stations'
import type { CaseStage } from '../components/case-map/stations'
import { CaseRoom } from '../portal'
import { OwlSprite } from './OwlSprite'
import styles from './OwlDoor.module.css'

export interface OwlDoorProps {
  token: string
  caseId: string
  stage: CaseStage
}

export function OwlDoor({ token, caseId, stage }: OwlDoorProps) {
  const [open, setOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CollaboratorRole>('comentarista')
  const [inviteState, setInviteState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const station = stationFor(stage)

  async function handleInvite() {
    const value = email.trim()
    if (!value) return
    setInviteState('sending')
    setInviteError(null)
    try {
      await addCollaborator(token, caseId, value, role)
      setEmail('')
      setInviteState('sent')
    } catch (cause) {
      setInviteState('error')
      setInviteError(cause instanceof Error ? cause.message : 'No se pudo añadir al docente.')
    }
  }

  return (
    <aside className={styles.wrapper} data-testid="owl-door" data-state={open ? 'open' : 'closed'}>
      {!open && (
        <div className={styles.whisper} role="status">
          <strong>¿Nos reunimos?</strong>
          <span>Estoy aquí para que los docentes comentemos este caso juntos.</span>
        </div>
      )}

      <button
        type="button"
        className={styles.door}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="owl-door-room"
      >
        <span className={styles.owlHalo} aria-hidden="true">
          <OwlSprite className={styles.owl} />
        </span>
        <span className={styles.label}>
          <span className={styles.title}>{open ? 'Cerrar sala docente' : 'Reunir al equipo'}</span>
          <span className={styles.subtitle}>Búho · {station.label}</span>
        </span>
        <span className={styles.statusDot} aria-hidden="true" />
      </button>

      {open && (
        <div id="owl-door-room" className={styles.room}>
          <div className={styles.roomIntro}>
            <span className="eyebrow">Sala docente · tiempo real</span>
            <h2>Un mismo mapa, varias miradas.</h2>
            <p>
              Recorred el caso y dejad comentarios, hipótesis y observaciones sin salir del mapa.
            </p>
          </div>

          <CaseRoom token={token} caseId={caseId} minimumParticipants={2} />

          <div className={styles.inviteBlock}>
            <button
              type="button"
              className={styles.inviteToggle}
              onClick={() => setInviteOpen((current) => !current)}
            >
              {inviteOpen ? 'Cerrar invitación' : 'Invitar a otro docente'}
            </button>

            {inviteOpen && (
              <div className={styles.inviteForm}>
                <p className={styles.inviteHint}>
                  La conversación se habilita cuando haya al menos dos docentes conectados al caso.
                </p>
                <div className={styles.inviteRow}>
                  <input
                    className={styles.inviteInput}
                    type="email"
                    value={email}
                    placeholder="correo@colegio.edu"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <select
                    className={styles.inviteSelect}
                    value={role}
                    onChange={(event) => setRole(event.target.value as CollaboratorRole)}
                  >
                    <option value="comentarista">Comentarista</option>
                    <option value="editor">Editor</option>
                    <option value="lector">Lector</option>
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!email.trim() || inviteState === 'sending'}
                    onClick={() => void handleInvite()}
                  >
                    {inviteState === 'sending' ? 'Invitando…' : 'Invitar'}
                  </button>
                </div>
                {inviteState === 'sent' && (
                  <p className={styles.inviteSuccess}>Acceso concedido. Ya puede entrar en esta sala.</p>
                )}
                {inviteState === 'error' && <p className={styles.inviteError}>{inviteError}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
