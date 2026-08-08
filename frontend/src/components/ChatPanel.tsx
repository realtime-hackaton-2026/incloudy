import { useState, type FormEvent } from "react";
import { chatApi, ApiError } from "../lib/api";

type Exchange = { mensaje: string; respuesta: string };

export default function ChatPanel() {
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const mensaje = draft.trim();
    if (!mensaje) return;
    setSending(true);
    setError(null);
    try {
      const { respuesta } = await chatApi.sendChatMessage(mensaje);
      setHistory((h) => [...h, { mensaje, respuesta }]);
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "El asistente no respondió.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat-panel">
      <h2>Asistente (Gemini)</h2>

      <ul className="chat-history">
        {history.map((exchange, i) => (
          <li key={i}>
            <p className="chat-msg-user">{exchange.mensaje}</p>
            <p className="chat-msg-bot">{exchange.respuesta}</p>
          </li>
        ))}
      </ul>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Escribe un mensaje…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={sending}>
          {sending ? "…" : "Enviar"}
        </button>
      </form>
    </section>
  );
}
