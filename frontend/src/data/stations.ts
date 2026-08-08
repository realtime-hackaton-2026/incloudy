import type { StationConfig, StationId } from "../types/game";

// ============================================================
// Config de estaciones — EDITA esto para que coincida con las
// estaciones reales de tu juego (ids, nombres, iconos, rutas).
// El orden del array es también el orden de progresión del juego.
// ============================================================

export const STATIONS: StationConfig[] = [
  { id: "estacion-1", icon: "🔎", name: "EXPLORAR", subtitle: "Observar y detectar", path: "/mision/explorar" },
  { id: "estacion-2", icon: "📖", name: "ORIENTAR", subtitle: "Comprender y analizar", path: "/mision/orientar" },
  { id: "estacion-3", icon: "📃", name: "ACTUAR", subtitle: "Planificar e intervenir", path: "/mision/actuar" },
  { id: "estacion-4", icon: "🤝", name: "ACOMPAÑAR", subtitle: "Hacer seguimiento", path: "/mision/acompanar" },
  { id: "estacion-5", icon: "🔂", name: "COMPARTIR", subtitle: "Coordinar y comunicar", path: "/mision/compartir" },
];

export function getStation(id: StationId): StationConfig | undefined {
  return STATIONS.find((s) => s.id === id);
}
