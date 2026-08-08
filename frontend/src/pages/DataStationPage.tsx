import { useMemo, useState } from "react";
import { STATIONS } from "../data/stations";
//import { useGameProgress } from "../hooks/useGameProgress";
import type { StationId, StationStatus } from "../types/game";
import "./DataStationPage.css";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface DataStationPageProps {
  /** Navega de vuelta al mapa/menú del juego. Opcional: si tu proyecto usa
   * react-router, pásale `() => navigate("/mapa")`. */
  onBack?: () => void;
}

export default function DataStationPage({ onBack }: DataStationPageProps) {
  const { progress, setPlayerName } = useGameProgress();
  const [nameDraft, setNameDraft] = useState(progress.playerName);
  const [savedFlash, setSavedFlash] = useState(false);

  function handleSaveName() {
    setPlayerName(nameDraft.trim());
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  }

  const completedCount = progress.completedStations.length;
  const totalCount = STATIONS.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function stationStatus(stationId: StationId): StationStatus {
    if (progress.completedStations.includes(stationId)) return "completada";
    if (progress.currentStation === stationId) return "actual";
    return "bloqueada";
  }

  const pistasByStation = useMemo(() => {
    const map = new Map<StationId, number>();
    for (const pista of progress.pistas) {
      map.set(pista.stationId, (map.get(pista.stationId) ?? 0) + 1);
    }
    return map;
  }, [progress.pistas]);

  return (
    <div className="app-shell">
      <header className="page-topbar">
        <span className="page-topbar-title">📊 Data Station</span>
        {onBack && (
          <button className="pixel-btn secondary" onClick={onBack}>
            ← Volver al mapa
          </button>
        )}
      </header>

      <main className="datastation-screen">
        <p className="datastation-subtitle">
          Resumen del progreso guardado en este dispositivo: estaciones completadas, XP y pistas
          recogidas. Todo se guarda automáticamente en localStorage.
        </p>

        <div className="pixel-panel datastation-identity enter-anim">
          <label className="datastation-label" htmlFor="player-name">
            Nombre del jugador/a
          </label>
          <div className="datastation-name-row">
            <input
              id="player-name"
              className="datastation-input"
              type="text"
              placeholder="Escribe tu nombre..."
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
            />
            <button className="pixel-btn gold" onClick={handleSaveName}>
              {savedFlash ? "✓ Guardado" : "Guardar"}
            </button>
          </div>
          {progress.startedAt && (
            <p className="datastation-started">Partida iniciada: {formatDate(progress.startedAt)}</p>
          )}
        </div>

        <div className="datastation-stats">
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">⭐ {progress.xp}</span>
            <span className="datastation-stat-label">XP total</span>
          </div>
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">
              {completedCount}/{totalCount}
            </span>
            <span className="datastation-stat-label">Estaciones completadas</span>
          </div>
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">🧩 {progress.pistas.length}</span>
            <span className="datastation-stat-label">Pistas recogidas</span>
          </div>
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">📝 {progress.notes.length}</span>
            <span className="datastation-stat-label">Notas guardadas</span>
          </div>
        </div>

        <div className="pixel-panel datastation-progress enter-anim">
          <div className="datastation-progress-track">
            <div className="datastation-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="datastation-progress-label">{progressPct}% del juego completado</span>
        </div>

        <div className="pixel-panel datastation-timeline enter-anim">
          <h2 className="datastation-section-title">🗺️ Recorrido por estación</h2>
          <ol className="datastation-timeline-list">
            {STATIONS.map((station) => {
              const status = stationStatus(station.id);
              const pistaCount = pistasByStation.get(station.id) ?? 0;
              return (
                <li key={station.id} className={`datastation-timeline-item status-${status}`}>
                  <span className="datastation-timeline-icon">
                    {status === "completada" ? "✅" : status === "actual" ? "🟡" : "🔒"}
                  </span>
                  <div className="datastation-timeline-body">
                    <span className="datastation-timeline-name">
                      {station.icon} {station.name}
                    </span>
                    <span className="datastation-timeline-status">
                      {status === "completada" && "Completada"}
                      {status === "actual" && "En curso / disponible"}
                      {status === "bloqueada" && "Todavía no alcanzada"}
                    </span>
                    {pistaCount > 0 && (
                      <span className="datastation-timeline-detail">
                        {pistaCount} pista{pistaCount > 1 ? "s" : ""} recogida{pistaCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </main>
    </div>
  );
}
