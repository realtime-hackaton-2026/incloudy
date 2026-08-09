/*
 * frontend/src/tour/steps.ts // what the tour says on each screen, and what it
 * points at when the target happens to be there.
 */

export type TourScreen = 'cases' | 'case' | 'dashboard' | 'map-demo' | 'chat'

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
      title: 'Estas son tus aventuras',
      body: 'Cada alumno tiene su propia aventura, y cada una guarda el recorrido que habéis hecho con él. Aquí están todas las tuyas y las que te han compartido.',
    },
    {
      title: 'Empieza por un alumno',
      body: 'Una aventura arranca con un nombre y una descripción. No hace falta tenerlo todo claro: el recorrido está para eso.',
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
      title: 'El alumno',
      body: 'Quién es y qué habéis observado. Es lo único que Búrix y Tero conocen del caso, así que cuanto más concreta sea la descripción, más útil será todo lo demás.',
      target: '[data-tour="student"]',
    },
    {
      title: 'Compartir con Búrix',
      body: 'Mientras el caso sea privado, nadie más lo ve. Al compartirlo aparece en Búrix y el código de seis caracteres abre la sala: cópialo y pásaselo a quien tenga que entrar.',
      target: '[data-tour="share"]',
    },
    {
      title: 'Cinco estaciones, un camino',
      body: 'Explorar, Orientar, Actuar, Acompañar y Compartir. El mapa marca dónde estáis; no hay que ir en orden perfecto.',
      target: '[data-tour="journey"]',
    },
    {
      title: 'Quién puede entrar',
      body: 'Aquí decides quién acompaña el caso y con qué permiso: editar o solo leer. Puedes retirar a alguien en cualquier momento.',
      target: '[data-tour="collaborators"]',
    },
    {
      title: 'Las conversaciones',
      body: 'Todo lo que se habla sobre el caso vive aquí: el debate de los dos guías y la mesa de docentes en vivo.',
      target: '[data-tour="conversations"]',
    },
    {
      title: 'El resumen final',
      body: 'Cuando el recorrido está completo, aquí queda lo acordado. Es editable: la última palabra es vuestra, no de la IA.',
      target: '[data-tour="summary"]',
    },
    {
      title: 'Búrix y Tero debaten',
      body: 'Dos guías con posturas opuestas discuten el caso: uno pide evidencia, el otro apoyo ya. Ninguno decide — decide el equipo, y podéis votar.',
      target: '[data-tour="debate"]',
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
      title: 'Recorridos disponibles',
      body: 'Todos tus casos, en una sola tira. Elige uno y el mapa de abajo pasa a contar su historia.',
      target: '[data-tour="map-cases"]',
    },
    {
      title: 'El caso en estudio',
      body: 'La cabecera resume el caso elegido: quién es, cuándo empezó y cuánto lleva recorrido. Cambia al cambiar de caso arriba.',
      target: '[data-tour="map-case-study"]',
    },
    {
      title: 'Moverse por el mapa',
      body: 'Cada estación del camino es un punto del mundo. Pulsa una para abrir lo que se trabajó allí; las que aún no tocan aparecen apagadas hasta que llegue su turno.',
      target: '[data-tour="map"]',
    },
  ],
  chat: [
    {
      title: 'La sala en vivo',
      body: 'Todo lo que ocurre aquí es tiempo real: quién se conecta, quién escribe y quién responde. El código de seis letras es la invitación para un colega.',
      target: '[data-tour="room-dock"]',
    },
    {
      title: 'El muro del equipo',
      body: 'Las observaciones del caso caen aquí al instante, para todos. Cuando Búrix opina sobre el recorrido, también lo deja en este muro.',
      target: '[data-tour="room-messages"]',
    },
    {
      title: 'Comparte una observación',
      body: 'Escribe lo que estáis descubriendo y pulsa Enviar. O pregúntale a Búrix: la respuesta llega a toda la sala.',
      target: '[data-tour="room-composer"]',
    },
    {
      title: 'Búrix, tu guía de la sala',
      body: 'Búrix sigue la conversación y comenta cada avance del caso. El panel privado te deja preguntarle sin interrumpir al equipo.',
      target: '[data-tour="room-burix"]',
    },
  ],
}
