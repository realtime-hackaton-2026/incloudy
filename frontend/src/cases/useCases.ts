/*
 * frontend/src/cases/useCases.ts // the signed-in teacher's case list, own
 * and shared. Loads on mount and exposes create/remove so the list screen
 * never talks to the API directly, matching auth/useSession.ts.
 */

import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../lib/http'
import { createCase, deleteCase, listCases } from './api'
import type { Case, CaseDraft } from './api'

export type CasesStatus = 'loading' | 'ready' | 'error'

export interface CasesState {
  cases: Case[]
  status: CasesStatus
  error: string | null
  refresh: () => Promise<void>
  create: (draft: CaseDraft) => Promise<Case>
  remove: (caseId: string) => Promise<void>
}

export function useCases(token: string): CasesState {
  const [cases, setCases] = useState<Case[]>([])
  const [status, setStatus] = useState<CasesStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      setCases(await listCases(token))
      setStatus('ready')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los casos.')
      setStatus('error')
    }
  }, [token])

  useEffect(() => {
    // Not `refresh()` directly: that starts with a synchronous setState,
    // which the effect lint flags. `status` already starts at 'loading', so
    // the mount-time fetch only needs to resolve it, not reset it.
    let active = true
    const load = () => {
      void listCases(token)
        .then((list) => {
          if (!active) return
          setCases(list)
          setStatus('ready')
          setError(null)
        })
        .catch((cause) => {
          if (!active) return
          setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los casos.')
          setStatus('error')
        })
    }
    load()
    const refreshTimer = setInterval(load, 5_000)
    return () => {
      active = false
      clearInterval(refreshTimer)
    }
  }, [token])

  const create = useCallback(
    async (draft: CaseDraft) => {
      const created = await createCase(token, draft)
      setCases((current) => [created, ...current])
      return created
    },
    [token],
  )

  const remove = useCallback(
    async (caseId: string) => {
      await deleteCase(token, caseId)
      setCases((current) => current.filter((item) => item.id !== caseId))
    },
    [token],
  )

  return { cases, status, error, refresh, create, remove }
}
