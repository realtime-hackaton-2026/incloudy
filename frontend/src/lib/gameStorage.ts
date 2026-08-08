import type { GameProgress } from "../types/game";

// ============================================================
// Capa de persistencia en localStorage.
// - Única fuente de verdad: STORAGE_KEY.
// - `saveProgress` guarda y avisa a cualquier otro componente
//   montado (mismo tab) mediante un CustomEvent, ya que el
//   evento nativo "storage" del navegador SOLO se dispara en
//   otras pestañas, nunca en la que hizo el cambio.
// ============================================================

export const STORAGE_KEY = "incloudy:game-progress:v1";
const SYNC_EVENT = "incloudy:game-progress-updated";

const EMPTY_PROGRESS: GameProgress = {
  playerName: "",
  xp: 0,
  completedStations: [],
  currentStation: null,
  pistas: [],
  notes: [],
  startedAt: null,
  lastUpdatedAt: null,
};

export function getEmptyProgress(): GameProgress {
  return { ...EMPTY_PROGRESS, completedStations: [], pistas: [], notes: [] };
}

/** Lee el progreso guardado, o un progreso vacío si no hay nada (o el JSON está corrupto). */
export function loadProgress(): GameProgress {
  if (typeof window === "undefined") return getEmptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getEmptyProgress();
    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    return { ...getEmptyProgress(), ...parsed };
  } catch {
    return getEmptyProgress();
  }
}

/** Guarda el progreso y notifica a cualquier hook `useGameProgress` activo en la misma pestaña. */
export function saveProgress(progress: GameProgress): void {
  if (typeof window === "undefined") return;
  const next: GameProgress = { ...progress, lastUpdatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage no disponible (modo privado, cuota excedida...) — se ignora.
  }
  window.dispatchEvent(new CustomEvent<GameProgress>(SYNC_EVENT, { detail: next }));
}

/**
 * Se suscribe a cambios de progreso, tanto los que ocurren en esta pestaña
 * (CustomEvent) como en otras pestañas del mismo navegador (evento "storage").
 * Devuelve una función para des-suscribirse.
 */
export function subscribeToProgress(callback: (progress: GameProgress) => void): () => void {
  function handleCustomEvent(event: Event) {
    const detail = (event as CustomEvent<GameProgress>).detail;
    if (detail) callback(detail);
  }

  function handleStorageEvent(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    callback(loadProgress());
  }

  window.addEventListener(SYNC_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(SYNC_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}

export function clearProgress(): void {
  saveProgress(getEmptyProgress());
}
