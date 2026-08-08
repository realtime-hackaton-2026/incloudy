import { useMemo } from "react";
import { STATIONS } from "../data/stations";
//import { useGameProgress } from "../hooks/useGameProgress";
import "./PistasPage.css";

interface PistasPageProps {
  onBack?: () => void;
}

export default function PistasPage({ onBack }: PistasPageProps) {
  const { progress } = useGameProgress();

  const pistasConContraste = useMemo(
    () => progress.pistas.filter((p) => p.contraste),
    [progress.pistas]
  );

  return (
    <div className="app-shell">
      <header className="page-topbar">
        <span className="page-topbar-title">🧩 Pistas recogidas</span>
        {onBack && (
          <button className="pixel-btn secondary" onClick={onBack}>
            ← Volver al mapa
          </button>
        )}
      </header>

      <main className="pistas-screen">
        <div className="pistas-header">
          <p className="pistas-count">
            {progress.pistas.length} pista{progress.pistas.length !== 1 ? "s" : ""} guardada
            {progress.pistas.length !== 1 ? "s" : ""} en este dispositivo.
          </p>
        </div>

        {pistasConContraste.length > 0 && (
          <p className="pistas-tension-hint">
            ⚠ {pistasConContraste.length} pista(s) tienen una lectura alternativa — revísalas con
            atención.
          </p>
        )}

        {progress.pistas.length === 0 ? (
          <p className="pistas-empty">
            Todavía no has recogido ninguna pista. Avanza por las estaciones del juego para
            reunir evidencias.
          </p>
        ) : (
          <div className="pistas-grid">
            {progress.pistas.map((pista) => {
              const station = STATIONS.find((s) => s.id === pista.stationId);
              return (
                <div className="pixel-panel pistas-card enter-anim" key={pista.id}>
                  <div className="pistas-card-header">
                    <span className="pistas-card-icon">{pista.icon ?? "🧩"}</span>
                    <span className="pistas-card-station">
                      {station ? `${station.icon} ${station.name}` : "General"}
                    </span>
                  </div>
                  {pista.typeLabel && <div className="pistas-card-type">{pista.typeLabel}</div>}
                  <p className="pistas-card-text">{pista.text}</p>
                  {pista.contraste && (
                    <p className="pistas-card-contraste">🔶 Otra lectura posible: {pista.contraste}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
