/**
 * Reads the `sub` claim — the user's id — out of an access token, without
 * verifying it. The backend is the only thing that needs to trust the
 * token; the frontend only needs the id to tell "your case" from "shared
 * with you" in the case list, a display concern, not a security boundary
 * (every endpoint re-checks ownership server-side regardless).
 */
export function decodeUserId(token: string): string | null {
  const [, payload] = token.split('.')
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as { sub?: unknown }
    return typeof claims.sub === 'string' ? claims.sub : null
  } catch {
    return null
  }
}
