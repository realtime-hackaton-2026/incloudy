export const STATIONS = [
  {
    id: "explorar",
    icon: "🔎​",
    name: "EXPLORAR",
    subtitle: "Observar y detectar",
    path: "/mision/explorar",
    preload: () => import("../screens/MissionExplorar"),
    biome: "bosque",
    // Botón centrado horizontalmente bajo el cartel "Explorar" y pegado a su
    // borde inferior. Bounding box del cartel detectado automáticamente por
    // color sobre map-background.webp: x=[12.3,26.8]% y=[33.8,43.1]%.
    pos: { x: 10, y: 32},
  },
  {
    id: "orientar",
    icon: "📖",
    name: "ORIENTAR",
    subtitle: "Comprender y analizar",
    path: "/mision/orientar",
    preload: () => import("../screens/MissionOrientar"),
    biome: "montana",
    // Botón centrado bajo el cartel "Orientar". Bounding box detectado:
    // x=[42.6,57.4]% y=[31.3,40.4]%.
    pos: { x: 42, y: 17},
  },
  {
    id: "actuar",
    icon: "📃",
    name: "ACTUAR",
    subtitle: "Planificar e intervenir",
    path: "/mision/actuar",
    preload: () => import("../screens/MissionActuar"),
    biome: "centro",
    // Botón centrado bajo el cartel "Actuar" (arriba a la derecha, junto a
    // la casa y los cactus). Bounding box detectado: x=[74.9,89.7]%
    // y=[38.4,47.9]%.
    pos: { x: 77, y: 35 },
  },
  {
    id: "acompanar",
    icon: "👩🏻‍🏫​",
    name: "ACOMPAÑAR",
    subtitle: "Hacer seguimiento",
    path: "/mision/acompanar",
    preload: () => import("../screens/MissionAcompanar"),
    biome: "rio",
    // Botón centrado bajo el cartel "Acompañar". Bounding box detectado:
    // x=[13.3,30.5]% y=[72.9,82.4]%.
    pos: { x: 4, y: 60 },
  },
  {
    id: "compartir",
    icon: "🔂​",
    name: "COMPARTIR",
    subtitle: "Coordinar y comunicar",
    path: "/mision/compartir",
    preload: () => import("../screens/MissionCompartir"),
    biome: "aldea",
    // Botón centrado bajo el cartel "Compartir" (poblado, abajo a la
    // derecha). Bounding box detectado: x=[57.4,74.8]% y=[74.6,84.9]%.
    pos: { x: 59, y: 62 },
  },
];
