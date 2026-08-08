// ============================================================
// Tipos del progreso de juego (estaciones, pistas, notas...)
// Ajusta los campos a los que ya use tu juego en incloudy; esto
// es la forma mínima que necesitan DataStationPage y PistasPage.
// ============================================================

export type StationId = string;

export type StationStatus = "bloqueada" | "actual" | "completada";

/** Config estática de una estación del juego (no cambia en runtime). */
export interface StationConfig {
  id: StationId;
  icon: string;
  name: string;
  subtitle?: string;
  /** Ruta de la estación dentro del router, si aplica. */
  path?: string;
}

/** Una pista/evidencia recogida en alguna estación. */
export interface Pista {
  id: string;
  stationId: StationId;
  icon?: string;
  type?: string;
  typeLabel?: string;
  text: string;
  /** Lectura alternativa / matiz que complica la pista (opcional). */
  contraste?: string;
  createdAt: string; // ISO date
}

/** Nota libre del jugador, opcionalmente asociada a una estación. */
export interface GameNote {
  id: string;
  stationId: StationId | null;
  text: string;
  createdAt: string; // ISO date
}

/** Estado completo del progreso de partida, persistido en localStorage. */
export interface GameProgress {
  playerName: string;
  xp: number;
  completedStations: StationId[];
  currentStation: StationId | null;
  pistas: Pista[];
  notes: GameNote[];
  startedAt: string | null; // ISO date
  lastUpdatedAt: string | null; // ISO date
}
