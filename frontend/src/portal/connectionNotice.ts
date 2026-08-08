/*
 * frontend/src/portal/connectionNotice.ts // what each Portal channel status
 * means to a teacher, as pure data.
 *
 * Split out from the component so the copy can be unit-tested and reused
 * without importing React — the same reason `guide/says.ts` is separate.
 */

/** Mirrors `ChannelStatus` from @portalsdk/core, open to future states. */
export type PortalConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'reconnecting'
  | 'degraded'
  | 'degraded-http'
  | 'blocked'
  | (string & {})

export interface ConnectionNotice {
  text: string
  /** Terminal problems assert; transient ones stay polite. */
  urgent: boolean
}

/**
 * `idle`, `connecting` and `ready` deliberately say nothing: a healthy or
 * still-opening channel is not news, and announcing it would train people to
 * ignore the one region that matters. An unrecognised status is also silent
 * rather than guessed at — the SDK's union is documented as open.
 */
export function connectionNotice(status: PortalConnectionStatus): ConnectionNotice | null {
  switch (status) {
    case 'reconnecting':
      return {
        text: 'Reconectando con la sala… los mensajes nuevos pueden tardar un momento.',
        urgent: false,
      }
    case 'degraded-http':
      // Publish still works over HTTP; only inbound lags until gap-fill heals.
      return {
        text: 'Conexión inestable: puedes seguir escribiendo, pero lo que envían otros puede tardar.',
        urgent: false,
      }
    case 'degraded':
      return {
        text: 'Algunas funciones en vivo están limitadas. La conversación sigue funcionando.',
        urgent: false,
      }
    case 'blocked':
      return {
        text: 'No se pudo conectar a la sala en vivo. Recarga la página para volver a intentarlo.',
        urgent: true,
      }
    default:
      return null
  }
}
