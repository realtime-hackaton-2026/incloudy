import { API_URL, getToken } from "./client";
import type { CasePublishedEvent } from "./types";

type IncloudyWsEvent = CasePublishedEvent;

type Listener = (event: IncloudyWsEvent) => void;

/**
 * Conecta a GET /ws?token=<JWT> y reintenta con backoff si se cae la
 * conexión. Devuelve una función para cerrar la conexión de forma
 * explícita (llámala en el cleanup de tu useEffect).
 *
 * Uso:
 *   useEffect(() => connectIncloudySocket((event) => {
 *     if (event.event === "case_published") refetchCases();
 *   }), []);
 */
export function connectIncloudySocket(onEvent: Listener): () => void {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function wsUrl(): string | null {
    const token = getToken();
    if (!token) return null;
    const httpUrl = new URL(`${API_URL}/ws`);
    httpUrl.searchParams.set("token", token);
    return httpUrl.toString().replace(/^http/, "ws");
  }

  function connect() {
    const url = wsUrl();
    if (!url) return; // sin sesión iniciada, no hay nada que conectar

    socket = new WebSocket(url);

    socket.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data) as IncloudyWsEvent;
        onEvent(parsed);
      } catch {
        // mensaje no-JSON inesperado; se ignora
      }
    };

    socket.onclose = () => {
      if (closedByCaller) return;
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 15_000);
    };

    socket.onopen = () => {
      retryDelay = 1000;
    };
  }

  connect();

  return () => {
    closedByCaller = true;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}
