/**
 * Client for the two auth endpoints the app needs from ../../backend.
 *
 * Kept apart from React so the login screen never talks to the network itself:
 * it takes a submit handler and renders whatever it is told. Swapping the
 * backend, or faking it in a demo, means touching this file alone.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface Credentials {
  /** The backend looks users up by email; the form calls it "ID de Explorador". */
  email: string
  password: string
}

/** An auth failure whose message is already in Spanish and safe to show. */
export class AuthError extends Error {
  /** HTTP status, or 0 when the request never reached the backend. */
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/** Exchange credentials for a bearer token. */
export async function requestToken({ email, password }: Credentials): Promise<string> {
  // /auth/login is an OAuth2 password flow, so it wants a form body with the
  // fields named `username` and `password` — not JSON, and not `email`.
  const response = await send('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  })

  const payload = (await response.json()) as { access_token?: string }
  if (!payload.access_token) {
    throw new AuthError('El servidor no devolvió un token de sesión.', response.status)
  }
  return payload.access_token
}

/** The email behind a token. Also the cheapest way to know a stored token still works. */
export async function fetchCurrentUser(token: string): Promise<string> {
  const response = await send('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return (await response.json()) as string
}

async function send(path: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    // fetch only rejects when the request never completed: server down, DNS,
    // CORS. Nothing to read off the response, so say so plainly.
    throw new AuthError('No se pudo contactar al servidor. ¿Está encendido?', 0)
  }

  if (!response.ok) throw new AuthError(await readDetail(response), response.status)
  return response
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
