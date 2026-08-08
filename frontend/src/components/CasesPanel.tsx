import { useCallback, useEffect, useState, type FormEvent } from "react";
import { casesApi, ApiError, connectIncloudySocket } from "../lib/api";
import type { Case } from "../lib/api";

export default function CasesPanel() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setCases(await casesApi.listCases());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "No se pudieron cargar los casos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    casesApi.listCases().then(
      (data) => {
        if (!ignore) {
          setCases(data);
          setError(null);
        }
      },
      (err) => {
        if (!ignore) {
          setError(err instanceof ApiError ? String(err.detail) : "No se pudieron cargar los casos.");
        }
      }
    ).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  // Cuando cualquier profesor publica un caso, el backend emite
  // "case_published" por WebSocket: refrescamos la lista en vivo.
  useEffect(() => {
    return connectIncloudySocket((event) => {
      if (event.event === "case_published") refresh();
    });
  }, [refresh]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!studentName.trim()) return;
    setCreating(true);
    try {
      await casesApi.createCase({
        alumno: { nombre: studentName.trim(), descripcion: "" },
        estaciones: [],
      });
      setStudentName("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "No se pudo crear el caso.");
    } finally {
      setCreating(false);
    }
  }

  async function handlePublish(c: Case) {
    try {
      await casesApi.updateCase(c._id, { status: "publicado" });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "No se pudo publicar el caso.");
    }
  }

  async function handleDelete(c: Case) {
    try {
      await casesApi.deleteCase(c._id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "No se pudo borrar el caso.");
    }
  }

  return (
    <section className="cases-panel">
      <h2>Casos</h2>

      <form className="case-create-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Nombre del alumno/a"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          required
        />
        <button type="submit" disabled={creating}>
          {creating ? "Creando…" : "Nuevo caso"}
        </button>
      </form>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p>Cargando…</p>
      ) : cases.length === 0 ? (
        <p className="empty-state">Todavía no hay casos. Crea el primero arriba.</p>
      ) : (
        <ul className="case-list">
          {cases.map((c) => (
            <li key={c._id} className="case-item">
              <div>
                <strong>{c.alumno.nombre}</strong>
                <span className={`case-status case-status-${c.status}`}>{c.status}</span>
              </div>
              <div className="case-actions">
                {c.status === "borrador" && (
                  <button type="button" onClick={() => handlePublish(c)}>
                    Publicar
                  </button>
                )}
                <button type="button" className="danger" onClick={() => handleDelete(c)}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
