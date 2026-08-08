/**
 * Shared fetch wrapper for every API client in this app.
 *
 * Centralised because `auth/api.ts` and `cases/api.ts` both need the same
 * three things: resolve the base URL once, tell "server unreachable" apart
 * from "server answered with an error", and pull FastAPI's `detail` into a
 * message that's already safe to show a teacher.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** An API failure whose message is already in Spanish and safe to show. */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the backend. */
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    // fetch only rejects when the request never completed: server down, DNS,
    // CORS. Nothing to read off the response, so say so plainly.
    throw new ApiError('No se pudo contactar al servidor. ¿Está encendido?', 0)
  }

  if (!response.ok) throw new ApiError(await readDetail(response), response.status)
  return response
}

export function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export function jsonHeaders(token: string): HeadersInit {
  return { ...authHeaders(token), 'Content-Type': 'application/json' }
}

/**
 * FastAPI puts the message in `detail` — a string for our own errors, a list of
 * objects when validation fails. Anything else falls back to the status.
 */
async function readDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as { msg?: unknown } | undefined
      if (first && typeof first.msg === 'string') return first.msg
    }
  } catch {
    // Not JSON. Fall through to the generic message.
  }
  return `El servidor respondió ${response.status}.`
}
