/**
 * A single case, editable with autosave.
 *
 * Edits update local state immediately and are pushed to the backend after a
 * short pause in typing, so the form never needs a save button — the header
 * just says "saving…" / "guardado".
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/http'
import {
  addCollaborator,
  deleteCase,
  getCase,
  removeCollaborator,
  updateCase,
} from './api'
import type { Case, CaseDraft, CollaboratorRecord, StationRecord, Student } from './api'

const AUTOSAVE_DELAY_MS = 800

export type CaseLoadStatus = 'loading' | 'ready' | 'error'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface CaseState {
  item: Case | null
  loadStatus: CaseLoadStatus
  loadError: string | null
  saveStatus: SaveStatus
  saveError: string | null
  setAlumno: (alumno: Student) => void
  setEstaciones: (estaciones: StationRecord[]) => void
  publish: () => Promise<void>
  remove: () => Promise<void>
  inviteCollaborator: (email: string) => Promise<CollaboratorRecord>
  dropCollaborator: (collaboratorId: string) => Promise<void>
}

export function useCase(token: string, caseId: string): CaseState {
  const [item, setItem] = useState<Case | null>(null)
  const [loadStatus, setLoadStatus] = useState<CaseLoadStatus>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // No synchronous setLoadStatus('loading') here — `loadStatus` already
    // starts at 'loading', and the caller remounts this hook per case (see
    // `key={caseId}` on <CaseForm> in App.tsx) instead of reusing it across
    // cases, so there's no later point where it would need resetting.
    let active = true
    getCase(token, caseId)
      .then((loaded) => {
        if (!active) return
        setItem(loaded)
        setLoadStatus('ready')
      })
      .catch((cause) => {
        if (!active) return
        setLoadError(cause instanceof ApiError ? cause.message : 'No se pudo cargar el caso.')
        setLoadStatus('error')
      })
    return () => {
      active = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [token, caseId])

  const scheduleSave = useCallback(
    (draft: CaseDraft) => {
      if (timer.current) clearTimeout(timer.current)
      setSaveStatus('saving')
      timer.current = setTimeout(() => {
        updateCase(token, caseId, draft)
          .then((saved) => {
            setItem(saved)
            setSaveStatus('saved')
            setSaveError(null)
          })
          .catch((cause) => {
            setSaveStatus('error')
            setSaveError(cause instanceof ApiError ? cause.message : 'No se pudo guardar.')
          })
      }, AUTOSAVE_DELAY_MS)
    },
    [token, caseId],
  )

  const setAlumno = useCallback(
    (alumno: Student) => {
      setItem((current) => {
        if (!current) return current
        return { ...current, alumno }
      })
      scheduleSave({ alumno, estaciones: item?.estaciones ?? [] })
    },
    [item, scheduleSave],
  )

  const setEstaciones = useCallback(
    (estaciones: StationRecord[]) => {
      setItem((current) => {
        if (!current) return current
        return { ...current, estaciones }
      })
      scheduleSave({ alumno: item?.alumno ?? { nombre: '', descripcion: '' }, estaciones })
    },
    [item, scheduleSave],
  )

  const publish = useCallback(async () => {
    const saved = await updateCase(token, caseId, { status: 'publicado' })
    setItem(saved)
  }, [token, caseId])

  const remove = useCallback(async () => {
    await deleteCase(token, caseId)
  }, [token, caseId])

  const inviteCollaborator = useCallback(
    async (email: string) => {
      const collaborator = await addCollaborator(token, caseId, email)
      setItem((current) =>
        current
          ? { ...current, colaboradoresIds: [...current.colaboradoresIds, collaborator.user_id] }
          : current,
      )
      return collaborator
    },
    [token, caseId],
  )

  const dropCollaborator = useCallback(
    async (collaboratorId: string) => {
      await removeCollaborator(token, caseId, collaboratorId)
      setItem((current) =>
        current
          ? {
              ...current,
              colaboradoresIds: current.colaboradoresIds.filter((id) => id !== collaboratorId),
            }
          : current,
      )
    },
    [token, caseId],
  )

  return {
    item,
    loadStatus,
    loadError,
    saveStatus,
    saveError,
    setAlumno,
    setEstaciones,
    publish,
    remove,
    inviteCollaborator,
    dropCollaborator,
  }
}
