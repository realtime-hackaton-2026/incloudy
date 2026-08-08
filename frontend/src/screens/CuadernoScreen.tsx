import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import { useGameState } from "../state/gameState";
import { STATIONS } from "../data/stations";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function CuadernoScreen() {
  const { state, addNote, deleteNote } = useGameState();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "pistas" ? "pistas" : "notas";
  const [tab, setTab] = useState(initialTab);
  const [draft, setDraft] = useState("");
  const [zoneTag, setZoneTag] = useState("general");

  function changeTab(next) {
    setTab(next);
    setSearchParams({ tab: next });
  }

  function handleSaveNote() {
    const text = draft.trim();
    if (!text) return;
    addNote(text, zoneTag);
    setDraft("");
  }

  const pistasConContraste = useMemo(
    () => state.pistas.filter((p) => p.contraste),
    [state.pistas]
  );

  return (
    <div className="app-shell">
      <TopBar />
      <main className="notebook-screen">
        <div className="notebook-header">
          <h1 className="notebook-title">
            {tab === "notas" ? "📝 Cuaderno del docente" : "🧩 Pistas recogidas"}
          </h1>
          <button className="pixel-btn secondary" onClick={() => navigate("/mapa")}>
            ← Volver al mapa
          </button>
        </div>

        <div className="notebook-tabs">
          <button
            className={`notebook-tab ${tab === "notas" ? "active" : ""}`}
            onClick={() => changeTab("notas")}
          >
            📝 Mis notas ({state.notes.length})
          </button>
          <button
            className={`notebook-tab ${tab === "pistas" ? "active" : ""}`}
            onClick={() => changeTab("pistas")}
          >
            🧩 Pistas del caso ({state.pistas.length})
          </button>
        </div>

        {tab === "notas" ? (
          <div className="notebook-notes">
            <div className="pixel-panel note-composer enter-anim">
              <p className="note-composer-hint">
                Este es tu espacio: anota lo que observas, tus dudas o lo que te gustaría
                recordar sobre el caso de Alex. No se corrige ni se comparte con nadie.
              </p>
              <textarea
                className="note-textarea"
                rows={4}
                placeholder="Escribe una nota sobre Alex..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="note-composer-row">
                <select
                  className="note-zone-select"
                  value={zoneTag}
                  onChange={(e) => setZoneTag(e.target.value)}
                >
                  <option value="general">General</option>
                  {STATIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
                <button className="pixel-btn gold" disabled={!draft.trim()} onClick={handleSaveNote}>
                  Guardar nota
                </button>
              </div>
            </div>

            {state.notes.length === 0 ? (
              <p className="notebook-empty">Todavía no has escrito ninguna nota.</p>
            ) : (
              <div className="notes-list">
                {state.notes.map((note) => {
                  const station = STATIONS.find((s) => s.id === note.zone);
                  return (
                    <div className="pixel-panel note-card enter-anim" key={note.id}>
                      <div className="note-card-header">
                        <span className="note-card-zone">
                          {station ? `${station.icon} ${station.name}` : "🗒️ General"}
                        </span>
                        <span className="note-card-date">{formatDate(note.createdAt)}</span>
                        <button
                          className="note-card-delete"
                          aria-label="Eliminar nota"
                          onClick={() => deleteNote(note.id)}
                        >
                          🗑
                        </button>
                      </div>
                      <p className="note-card-text">{note.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {pistasConContraste.length > 0 && (
              <p className="notebook-tension-hint">
                ⚠ {pistasConContraste.length} pista(s) tienen una lectura alternativa que las
                complica — míralas con más atención antes de fijar tu hipótesis en Orientar.
              </p>
            )}
            {state.pistas.length === 0 ? (
              <p className="notebook-empty">
                Todavía no has recogido ninguna pista. Explora el mapa para empezar a reunir
                evidencias sobre la situación de aprendizaje.
              </p>
            ) : (
              <div className="notebook-grid">
                {state.pistas.map((pista) => (
                  <div className="pixel-panel notebook-card enter-anim" key={pista.id}>
                    <div className="notebook-card-icon">{pista.icon}</div>
                    <div className="notebook-card-type">{pista.typeLabel || pista.type}</div>
                    <p className="notebook-card-text">{pista.text}</p>
                    {pista.contraste && (
                      <p className="notebook-card-contraste">🔶 Otra lectura posible: {pista.contraste}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
