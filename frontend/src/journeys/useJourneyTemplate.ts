/*
 * frontend/src/journeys/useJourneyTemplate.ts // loads the station template a
 * case points at, falling back to the active template for legacy cases with
 * no template_id yet.
 */

import { useEffect, useState } from 'react'
import { ApiError } from '../lib/http'
import { getActiveTemplate, getTemplate } from './api'
import type { JourneyTemplate } from './api'

export type TemplateLoadStatus = 'loading' | 'ready' | 'error'

export interface JourneyTemplateState {
  template: JourneyTemplate | null
  status: TemplateLoadStatus
  error: string | null
}

export function useJourneyTemplate(
  token: string,
  templateId: string | null,
): JourneyTemplateState {
  const [template, setTemplate] = useState<JourneyTemplate | null>(null)
  const [status, setStatus] = useState<TemplateLoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // No synchronous setStatus('loading') here — `status` already starts
    // there, and this hook is remounted per case (CaseForm keys on caseId)
    // rather than reused across one, so there's no later run that would
    // need resetting it.
    let active = true
    const request = templateId ? getTemplate(token, templateId) : getActiveTemplate(token)
    request
      .then((loaded) => {
        if (!active) return
        setTemplate(loaded)
        setStatus('ready')
      })
      .catch((cause) => {
        if (!active) return
        setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar el recorrido.')
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [token, templateId])

  return { template, status, error }
}
