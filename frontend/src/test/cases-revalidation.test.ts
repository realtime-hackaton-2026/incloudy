/*
 * frontend/src/test/cases-revalidation.test.ts // the case list refetches when
 * the tab comes back, and never on a timer — an idle tab must cost nothing.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCases } from '../cases'

const CASES = [
  {
    _id: 'c1',
    profesor_id: 'u1',
    colaboradores: [],
    colaboradores_ids: [],
    alumno: { nombre: 'Alex', descripcion: '', es_ficticio: true },
    respuestas: [],
    progreso: { completadas: 0, total: 5, porcentaje: 0 },
    estado_interactivo: {},
    resumen_final: { contenido: '' },
    status: 'borrador',
    created_at: '',
    updated_at: '',
  },
]

function stubList() {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(CASES), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCases revalidation', () => {
  it('loads once on mount', async () => {
    const fetchMock = stubList()
    const { result } = renderHook(() => useCases('t'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  /*
   * The regression this file exists for. A 5s interval used to sit here; it
   * kept the API busy for a tab nobody was looking at.
   */
  it('does not poll: sitting idle costs no further requests', async () => {
    const fetchMock = stubList()
    const { result } = renderHook(() => useCases('t'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches when the tab regains focus', async () => {
    const fetchMock = stubList()
    const { result } = renderHook(() => useCases('t'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('refetches when the tab becomes visible again', async () => {
    const fetchMock = stubList()
    const { result } = renderHook(() => useCases('t'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('stays quiet while the tab is hidden', async () => {
    const fetchMock = stubList()
    const { result } = renderHook(() => useCases('t'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      setVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('detaches its listeners on unmount', async () => {
    const fetchMock = stubList()
    const { result, unmount } = renderHook(() => useCases('t'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    unmount()
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
