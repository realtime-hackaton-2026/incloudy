/* frontend/src/components/room-code/code.ts // the room code's one shape rule. */

/** Codes are six characters, letters and digits, always shown uppercase. */
export function normaliseCode(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()
}
