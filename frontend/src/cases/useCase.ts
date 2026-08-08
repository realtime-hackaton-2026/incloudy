/*
 * frontend/src/cases/useCase.ts // one case, editable with autosave on the
 * student record; every other change (a station answer, completing,
 * publishing, the summary) is a discrete, awaited action instead, since each
 * has its own server-side validation and shouldn't be debounced.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/http'
import {
  addCollaborator,
  answerStation as answerStationRequest,
  answerUnexpectedEvent as answerUnexpectedEventRequest,
  completeCase as completeCaseRequest,
  deleteCase,
  generateSummary as generateSummaryRequest,
  getCase,
  publishCase as publishCaseRequest,
  removeCollaborator,
  resetCase as resetCaseRequest,
  setBurixShare as setBurixShareRequest,
  updateStudent,
  updateSummary as updateSummaryRequest,
} from './api'
import type { Case, CollaboratorRecord, CollaboratorRole, Student } from './api'

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
  answerStation: (
    orden: number,
    input: { opcionesSeleccionadas: string[]; comentario?: string },
  ) => Promise<void>
  answerUnexpectedEvent: (eventId: string, opcionId: string) => Promise<void>
  completeCase: () => Promise<void>
  publishCase: () => Promise<void>
  resetCase: () => Promise<void>
  setBurixShared: (shared: boolean) => Promise<void>
  generateSummary: (overwriteManual?: boolean) => Promise<void>
  updateSummary: (contenido: string) => Promise<void>
  remove: () => Promise<void>
  inviteCollaborator: (email: string, role?: CollaboratorRole) => Promise<CollaboratorRecord>
  dropCollaborator: (collaboratorId: string) => Promise<void>
}

export function useCase(token: string, caseId: string): CaseState {
  const [item, setItem] = useState<Case | null>(null)
  const [loadStatus, setLoadStatus] = useState<CaseLoadStatus>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editVersion = useRef(0)

  useEffect(() => {
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

  const setAlumno = useCallback(
    (alumno: Student) => {
      editVersion.current += 1
      const version = editVersion.current
      setItem((current) => (current ? { ...current, alumno } : current))
      if (timer.current) clearTimeout(timer.current)
      setSaveStatus('saving')
      timer.current = setTimeout(() => {
        updateStudent(token, caseId, alumno)
          .then((saved) => {
            if (editVersion.current === version) {
              setItem(saved)
              setSaveStatus('saved')
              setSaveError(null)
              return
            }
            // Se siguió escribiendo mientras esta petición viajaba: conserva
            // el texto nuevo y deja que el temporizador más reciente lo guarde.
            setItem((current) => current ? { ...saved, alumno: current.alumno } : saved)
          })
          .catch((cause) => {
            if (editVersion.current !== version) return
            setSaveStatus('error')
            setSaveError(cause instanceof ApiError ? cause.message : 'No se pudo guardar.')
          })
      }, AUTOSAVE_DELAY_MS)
    },
    [token, caseId],
  )

  const answerStation = useCallback(
    async (orden: number, input: { opcionesSeleccionadas: string[]; comentario?: string }) => {
      const saved = await answerStationRequest(token, caseId, orden, input)
      setItem(saved)
    },
    [token, caseId],
  )

  const answerUnexpectedEvent = useCallback(
    async (eventId: string, opcionId: string) => {
      const saved = await answerUnexpectedEventRequest(token, caseId, eventId, opcionId)
      setItem(saved)
    },
    [token, caseId],
  )

  const completeCase = useCallback(async () => {
    const saved = await completeCaseRequest(token, caseId)
    setItem(saved)
  }, [token, caseId])

  const publishCase = useCallback(async () => {
    const saved = await publishCaseRequest(token, caseId)
    setItem(saved)
  }, [token, caseId])

  const resetCase = useCallback(async () => {
    const saved = await resetCaseRequest(token, caseId)
    setItem(saved)
  }, [token, caseId])

  const setBurixShared = useCallback(
    async (shared: boolean) => {
      const saved = await setBurixShareRequest(token, caseId, shared)
      setItem(saved)
    },
    [token, caseId],
  )

  const generateSummary = useCallback(
    async (overwriteManual = false) => {
      const saved = await generateSummaryRequest(token, caseId, overwriteManual)
      setItem(saved)
    },
    [token, caseId],
  )

  const updateSummary = useCallback(
    async (contenido: string) => {
      const saved = await updateSummaryRequest(token, caseId, contenido)
      setItem(saved)
    },
    [token, caseId],
  )

  const remove = useCallback(async () => {
    await deleteCase(token, caseId)
  }, [token, caseId])

  const inviteCollaborator = useCallback(
    async (email: string, role: CollaboratorRole = 'comentarista') => {
      const collaborator = await addCollaborator(token, caseId, email, role)
      setItem((current) =>
        current
          ? {
              ...current,
              colaboradores: [
                ...current.colaboradores,
                { userId: collaborator.userId, role: collaborator.role },
              ],
              colaboradoresIds: [...current.colaboradoresIds, collaborator.userId],
            }
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
              colaboradores: current.colaboradores.filter(
                (item) => item.userId !== collaboratorId,
              ),
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
    answerStation,
    answerUnexpectedEvent,
    completeCase,
    publishCase,
    resetCase,
    setBurixShared,
    generateSummary,
    updateSummary,
    remove,
    inviteCollaborator,
    dropCollaborator,
  }
}
