import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { useGameState } from "../state/gameState";
import { STATIONS } from "../data/stations";
import { HIPOTESIS } from "../data/caso";
import { downloadDataStationPDF } from "../utils/pdfReport";

const STRATEGY_LABELS = {
  "reto-abierto": { icon: "🔭", label: "Reto abierto" },
  andamiaje: { icon: "🧩", label: "Andamiaje con elección" },
  "eleccion-producto": { icon: "🎨", label: "Elección del producto" },
};

const FOLLOWUP_LABELS = {
  mejorado: { icon: "↑", label: "Ha mejorado" },
  mantiene: { icon: "→", label: "Se mantiene" },
  empeorado: { icon: "↓", label: "Ha empeorado" },
};

const ROLE_LABELS = {
  tutor: { icon: "👩‍🏫", label: "Tutor" },
  orientador: { icon: "🧑‍💼", label: "Orientador" },
  familia: { icon: "👨‍👩‍👧", label: "Familia" },
  especialista: { icon: "👨‍🏫", label: "Especialista" },
};

function formatDate(iso) {
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

export default function DataStationScreen() {
  const { state, zoneOrder, setStudentName } = useGameState();
  const navigate = useNavigate();
  const [nameDraft, setNameDraft] = useState(state.studentName || "");
  const [savedFlash, setSavedFlash] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function handleSaveName() {
    setStudentName(nameDraft.trim());
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  }

  function handleDownloadPDF() {
    setDownloading(true);
    try {
      downloadDataStationPDF(state, zoneOrder);
    } finally {
      window.setTimeout(() => setDownloading(false), 600);
    }
  }

  const completedCount = state.completedMissions.length;
  const totalCount = zoneOrder.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  const intervention = state.interventions.find((i) => i.mission === "actuar");
  const strategy = intervention ? STRATEGY_LABELS[intervention.choice] : null;

  const followup = state.followups.find((f) => f.mission === "acompanar");
  const followupInfo = followup ? FOLLOWUP_LABELS[followup.observation] : null;

  function stationStatus(stationId) {
    if (state.completedMissions.includes(stationId)) return "completada";
    if (state.unlockedZones.includes(stationId)) return "actual";
    return "bloqueada";
  }

  function stationDetail(stationId) {
    switch (stationId) {
      case "explorar":
        return state.pistas.find((p) => p.mission === "explorar")
          ? "Primera evidencia observada sobre Alex."
          : null;
      case "orientar":
        return state.hipotesis
          ? `Hipótesis sostenida: ${state.hipotesis.label}`
          : null;
      case "actuar":
        return strategy ? `Estrategia elegida: ${strategy.icon} ${strategy.label}` : null;
      case "acompanar":
        return followupInfo
          ? `Seguimiento: ${followupInfo.icon} ${followupInfo.label}`
          : null;
      case "compartir":
        return state.sharedWith.length > 0
          ? `Compartido con ${state.sharedWith.length} rol(es).`
          : null;
      default:
        return null;
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="datastation-screen">
        <div className="datastation-header">
          <h1 className="notebook-title">📊 Data Station</h1>
          <div className="datastation-header-actions">
            <button className="pixel-btn gold" onClick={handleDownloadPDF} disabled={downloading}>
              {downloading ? "Generando…" : "⬇ Descargar PDF"}
            </button>
            <button className="pixel-btn secondary" onClick={() => navigate("/mapa")}>
              ← Volver al mapa
            </button>
          </div>
        </div>
        <p className="datastation-subtitle">
          Resumen del recorrido de este alumno/a por el caso de Alex: progreso, hipótesis,
          decisiones e intervenciones registradas hasta ahora. El botón de descarga genera un
          informe en PDF listo para tutoría, orientación o familia.
        </p>

        <div className="pixel-panel datastation-identity enter-anim">
          <label className="datastation-label" htmlFor="student-name">
            Nombre del alumno/a
          </label>
          <div className="datastation-name-row">
            <input
              id="student-name"
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
          {state.startedAt && (
            <p className="datastation-started">Caso iniciado: {formatDate(state.startedAt)}</p>
          )}
        </div>

        <div className="datastation-stats">
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">⭐ {state.xp}</span>
            <span className="datastation-stat-label">XP total</span>
          </div>
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">
              {completedCount}/{totalCount}
            </span>
            <span className="datastation-stat-label">Estaciones completadas</span>
          </div>
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">⏳ {Math.max(0, state.diasRestantes)}</span>
            <span className="datastation-stat-label">Días quedan de la semana</span>
          </div>
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">🤝 {state.confianza}%</span>
            <span className="datastation-stat-label">Confianza del equipo</span>
          </div>
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">🧩 {state.pistas.length}</span>
            <span className="datastation-stat-label">Pistas recogidas</span>
          </div>
          <div className="pixel-panel datastation-stat-card enter-anim">
            <span className="datastation-stat-value">📝 {state.notes.length}</span>
            <span className="datastation-stat-label">Notas del cuaderno</span>
          </div>
        </div>

        <div className="pixel-panel datastation-progress enter-anim">
          <div className="datastation-progress-track">
            <div className="datastation-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="datastation-progress-label">{progressPct}% del caso completado</span>
        </div>

        {state.hipotesis && (
          <div className="pixel-panel datastation-hipotesis enter-anim">
            <h2 className="datastation-section-title">🧭 Hipótesis de trabajo</h2>
            <p>
              <strong>{state.hipotesis.label}</strong>
              {" — "}
              {HIPOTESIS[state.hipotesis.id]?.resumen}
            </p>
            <p className="datastation-hipotesis-estado">
              Estado:{" "}
              {state.hipotesisConfirmada === true && "✅ Confirmada por los datos y el equipo."}
              {state.hipotesisConfirmada === false && "⚠️ Sostenida, aunque con lecturas distintas."}
              {state.hipotesisConfirmada === null && "⏳ Todavía sin verificar."}
            </p>
          </div>
        )}

        <div className="pixel-panel datastation-timeline enter-anim">
          <h2 className="datastation-section-title">🗺️ Recorrido por estación</h2>
          <ol className="datastation-timeline-list">
            {STATIONS.map((station) => {
              const status = stationStatus(station.id);
              const detail = stationDetail(station.id);
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
                      {status === "bloqueada" && "Bloqueada — orden aún no alcanzado"}
                    </span>
                    {detail && <span className="datastation-timeline-detail">{detail}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="pixel-panel datastation-collaboration enter-anim">
          <h2 className="datastation-section-title">💬 Interacciones en la sala de trabajo</h2>
          <p className="datastation-subtitle">Registro de las aportaciones realizadas por docentes y otros perfiles durante la sesión colaborativa con Bruix.</p>
          {state.roomInteractions?.length ? (
            <div className="datastation-interactions">
              {state.roomInteractions.map((interaction) => (
                <article className="datastation-interaction" key={interaction.id}>
                  <div className="datastation-interaction-meta">
                    <strong>{interaction.authorName || "Participante"}</strong>
                    <span>{interaction.role || (interaction.authorType === "bruix" ? "bruix" : "docente")}</span>
                    <span>{interaction.zone || "sala"}</span>
                    <time>{formatDate(interaction.createdAt)}</time>
                  </div>
                  <p>{interaction.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="room-player-empty">Todavía no hay interacciones registradas en la sala.</div>
          )}
        </div>

        {state.sharedWith.length > 0 && (
          <div className="pixel-panel datastation-share enter-anim">
            <h2 className="datastation-section-title">🤝 Compartido con</h2>
            <div className="datastation-share-chips">
              {state.sharedWith.map((role) => {
                const info = ROLE_LABELS[role];
                return (
                  <span className="datastation-chip" key={role}>
                    {info ? `${info.icon} ${info.label}` : role}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
