/*
 * frontend/src/test/journeys-portal.test.tsx // journey template loading and
 * the Portal room: session status transitions (loading/ready/unavailable/
 * error) and the room itself against a mocked @portalsdk/react, so none of
 * this needs a real network or a real Portal project.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useJourneyTemplate } from '../journeys'
import { CaseRoom, usePortalSession } from '../portal'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * A typed `fetch` stub. Naming the signature here — rather than at each
 * `vi.fn(() => …)` call site — is what gives `.mock.calls[n]` its real
 * `[RequestInfo | URL, RequestInit?]` tuple type instead of `tsc` inferring
 * a zero-argument function from a handler that never reads its arguments.
 */
function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response) {
  const fn = vi.fn(handler)
  vi.stubGlobal('fetch', fn)
  return fn
}

const TEMPLATE_WIRE = {
  _id: 'tmpl-1',
  nombre: 'BRÚJULA',
  version: 1,
  estaciones: [
    {
      id: 'explorar',
      orden: 1,
      titulo: 'Explorar',
      subtitulo: '',
      descripcion: '',
      tipo: 'multiple',
      obligatoria: true,
      opciones: [{ id: 'voz_alumno', texto: 'Escuchar al alumno' }],
    },
  ],
}

describe('useJourneyTemplate', () => {
  it('loads the active template when the case has none pinned', async () => {
    const fetchMock = mockFetch(() => jsonResponse(TEMPLATE_WIRE))
    const { result } = renderHook(() => useJourneyTemplate('tok', null))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.template?.id).toBe('tmpl-1')
    expect(result.current.template?.estaciones[0].opciones[0].texto).toBe('Escuchar al alumno')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/journeys\/templates\/active$/)
  })

  it('loads a pinned template by id instead of the active one', async () => {
    const fetchMock = mockFetch(() => jsonResponse(TEMPLATE_WIRE))
    renderHook(() => useJourneyTemplate('tok', 'tmpl-1'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/journeys\/templates\/tmpl-1$/)
  })

  it('surfaces a load failure as status "error"', async () => {
    mockFetch(() => jsonResponse({ detail: 'No existe' }, 404))
    const { result } = renderHook(() => useJourneyTemplate('tok', null))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('No existe')
  })
})

describe('usePortalSession', () => {
  it('resolves to ready with a normalized session', async () => {
    mockFetch(() =>
      jsonResponse({
        token: 'ptok',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        channel_id: 'case-1',
        publishable_key: 'pk_test',
      }),
    )
    const { result } = renderHook(() => usePortalSession('tok', 'case-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.session).toEqual(
      expect.objectContaining({ channelId: 'case-1', publishableKey: 'pk_test' }),
    )
  })

  it('treats a 503 as "unavailable", not an error', async () => {
    mockFetch(() => jsonResponse({ detail: 'Portal no está configurado' }, 503))
    const { result } = renderHook(() => usePortalSession('tok', 'case-1'))
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.error).toBeNull()
  })

  it('surfaces any other failure as "error" with the backend message', async () => {
    mockFetch(() => jsonResponse({ detail: 'No tienes acceso a la sala' }, 403))
    const { result } = renderHook(() => usePortalSession('tok', 'case-1'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('No tienes acceso a la sala')
  })
})

/* ── CaseRoom against a mocked @portalsdk/react ──────────────────────── */

const { useChannelMock } = vi.hoisted(() => ({ useChannelMock: vi.fn() }))

vi.mock('@portalsdk/react', () => ({
  PortalProvider: ({ children }: { children: React.ReactNode }) => children,
  useChannel: useChannelMock,
}))

vi.mock('@portalsdk/core', () => ({
  Portal: class {
    constructor() {}
  },
}))

describe('CaseRoom', () => {
  it('shows a friendly message instead of an error when Portal is unconfigured', async () => {
    mockFetch(() => jsonResponse({ detail: 'Portal no configurado' }, 503))
    render(<CaseRoom token="tok" caseId="case-1" />)
    await waitFor(() =>
      expect(screen.getByTestId('case-room')).toHaveAttribute('data-state', 'unavailable'),
    )
    expect(screen.getByText(/no está disponible todavía/i)).toBeInTheDocument()
  })

  it('renders live messages and presence once the channel is ready', async () => {
    mockFetch(() =>
      jsonResponse({
        token: 'ptok',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        channel_id: 'case-1',
        publishable_key: 'pk_test',
      }),
    )
    const send = vi.fn(() => Promise.resolve({ id: 'm2', timestamp: Date.now() }))
    const sendTyping = vi.fn()
    useChannelMock.mockReturnValue({
      messages: [
        {
          id: 'm1',
          content: 'Hola equipo',
          sender: { id: 'u-2', anon: false },
        },
      ],
      send,
      presence: { kind: 'aggregate', count: 3, recent: [] },
      status: 'ready',
      me: { id: 'u-1', anon: false, claims: {} },
      typing: [],
      sendTyping,
    })

    const user = userEvent.setup()
    render(<CaseRoom token="tok" caseId="case-1" />)

    // The loading and ready states are different JSX branches — different
    // DOM nodes, not one node whose attribute changes — so each retry
    // re-queries instead of polling a captured (and soon stale) reference.
    await waitFor(() =>
      expect(screen.getByTestId('case-room')).toHaveAttribute('data-state', 'ready'),
    )
    expect(screen.getByText('3 conectados')).toBeInTheDocument()
    expect(screen.getByText('Hola equipo')).toBeInTheDocument()
    expect(screen.getByTestId('case-room-typing')).toHaveTextContent('')

    await user.type(screen.getByPlaceholderText(/comparte una observación/i), 'Ánimo!')
    expect(sendTyping).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /enviar/i }))
    expect(send).toHaveBeenCalledWith({ content: { body: 'Ánimo!' } })
  })

  it('keeps the conversation locked until two teachers are online', async () => {
    mockFetch(() =>
      jsonResponse({
        token: 'ptok',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        channel_id: 'case-1',
        publishable_key: 'pk_test',
      }),
    )
    const send = vi.fn()
    useChannelMock.mockReturnValue({
      messages: [],
      send,
      presence: { kind: 'aggregate', count: 1, recent: [] },
      status: 'ready',
      me: { id: 'u-1', anon: false, claims: {} },
      typing: [],
      sendTyping: vi.fn(),
    })

    render(<CaseRoom token="tok" caseId="case-1" />)

    expect(await screen.findByText(/falta 1 docente/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/esperando al segundo docente/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled()
    expect(send).not.toHaveBeenCalled()
  })

  it('publishes the shared session-start event when requested with two teachers', async () => {
    mockFetch(() =>
      jsonResponse({
        token: 'ptok',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        channel_id: 'case-1',
        publishable_key: 'pk_test',
      }),
    )
    const send = vi.fn(() => Promise.resolve({ id: 'system-1', timestamp: Date.now() }))
    useChannelMock.mockReturnValue({
      messages: [],
      send,
      presence: { kind: 'aggregate', count: 2, recent: [] },
      status: 'ready',
      me: { id: 'u-1', anon: false, claims: {} },
      typing: [],
      sendTyping: vi.fn(),
    })

    render(<CaseRoom token="tok" caseId="case-1" hideUi startSessionNonce={1} />)

    await waitFor(() => expect(send).toHaveBeenCalledWith({
      content: { type: 'session_started', body: 'La experiencia colaborativa ha comenzado.' },
    }))
  })

  it('recognizes the shared session-start event and hides it from chat', async () => {
    mockFetch(() =>
      jsonResponse({
        token: 'ptok',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        channel_id: 'case-1',
        publishable_key: 'pk_test',
      }),
    )
    useChannelMock.mockReturnValue({
      messages: [
        { id: 'system-1', content: { type: 'session_started', body: 'La experiencia colaborativa ha comenzado.' }, sender: { id: 'u-2', anon: false } },
        { id: 'm1', content: { body: 'Vamos con la primera estación.' }, sender: { id: 'u-2', anon: false }, timestamp: Date.now() },
      ],
      send: vi.fn(),
      presence: { kind: 'aggregate', count: 2, recent: [] },
      status: 'ready',
      me: { id: 'u-1', anon: false, claims: {} },
      typing: [],
      sendTyping: vi.fn(),
    })

    render(<CaseRoom token="tok" caseId="case-1" />)

    expect(await screen.findByTestId('case-room')).toHaveAttribute('data-session-active', 'true')
    expect(screen.getByText('Vamos con la primera estación.')).toBeInTheDocument()
    expect(screen.queryByText('La experiencia colaborativa ha comenzado.')).not.toBeInTheDocument()
  })

  it('announces when a teammate is typing', async () => {
    mockFetch(() =>
      jsonResponse({
        token: 'ptok',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        channel_id: 'case-1',
        publishable_key: 'pk_test',
      }),
    )
    useChannelMock.mockReturnValue({
      messages: [],
      send: vi.fn(),
      presence: { kind: 'aggregate', count: 2, recent: [] },
      status: 'ready',
      me: { id: 'u-1', anon: false, claims: {} },
      typing: ['u-2'],
      sendTyping: vi.fn(),
    })

    render(<CaseRoom token="tok" caseId="case-1" />)

    expect(await screen.findByText(/alguien está escribiendo/i)).toBeInTheDocument()
  })
})
