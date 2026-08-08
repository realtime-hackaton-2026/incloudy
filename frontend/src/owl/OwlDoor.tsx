/*
 * The enlarged guide owl is also the visual door into the case's private
 * Portal room. The room is lazy: no realtime connection is opened until the
 * teacher asks to meet. From the same door the owner can invite a colleague.
 */

import { useState } from 'react'
import { addCollaborator } from '../cases/api'
import type { CollaboratorRole } from '../cases/api'
import { stationFor } from '../components/case-map/stations'
import type { CaseStage } from '../components/case-map/stations'
import { CaseRoom } from '../portal'
import type { ChatMessage } from '../portal'
import type { Message } from '@portalsdk/core'
import { OwlSprite } from './OwlSprite'
import styles from './OwlDoor.module.css'

export interface OwlDoorProps {
  token: string
  caseId: string
  stage: CaseStage
  onMessage?: (message: Message<ChatMessage>) => void
}

export function OwlDoor({ token, caseId, stage, onMessage }: OwlDoorProps) {
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
      setInviteError(cause instanceof Error ? cause.message : 'No se pudo añadir al colaborador.')
    }
  }

  return (
    <div className={styles.wrapper} data-testid="owl-door" data-state={open ? 'open' : 'closed'}>
      <button
        type="button"
        className={styles.door}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="owl-door-room"
      >
        <OwlSprite className={styles.owl} />
        <span className={styles.label}>
          <span className={styles.title}>{open ? 'Cerrar la sala' : 'Reunirse con el equipo'}</span>
          <span className={styles.subtitle}>{station.label} · {station.place}</span>
        </span>
        <span className={styles.chevron} aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div id="owl-door-room" className={styles.room}>
          <CaseRoom token={token} caseId={caseId} onMessage={onMessage} />

          <div className={styles.inviteBlock}>
            <button
              type="button"
              className={styles.inviteToggle}
              onClick={() => setInviteOpen((current) => !current)}
            >
              {inviteOpen ? 'Cerrar invitación' : 'Invitar a otra persona'}
            </button>

            {inviteOpen && (
              <div className={styles.inviteForm}>
                <p className={styles.inviteHint}>Añade a un docente que ya tenga cuenta para que pueda entrar en esta sala privada.</p>
                <div className={styles.inviteRow}>
                  <input
                    className={styles.inviteInput}
                    type="email"
                    value={email}
                    placeholder="correo@colegio.edu"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <select className={styles.inviteSelect} value={role} onChange={(event) => setRole(event.target.value as CollaboratorRole)}>
                    <option value="comentarista">Comentarista</option>
                    <option value="editor">Editor</option>
                    <option value="lector">Lector</option>
                  </select>
                  <button type="button" className="btn-secondary" disabled={!email.trim() || inviteState === 'sending'} onClick={() => void handleInvite()}>
                    {inviteState === 'sending' ? 'Invitando…' : 'Invitar'}
                  </button>
                </div>
                {inviteState === 'sent' && <p className={styles.inviteSuccess}>Acceso concedido. Ya puede entrar en la sala.</p>}
                {inviteState === 'error' && <p className={styles.inviteError}>{inviteError}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
