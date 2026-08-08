import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BruixGuide from "../components/BruixGuide";
import RoomParticipants from "../components/realtime/RoomParticipants";
import { useRealtimeRoom } from "../components/realtime/RealtimeProvider";
import { hasPortalConfig } from "../lib/portal";
import { isRealtimeConnected } from "../components/realtime/connectionStatus";

function makeRoomId() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

export default function RoomLobby() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {
    players,
    status,
    roomId,
    roomFull,
    isRoomParticipant,
    sessionStarted,
    startSession,
  } = useRealtimeRoom();
  const roomCode = useMemo(() => params.get("room") || makeRoomId(), [params]);

  useEffect(() => {
    if (!params.get("room")) navigate(`/sala?room=${roomCode}`, { replace: true });
  }, [params, navigate, roomCode]);

  function backToMap() {
    navigate(`/mapa${roomCode ? `?room=${encodeURIComponent(roomCode)}` : ""}`);
  }

  async function beginExperience() {
    const started = await startSession();
    if (started) navigate(`/mapa?room=${encodeURIComponent(roomCode)}&work=1`, { replace: true });
  }

  const count = players.length;
  const canStart = count >= 2 && count <= 5 && isRoomParticipant && isRealtimeConnected(status);

  return (
    <div className="app-shell room-lobby">
      <div className="room-lobby-card">
        <div className="room-lobby-kicker">BRÚIX · COLABORACIÓN</div>
        <h1>SALA DE TRABAJO DE BRUIX</h1>
        <p className="room-lobby-code">Comparte esta URL · código <b>{roomCode}</b></p>
        {!hasPortalConfig() && <div className="room-warning">Configura <code>VITE_PORTAL_API_KEY</code> para activar Portal realtime.</div>}

        <RoomParticipants players={players} status={status} roomId={roomCode} sessionStarted={sessionStarted} />

        {roomFull && !isRoomParticipant && (
          <div className="room-warning">La sala está completa (5/5). Cuando alguien salga se abrirá una plaza.</div>
        )}

        <div className="room-briefing">
          <BruixGuide text={
            count < 2
              ? `Estoy preparando el encuentro. Cuando llegue otro docente, podremos trabajar juntos.`
              : `Perfecto. Ya somos ${count}. Cuando pulséis comenzar, os llevaré juntos al mapa y dirigiré la sesión.`
          } />
        </div>

        <div className="room-ready-card">
          <div>
            <strong>{count >= 2 ? "EQUIPO LISTO" : "ESPERANDO AL EQUIPO"}</strong>
            <span>{count >= 2 ? "Dos a cinco docentes pueden comenzar la sesión." : "Necesitamos al menos 2 docentes para empezar."}</span>
          </div>
          <span className={`room-ready-dot ${canStart ? "ready" : "waiting"}`} />
        </div>

        <div className="room-actions room-actions-main">
          <button
            className="pixel-btn room-start"
            type="button"
            disabled={!canStart || !hasPortalConfig()}
            onClick={beginExperience}
          >
            {count >= 2 ? "COMENZAR EXPERIENCIA" : "ESPERANDO DOCENTES…"}
          </button>
          <button className="pixel-btn secondary" type="button" onClick={backToMap}>VOLVER AL MAPA</button>
        </div>

        <p className="room-hint">
          La sala es opcional. Al comenzar, todos volveréis al mapa con la colaboración realtime activa y Bruix os irá guiando.
        </p>
      </div>
    </div>
  );
}
