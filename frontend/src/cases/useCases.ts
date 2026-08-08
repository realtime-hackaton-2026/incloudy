/*
 * frontend/src/cases/useCases.ts // the signed-in teacher's case list, own and
 * shared. Revalidates when the tab comes back rather than on a timer, so an
 * idle or hidden tab costs the API nothing.
 *
 * Portal is per-case (`case-{id}`, a token minted for one channel), so it can
 * never announce a case you have not opened yet — which is exactly how a
 * shared case or a join code arrives. That is why this list still refetches
 * instead of subscribing: the two solve different problems.
 */

import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../lib/http'
import { createCase, deleteCase, leaveCase, listCases } from './api'
import type { Case, CaseDraft } from './api'

export type CasesStatus = 'loading' | 'ready' | 'error'

export interface CasesState {
  cases: Case[]
  status: CasesStatus
  error: string | null
  refresh: () => Promise<void>
  create: (draft: CaseDraft) => Promise<Case>
  remove: (caseId: string) => Promise<void>
  leave: (caseId: string) => Promise<void>
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

    /*
     * Revalidate on the way back in, not every five seconds.
     *
     * A blind timer kept hitting /cases while the tab was hidden or the
     * teacher was on another screen. The list only has to be right when
     * someone is looking at it, and there are exactly three ways to arrive
     * at that: the tab regains focus, it becomes visible again, or this hook
     * mounts — and it remounts on every trip to the list, since App unmounts
     * CaseList when the route changes.
     */
    const revalidate = () => {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)

    return () => {
      active = false
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
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

  const leave = useCallback(
    async (caseId: string) => {
      await leaveCase(token, caseId)
      setCases((current) => current.filter((item) => item.id !== caseId))
    },
    [token],
  )

  return { cases, status, error, refresh, create, remove, leave }
}
