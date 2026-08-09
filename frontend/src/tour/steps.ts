/*
 * frontend/src/tour/steps.ts // what the tour says on each screen, and what it
 * points at when the target happens to be there.
 */

export type TourScreen = 'cases' | 'case' | 'dashboard' | 'map-demo'

export interface TourStep {
  title: string
  body: string
  /**
   * Optional CSS selector to spotlight. Screens change under two people's
   * hands, so a missing target is expected, not an error: the step still
   * shows, it just stops pointing.
   */
  target?: string
}

export const TOUR_STEPS: Record<TourScreen, readonly TourStep[]> = {
  cases: [
    {
      title: 'Este es el mapa',
      body: 'Cada caso vive en un lugar del mapa. Al pasar por encima de un caso se ilumina su sitio, y al revés.',
    },
    {
      title: 'Empieza por un alumno',
      body: 'Un caso arranca con un nombre y una descripción. No hace falta tenerlo todo claro: el recorrido está para eso.',
      target: '[data-tour="new-case"]',
    },
    {
      title: 'Entra en la sala de un colega',
      body: 'Si otro docente te comparte un código de seis caracteres, entras a su caso desde aquí. Clic derecho pega el código.',
      target: '[data-tour="join-room"]',
    },
  ],
  case: [
    {
      title: 'Cinco estaciones, un camino',
      body: 'Explorar, Orientar, Actuar, Acompañar y Compartir. El mapa marca dónde estás; no hay que ir en orden perfecto.',
      target: '[data-tour="journey"]',
    },
    {
      title: 'Búrix y Tero debaten',
      body: 'Dos guías con posturas opuestas discuten el caso: uno pide evidencia, el otro apoyo ya. Ninguno decide — decide el equipo, y podéis votar.',
      target: '[data-tour="debate"]',
    },
    {
      title: 'La mesa de docentes',
      body: 'El chat es en vivo: quien esté en la sala ve lo que escribes al momento. Búrix también responde preguntas sobre este caso.',
      target: '[data-tour="room"]',
    },
  ],
  dashboard: [
    {
      title: 'La vista de conjunto',
      body: 'Aquí se ve cómo avanzan todos los casos a la vez, sin abrir uno por uno.',
    },
  ],
  'map-demo': [
    {
      title: 'El mapa, a solas',
      body: 'Una vista del mundo sin casos encima, para enseñarlo o para mirarlo con calma.',
    },
  ],
}
