export const ROOM_EVENT = "BRUJULA_ROOM_EVENT";

export function makeEvent(type, payload = {}) {
  return { kind: ROOM_EVENT, id: crypto.randomUUID(), type, payload, version: 1, timestamp: new Date().toISOString() };
}
