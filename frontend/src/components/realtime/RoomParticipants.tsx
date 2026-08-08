import { useMemo } from "react";
import { useGameState } from "../../state/gameState";
import { isRealtimeConnected } from "./connectionStatus";

export default function RoomParticipants({ players = [], status, roomId, sessionStarted = false }) {
  const { state } = useGameState();
  const uniquePlayers = useMemo(() => {
    const byId = new Map();
    for (const player of Array.isArray(players) ? players : []) {
      const id = String(player?.id || "");
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        ...player,
        name: player?.name || `Docente ${byId.size + 1}`,
      });
    }
    return [...byId.values()].slice(0, 5);
  }, [players]);

  const connected = isRealtimeConnected(status);
  const count = uniquePlayers.length;

  return (
    <aside className="room-panel room-panel-live" aria-label="Docentes presentes en la sala">
      <div className="room-panel-head">
        <strong>BRÚJULA · SALA DE TRABAJO</strong>
        <span className={`room-status ${connected ? "room-status-live" : ""}`}>
          {connected ? "EN TIEMPO REAL" : (status || "CONECTANDO…")}
        </span>
      </div>

      <div className="room-code">Sala: <b>{roomId}</b></div>

      <div className="room-presence-title">
        <div>
          <strong>DOCENTES PRESENTES</strong>
          <span>Se actualiza automáticamente</span>
        </div>
        <b className="room-presence-count">{count} / 5</b>
      </div>

      <div className="room-players room-players-live">
        {uniquePlayers.length > 0 ? uniquePlayers.map((player, index) => (
          <div className="room-player room-player-live" key={player.id}>
            <span className="room-player-dot" />
            <span className="room-player-name">{player.name || `Docente ${index + 1}`}</span>
            <span className="room-player-state">{sessionStarted ? "EN SESIÓN" : "PRESENTE"}</span>
          </div>
        )) : (
          <div className="room-player-empty">
            {connected ? "Esperando presencia de los docentes…" : "Conectando con la sala…"}
          </div>
        )}
      </div>

      <div className="room-presence-footer">
        {sessionStarted
          ? `Sesión activa · ${count} ${count === 1 ? "docente conectado" : "docentes conectados"}`
          : count >= 2
            ? "Equipo preparado para comenzar"
            : "Necesitamos al menos 2 docentes para comenzar"}
      </div>
    </aside>
  );
}
