/**
 * Client for the three auth endpoints the app needs from ../../backend.
 *
 * Kept apart from React so the login and registro screens never talk to the
 * network themselves: they take a submit handler and render whatever they're
 * told. Swapping the backend, or faking it in a demo, means touching this
 * file alone.
 */

import { ApiError, apiFetch, authHeaders } from '../lib/http'

export interface Credentials {
  /** The backend looks users up by email; the form calls it "ID de Explorador". */
  email: string
  password: string
}

export interface Registration extends Credentials {
  nombre: string
  seccion?: string
}

/** Exchange credentials for a bearer token. */
export async function requestToken({ email, password }: Credentials): Promise<string> {
  // /auth/login is an OAuth2 password flow, so it wants a form body with the
  // fields named `username` and `password` — not JSON, and not `email`.
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  })
  return readAccessToken(response)
}

/**
 * Create an account and get a token back in the same call — /auth/register
 * logs the new teacher in immediately, so there's no separate sign-in step.
 */
export async function registerAccount({ nombre, seccion, email, password }: Registration): Promise<string> {
  const response = await apiFetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // The current registration screen intentionally stays compact and does
    // not ask for a display name. Use the email prefix as a sensible default;
    // the backend requires `nombre` when creating the user.
    body: JSON.stringify({ nombre, seccion: seccion || null, email, password }),
  })
  return readAccessToken(response)
}

export interface CurrentUser {
  id: string
  nombre: string
  email: string
  seccion: string | null
}

export interface ProfileUpdate {
  nombre: string
  email: string
  seccion?: string
  currentPassword?: string
  newPassword?: string
}

export async function updateCurrentUser(token: string, input: ProfileUpdate): Promise<CurrentUser> {
  const response = await apiFetch('/auth/me', {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: input.nombre,
      email: input.email,
      seccion: input.seccion || null,
      current_password: input.currentPassword || null,
      new_password: input.newPassword || null,
    }),
  })
  return (await response.json()) as CurrentUser
}

/** Who the token belongs to. Also the cheapest way to know a stored token still works. */
export async function fetchCurrentUser(token: string): Promise<CurrentUser> {
  const response = await apiFetch('/auth/me', { headers: authHeaders(token) })
  return (await response.json()) as CurrentUser
}

async function readAccessToken(response: Response): Promise<string> {
  const payload = (await response.json()) as { access_token?: string }
  if (!payload.access_token) {
    throw new ApiError('El servidor no devolvió un token de sesión.', response.status)
  }
  return payload.access_token
}
