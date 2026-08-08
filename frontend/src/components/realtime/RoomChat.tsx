import { useEffect, useMemo, useState } from "react";
import BruixSprite from "../BruixSprite";
import { useRealtimeRoom } from "./RealtimeProvider";
import { isRealtimeConnected } from "./connectionStatus";
import { useGameState } from "../../state/gameState";

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function RoomChat() {
  const {
    chatMessages,
    sendChat,
    players,
    status,
    roomFull,
    isRoomParticipant,
    sessionStarted,
  } = useRealtimeRoom();
  const { state } = useGameState();
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState(() => window.sessionStorage.getItem("brujula:author-role:v1") || "docente");
  const [open, setOpen] = useState(true);

  const visibleMessages = useMemo(
    () => (Array.isArray(chatMessages) ? chatMessages : []).slice(-40),
    [chatMessages]
  );

  const playerResponses = useMemo(
    () => new Set(visibleMessages.filter((m) => m.authorType === "player").map((m) => m.senderId)).size,
    [visibleMessages]
  );

  const phase = !sessionStarted
    ? "PREPARADOS"
    : state.completedMissions.length === 0
      ? "RONDA 1 · MIRAR"
      : `RONDA ${Math.min(state.completedMissions.length + 1, 5)} · CONTRASTAR`;

  function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !isRealtimeConnected(status) || !sessionStarted) return;
    window.sessionStorage.setItem("brujula:author-role:v1", role);
    void sendChat(text, { role });
    setDraft("");
  }

  useEffect(() => {
    if (!open) return;
    const el = document.querySelector(".room-chat-messages");
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleMessages.length, open]);

  return (
    <section className={`room-chat ${open ? "room-chat-open" : "room-chat-closed"}`} aria-label="Guía colaborativa de Bruix">
      <button className="room-chat-header" type="button" onClick={() => setOpen((value) => !value)}>
        <span className="room-chat-brand"><BruixSprite className="room-chat-buho" /> <b>BRUIX · GUÍA DE LA SALA</b></span>
        <span>{players.length}/5 · {open ? "−" : "+"}</span>
      </button>

      {open && (
        <>
          <div className="room-guide-phase">
            <span>{phase}</span>
            <span>{sessionStarted ? `${playerResponses}/${Math.min(2, Math.max(2, players.length))} voces` : "esperando al equipo"}</span>
          </div>
          <div className="room-chat-intro">
            <strong>{sessionStarted ? "Bruix facilita; el equipo decide." : "Bruix prepara el encuentro."}</strong>
            <span>
              {sessionStarted
                ? "Una persona observa, otra contrasta y el grupo acuerda. Yo os haré preguntas y marcaré el siguiente paso."
                : "Cuando haya 2–5 docentes, comenzad. La conversación será el motor del trabajo."
              }
            </span>
          </div>
          <div className="room-chat-messages" aria-live="polite">
            {visibleMessages.length === 0 && (
              <div className="room-chat-empty">Bruix está observando la brújula…</div>
            )}
            {visibleMessages.map((message) => (
              <div className={`room-chat-message room-chat-message-${message.authorType || "player"}`} key={message.id}>
                <div className="room-chat-message-meta">
                  <b>{message.authorType === "bruix" ? "Bruix" : message.authorName || "Docente"}</b>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                <div>{message.text}</div>
              </div>
            ))}
          </div>
          {roomFull && (
            <div className="room-chat-full">La sala ha alcanzado el límite de 5 docentes. Esperad a que se libere una plaza.</div>
          )}
          <div className="room-chat-role-row">
            <label htmlFor="room-chat-role">Rol</label>
            <select id="room-chat-role" value={role} onChange={(event) => setRole(event.target.value)} disabled={!sessionStarted}>
              <option value="docente">Docente</option>
              <option value="especialista">Especialista</option>
              <option value="orientador">Orientador/a</option>
              <option value="tutor">Tutor/a</option>
              <option value="familia">Familia</option>
            </select>
          </div>
          <form className="room-chat-form" onSubmit={submit}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={320}
              placeholder={
                !sessionStarted
                  ? "Comenzad la experiencia desde la sala…"
                  : !isRealtimeConnected(status)
                    ? "Reconectando…"
                    : "Aporta tu observación al grupo…"
              }
              disabled={!sessionStarted || !isRealtimeConnected(status) || !isRoomParticipant || roomFull}
            />
            <button type="submit" disabled={!draft.trim() || !sessionStarted || !isRealtimeConnected(status) || !isRoomParticipant || roomFull}>ENVIAR</button>
          </form>
        </>
      )}
    </section>
  );
}
