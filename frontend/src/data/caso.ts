// Fuente única de verdad sobre "el caso de Alex": las hipótesis posibles,
// qué estrategia encaja con cada una, y cómo se traduce eso en resultados.
// Todas las misiones leen de aquí para que sus decisiones tengan memoria.

export const HIPOTESIS = {
  reto: {
    id: "reto",
    icon: "🎯",
    label: "Necesita más reto",
    resumen: "El patrón apunta a falta de desafío cognitivo, no a dificultad.",
  },
  vinculo: {
    id: "vinculo",
    icon: "🤝",
    label: "Necesita más vínculo",
    resumen: "El patrón apunta a una necesidad de compañía y pertenencia.",
  },
  autonomia: {
    id: "autonomia",
    icon: "🧭",
    label: "Necesita más autonomía",
    resumen: "El patrón apunta a falta de voz y decisión sobre su propio trabajo.",
  },
};

// Los "votos a favor / en contra" de cada hipótesis en Orientar. `base` se
// usa cuando Explorar no deja una lectura clara (menos de 2 pistas, o
// empate); `reforzada` cuando esta es la hipótesis que las pistas respaldan;
// `debilitada` cuando las pistas respaldan otra. El cambio de tono —más
// seguro o más matizado— es la única señal: no hay ninguna etiqueta ni
// icono que diga explícitamente cuál está mejor respaldada.
export const HIPOTESIS_VOCES = {
  reto: {
    base: {
      favor: "El tutor: \"Es un patrón claro. Termina rápido y se apaga cuando la tarea es repetitiva.\"",
      contra: "La orientadora no está tan segura: \"Eso también pasa cuando un niño busca compañía, no solo reto.\"",
    },
    reforzada: {
      favor: "El tutor: \"Es un patrón muy claro: termina rápido y se apaga en cuanto la tarea se repite. Lo veo en varias asignaturas.\"",
      contra: "La orientadora matiza: \"Podría haber algo de eso, aunque lo que tenemos apunta sobre todo en otra dirección.\"",
    },
    debilitada: {
      favor: "El tutor: \"Es un patrón que se repite, aunque quizá no sea lo más determinante ahora mismo.\"",
      contra: "La orientadora: \"Los datos más recientes señalan más bien otra necesidad distinta del reto.\"",
    },
  },
  vinculo: {
    base: {
      favor: "La orientadora: \"Busca a sus compañeros constantemente. Puede ser más social que cognitivo.\"",
      contra: "El tutor discrepa: \"Sus trabajos abiertos son notablemente mejores. Eso no explica solo vínculo.\"",
    },
    reforzada: {
      favor: "La orientadora: \"Busca a sus compañeros en cada tarea y cada cambio de grupo. El patrón es muy consistente.\"",
      contra: "El tutor matiza: \"Es cierto que sus trabajos abiertos mejoran, aunque podría ser solo por sentirse acompañado.\"",
    },
    debilitada: {
      favor: "La orientadora: \"Busca compañía, sí, aunque puede que aquí no sea el factor principal.\"",
      contra: "El tutor: \"Lo que más destaca en los datos recientes es otra cosa, no tanto el vínculo.\"",
    },
  },
  autonomia: {
    base: {
      favor: "Alex, directamente: \"Me gusta más cuando elijo yo cómo hacerlo.\"",
      contra: "El tutor matiza: \"Puede ser autonomía, o puede ser que el nivel de reto no le exige lo suficiente.\"",
    },
    reforzada: {
      favor: "Alex, directamente: \"Me gusta mucho más cuando elijo yo cómo hacerlo\", y se nota en todo lo que entrega.",
      contra: "El tutor matiza: \"Podría influir el nivel de reto, pero lo más reciente apunta más a la autonomía.\"",
    },
    debilitada: {
      favor: "Alex, directamente: \"Me gusta elegir cómo hacerlo\", aunque no siempre cambia demasiado el resultado.",
      contra: "El tutor: \"Los datos más recientes señalan una necesidad distinta, más clara que la autonomía.\"",
    },
  },
};

// Devuelve las voces (a favor / en contra) que corresponden a una hipótesis,
// según cuál quede respaldada por las pistas de Explorar. Toda la variación
// de tono vive aquí, en un único punto, para que Orientar solo tenga que
// pedir "las voces de esta hipótesis" sin conocer las reglas detrás.
export function getVocesHipotesis(hipotesisId, respaldadaId) {
  const voces = HIPOTESIS_VOCES[hipotesisId];
  if (!voces) return null;
  if (!respaldadaId) return voces.base;
  return respaldadaId === hipotesisId ? voces.reforzada : voces.debilitada;
}

// Qué hipótesis encaja mejor con cada estrategia de intervención (Actuar).
export const STRATEGY_ALIGNMENT = {
  "reto-abierto": "reto",
  "andamiaje": "autonomia",
  "eleccion-producto": "vinculo",
};

export function isCoherente(hipotesisId, strategyId) {
  if (!hipotesisId || !strategyId) return null;
  return STRATEGY_ALIGNMENT[strategyId] === hipotesisId;
}

// Reacción de cada rol en Compartir según haya coherencia o no entre
// la hipótesis sostenida y la estrategia elegida.
export function getVillagerReaction(villagerId, hipotesisId, coherente) {
  const hip = HIPOTESIS[hipotesisId];
  if (!hip) {
    return "Escucha el caso con atención, pero pide más datos antes de opinar.";
  }

  const REACTIONS = {
    tutor: {
      true: `Coincide contigo: en clase también se nota que ${hip.resumen.toLowerCase()}`,
      false: `Duda: en clase no termina de ver que ${hip.resumen.toLowerCase()} Cree que la estrategia elegida no encaja del todo.`,
    },
    orientador: {
      true: "Valida la lectura del caso y sugiere mantener el mismo enfoque el próximo trimestre.",
      false: "Plantea una lectura distinta y recomienda observar un poco más antes de cerrar el caso.",
    },
    familia: {
      true: "Confirma que en casa también se ve esa misma necesidad, y agradece que se haya tenido en cuenta.",
      false: "En casa ven algo distinto a lo que describe el caso, y no se sienten del todo representados.",
    },
    especialista: {
      true: "Refrenda el diagnóstico con criterios técnicos y no ve necesidad de intervención adicional.",
      false: "Recomienda una segunda observación: los datos disponibles no son concluyentes todavía.",
    },
  };

  const byRole = REACTIONS[villagerId];
  if (!byRole) return "Escucha el caso y asiente, sin más comentarios.";
  return byRole[String(coherente)];
}

// Cuánto cambia la confianza del equipo (0-100) según lo coherente que sea
// la estrategia elegida en Actuar con la hipótesis sostenida en Orientar.
export const CONFIANZA_DELTA_ACTUAR = { true: 15, false: -15 };

// En Acompañar, lo que declaras como observación puede coincidir o no con
// lo que realmente cabía esperar dado el grado de coherencia. Reportar con
// honestidad un resultado flojo cuesta menos confianza que "maquillar" un
// resultado que, en el fondo, no se sostiene.
export function getConfianzaDeltaAcompanar(coherente, observacionId) {
  if (coherente === true) {
    if (observacionId === "mejorado") return 10; // esperable y así lo dices
    if (observacionId === "mantiene") return -5; // raro que no mejore si era coherente
    return -10; // "empeorado" siendo coherente: algo no cuadra, resta mucho
  }
  if (coherente === false) {
    if (observacionId === "mejorado") return -10; // maquillas un resultado que no se sostiene
    if (observacionId === "mantiene") return 0; // lectura razonable, ni suma ni resta
    return 5; // reconocer honestamente que ha empeorado suma algo de crédito
  }
  return 0;
}

// Umbrales de confianza que determinan cómo se cierra el caso en Compartir.
export function getConfianzaTier(confianza) {
  if (confianza >= 70) {
    return { id: "pleno", label: "Acuerdo pleno", tone: "gold" };
  }
  if (confianza >= 40) {
    return { id: "reservas", label: "Acuerdo con reservas", tone: "matiz" };
  }
  return { id: "sin-consenso", label: "Cerrado sin consenso", tone: "matiz" };
}

// Qué hipótesis queda mejor respaldada por cada pista de Explorar. Investigar
// más a fondo (recoger varias pistas) hace que una lectura empiece a pesar
// más que las otras en Orientar — sin decírtelo de forma explícita.
export const PISTA_HIPOTESIS_LEAN = {
  "explorar-observacion": "vinculo",
  "explorar-voz": "reto",
  "explorar-produccion": "autonomia",
};

export function getHipotesisRespaldada(pistas) {
  const explorPistas = pistas.filter((p) => p.mission === "explorar");
  if (explorPistas.length < 2) return null; // con una sola pista, todo es igual de plausible
  const votos: Record<string, number> = {};
  explorPistas.forEach((p) => {
    const lean = PISTA_HIPOTESIS_LEAN[p.id];
    if (lean) votos[lean] = (votos[lean] || 0) + 1;
  });
  const entries = Object.entries(votos).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const [topId, topVotes] = entries[0];
  const tied = entries.filter(([, v]) => v === topVotes).length > 1;
  return tied ? null : topId;
}

// Eventos que pueden saltar a mitad de semana. No son "correctos" ni
// "incorrectos": son el tipo de imprevisto con el que cualquier caso real
// se encuentra. `trigger` indica en qué estación puede aparecer cada uno.
export const EVENTS = [
  {
    id: "reunion-familia",
    trigger: "actuar",
    chance: 0.5,
    icon: "📞",
    text: "La familia de Alex llama pidiendo una reunión urgente antes de seguir adelante.",
    choice: {
      accept: { label: "Atenderla ahora (−1 día)", days: 1, confianza: 8 },
      decline: { label: "Seguir con el plan (sin coste)", days: 0, confianza: -4 },
    },
  },
  {
    id: "mal-dia",
    trigger: "acompanar",
    chance: 0.5,
    icon: "😕",
    text: "El tutor avisa: Alex ha tenido un mal día en clase y eso siembra dudas sobre si la hipótesis sigue en pie.",
    choice: {
      accept: { label: "Revisar la lectura con el tutor (−1 día)", days: 1, confianza: 6 },
      decline: { label: "Mantener el rumbo (sin coste)", days: 0, confianza: -6 },
    },
  },
];

// Orden en el que se visitan las estaciones que pueden disparar un evento.
// Se usa solo para saber, desde cualquier estación, si quedan más
// oportunidades por delante de que salte un imprevisto.
export const EVENT_TRIGGER_ORDER = ["actuar", "acompanar"];

function isUltimaOportunidad(trigger) {
  const idx = EVENT_TRIGGER_ORDER.indexOf(trigger);
  return idx === EVENT_TRIGGER_ORDER.length - 1;
}

// Elige, como mucho, un evento para la estación indicada.
//
// Cada evento tiene su propia probabilidad (`chance`), pero dejar esa tirada
// suelta en cada estación puede hacer que una partida entera pase sin que
// salte ni un solo imprevisto — que es precisamente lo que no queremos: un
// juego se siente vivo cuando algo pasa sin que el jugador lo pida. Por eso,
// si ya no quedan más estaciones con eventos por delante y todavía no ha
// saltado ninguno en toda la partida, esta es la última oportunidad y el
// evento se dispara siempre en vez de dejarlo a la suerte.
export function pickEventForTrigger(trigger, triggeredEvents = []) {
  const candidates = EVENTS.filter(
    (event) => event.trigger === trigger && !triggeredEvents.includes(event.id)
  );
  if (candidates.length === 0) return null;

  const sinEventosTodavia = triggeredEvents.length === 0;
  if (isUltimaOportunidad(trigger) && sinEventosTodavia) {
    return candidates[0];
  }

  return candidates.find((event) => Math.random() < event.chance) || null;
}
