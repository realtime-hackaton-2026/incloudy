/**
 * The five stations painted on `fondo.png`, tied to the case stages.
 *
 * Coordinates are percentages of the artwork, measured to the signpost in the
 * illustration. They live here alone so nudging a marker never means touching
 * component logic — open the map, adjust two numbers, done.
 *
 * The wording matches the signs in the art on purpose. If the illustration is
 * redrawn, these labels move with it.
 */

import panorama from '../../assets/images/mapa-completo.webp'

/**
 * The five sequential stages a case moves through. One path, not a map to roam.
 *
 * Defined here so the map is self-contained: it depends on artwork and these
 * five names, nothing else.
 */
export type CaseStage =
  | 'explorar'
  | 'orientar'
  | 'actuar'
  | 'acompanar'
  | 'compartir'

export interface Station {
  stage: CaseStage
  /** Verb on the signpost. */
  label: string
  /** Place on the signpost, e.g. "en la selva". */
  place: string
  /** Signpost position, as a percentage of the artwork's width and height. */
  x: number
  y: number
  /** Close-up illustration of the same place. */
  scene: string
  /** Recorte del panorama que identifica visualmente esta estación. */
  scenePosition: string
}

/** Proporción del panorama WebP, usada para reservar el espacio antes de cargarlo. */
export const MAP_ASPECT_RATIO = '1365 / 768'

export const STATIONS: readonly Station[] = [
  {
    stage: 'explorar',
    label: 'Explorar',
    place: 'en la selva',
    x: 22,
    y: 34,
    scene: panorama,
    scenePosition: 'left center',
  },
  {
    stage: 'orientar',
    label: 'Orientar',
    place: 'en la montaña',
    x: 50,
    y: 24,
    scene: panorama,
    scenePosition: '50% 18%',
  },
  {
    stage: 'actuar',
    label: 'Actuar',
    place: 'en la escuela',
    x: 81,
    y: 31,
    scene: panorama,
    scenePosition: 'right top',
  },
  {
    stage: 'acompanar',
    label: 'Acompañar',
    place: 'en el bosque',
    x: 20,
    y: 67,
    scene: panorama,
    scenePosition: 'left bottom',
  },
  {
    stage: 'compartir',
    label: 'Compartir',
    place: 'en la aldea',
    x: 75,
    y: 68,
    scene: panorama,
    scenePosition: 'right bottom',
  },
]

export function stationFor(stage: CaseStage): Station {
  const found = STATIONS.find((station) => station.stage === stage)
  if (!found) throw new Error(`No hay estación en el mapa para la etapa "${stage}".`)
  return found
}

export function stationIndex(stage: CaseStage): number {
  return STATIONS.findIndex((station) => station.stage === stage)
}

/**
 * Reads the backend's `estado_interactivo.estacion_actual`. It carries the
 * same five ids as `CaseStage`, plus `"completado"` once every station is
 * answered — which has nowhere to stand on a five-station map, so a
 * completed case rests at the last one instead of the map throwing.
 */
export function toCaseStage(estacionActual: string): CaseStage {
  const match = STATIONS.find((station) => station.stage === estacionActual)
  return match ? match.stage : STATIONS[STATIONS.length - 1].stage
}
