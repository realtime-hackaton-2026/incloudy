from copy import deepcopy
from datetime import timedelta

from ..config import settings
from ..models import (
    Case,
    CaseProgress,
    CaseScenario,
    InteractiveCaseState,
    JourneyTemplate,
    QuestionType,
    StationOption,
    Student,
    TemplateStation,
    User,
    utcnow,
)

TEMPLATE_NAME = "BRÚJULA · Recorrido del caso de Alex"
TEMPLATE_VERSION = 1
SCENARIO_SLUG = "caso-alex"

CASE_PRESENTATION = (
    "Alex tiene 9 años. Termina algunas tareas muy rápido y pierde interés cuando "
    "las actividades son repetitivas. Tienes esta semana para entender qué le pasa, "
    "actuar y hacer seguimiento: cada pista acerca a una lectura más fiable, pero "
    "también gasta un día de los que quedan."
)


def option(
    option_id: str,
    text: str,
    icon: str | None = None,
    **content: object,
) -> StationOption:
    return StationOption(
        id=option_id,
        texto=text,
        icono=icon,
        contenido=content,
    )


def build_stations() -> list[TemplateStation]:
    return [
        TemplateStation(
            id="explorar",
            orden=1,
            titulo="Explorar",
            subtitulo="Observar y detectar",
            descripcion="¿Qué quieres investigar primero?",
            tipo=QuestionType.multiple,
            opciones=[
                option(
                    "observar_contextos",
                    "Observar en diferentes contextos",
                    "👀",
                    tipo_evidencia="OBSERVACIÓN",
                    evidencia=(
                        "Alex termina algunas actividades antes que sus compañeros "
                        "y busca hablar con ellos en cuanto acaba."
                    ),
                    lectura_alternativa=(
                        "Podría ser que la tarea le resulte poco desafiante, o "
                        "simplemente que busque compañía."
                    ),
                    coste_dias=1,
                ),
                option(
                    "hablar_alumno",
                    "Hablar con el alumno",
                    "💬",
                    tipo_evidencia="VOZ DEL ALUMNO",
                    evidencia=(
                        "Alex cuenta que se aburre cuando repite el mismo tipo de "
                        "ejercicio muchas veces."
                    ),
                    lectura_alternativa=(
                        "El propio Alex no distingue si le falta reto o simplemente "
                        "variedad y compañía."
                    ),
                    coste_dias=1,
                ),
                option(
                    "revisar_producciones",
                    "Revisar sus producciones",
                    "📝",
                    tipo_evidencia="PRODUCCIÓN",
                    evidencia=(
                        "Sus trabajos muestran ideas más elaboradas cuando el "
                        "enunciado es abierto."
                    ),
                    lectura_alternativa=(
                        "Un enunciado abierto también permite trabajar con quien él "
                        "elige; no aísla la causa."
                    ),
                    coste_dias=1,
                ),
            ],
            contenido={
                "introduccion": CASE_PRESENTATION,
                "pregunta_cierre": "¿Investigas algo más, o das el caso por explorado?",
                "acciones": [
                    "Guardar y seguir aquí",
                    "Cerrar Explorar ya (sin gastar más días)",
                    "Dar el caso por explorado",
                ],
                "mensaje_completo": "Has investigado todo lo que había que ver aquí.",
                "volver": "← Volver al mapa",
            },
        ),
        TemplateStation(
            id="orientar",
            orden=2,
            titulo="Orientar",
            subtitulo="Comprender y analizar",
            descripcion="¿Qué hipótesis vas a sostener?",
            tipo=QuestionType.single,
            opciones=[
                option(
                    "reto",
                    "Necesita más reto",
                    "🎯",
                    coste_dias=1,
                    voces=[
                        {
                            "autor": "Tutor",
                            "texto": (
                                "Es un patrón claro. Termina rápido y se apaga "
                                "cuando la tarea es repetitiva."
                            ),
                        },
                        {
                            "autor": "Orientadora",
                            "texto": (
                                "Eso también pasa cuando un niño busca compañía, "
                                "no solo reto."
                            ),
                        },
                    ],
                ),
                option(
                    "vinculo",
                    "Necesita más vínculo",
                    "🤝",
                    coste_dias=1,
                    voces=[
                        {
                            "autor": "Orientadora",
                            "texto": (
                                "Busca a sus compañeros constantemente. Puede ser "
                                "más social que cognitivo."
                            ),
                        },
                        {
                            "autor": "Tutor",
                            "texto": (
                                "Sus trabajos abiertos son notablemente mejores. "
                                "Eso no explica solo vínculo."
                            ),
                        },
                    ],
                ),
                option(
                    "autonomia",
                    "Necesita más autonomía",
                    "🧭",
                    coste_dias=1,
                    voces=[
                        {
                            "autor": "Alex",
                            "texto": "Me gusta más cuando elijo yo cómo hacerlo.",
                        },
                        {
                            "autor": "Tutor",
                            "texto": (
                                "Puede ser autonomía, o puede ser que el nivel de "
                                "reto no le exige lo suficiente."
                            ),
                        },
                    ],
                ),
            ],
            contenido={
                "introduccion": (
                    "Tienes varias pistas sobre Alex, pero el equipo docente no está "
                    "de acuerdo en qué significan. Toca sostener una lectura del caso, "
                    "sabiendo que puede no ser la única posible."
                ),
                "mensaje_dos_o_mas_pistas": (
                    "Haber investigado a fondo te da una lectura algo más clara: "
                    "fíjate bien en las pistas."
                ),
                "mensaje_pocas_pistas": (
                    "Con una sola pista es difícil saber cuál pesa más; las tres "
                    "siguen siendo igual de plausibles."
                ),
                "resultado": "HIPÓTESIS SOSTENIDA (no confirmada)",
                "advertencia": (
                    "Aún no sabes si se sostendrá cuando lleguen los resultados."
                ),
                "fuerza_voces": ["reforzada", "debilitada", "sin_lectura_clara"],
                "continuar": "Continuar",
                "volver": "← Volver al mapa",
            },
        ),
        TemplateStation(
            id="actuar",
            orden=3,
            titulo="Actuar",
            subtitulo="Planificar e intervenir",
            descripcion="Selecciona una estrategia",
            tipo=QuestionType.single,
            opciones=[
                option(
                    "reto_abierto",
                    "Reto abierto",
                    "🔭",
                    descripcion=(
                        "Alex elige un proyecto propio dentro del tema de la unidad."
                    ),
                    alineada_con="reto",
                    coste_dias=1,
                ),
                option(
                    "andamiaje_eleccion",
                    "Andamiaje con elección",
                    "🧩",
                    descripcion=(
                        "Se ofrecen niveles de dificultad crecientes que Alex puede "
                        "escoger."
                    ),
                    alineada_con="autonomia",
                    coste_dias=1,
                ),
                option(
                    "eleccion_producto",
                    "Elección del producto",
                    "🎨",
                    descripcion=(
                        "Alex decide cómo mostrar lo aprendido junto a un compañero: "
                        "texto, vídeo o maqueta."
                    ),
                    alineada_con="vinculo",
                    coste_dias=1,
                ),
            ],
            contenido={
                "introduccion": "En el castillo se preparan las intervenciones.",
                "con_hipotesis": (
                    "Tu hipótesis actual: [icono] «[hipótesis]». Elige una estrategia; "
                    "no tiene por qué ser la más obvia."
                ),
                "sin_hipotesis": "Elige una estrategia para Alex.",
                "resultado": "Intervención preparada.",
                "confianza_alineada": {
                    "cambio": 15,
                    "texto": (
                        "El equipo ve coherencia entre lo que sostienes y lo que haces."
                    ),
                },
                "confianza_no_alineada": {
                    "cambio": -15,
                    "texto": (
                        "La estrategia no encaja del todo con la hipótesis sostenida "
                        "en Orientar. Puede que alguien lo note en Compartir."
                    ),
                },
                "continuar": "Continuar",
                "volver": "← Volver al mapa",
            },
        ),
        TemplateStation(
            id="acompanar",
            orden=4,
            titulo="Acompañar",
            subtitulo="Hacer seguimiento",
            descripcion="¿Qué observas?",
            tipo=QuestionType.single,
            opciones=[
                option("mejorado", "Ha mejorado", "↑", direccion="mejora"),
                option("se_mantiene", "Se mantiene", "→", direccion="estable"),
                option("empeorado", "Ha empeorado", "↓", direccion="empeora"),
            ],
            contenido={
                "introduccion": (
                    "Ha pasado un tiempo desde la intervención. Es momento de hacer "
                    "seguimiento."
                ),
                "indicadores": ["Motivación", "Participación", "Autonomía"],
                "coste_dias": 1,
                "aviso_incoherencia": (
                    "⚠ Los datos no encajan del todo con la hipótesis sostenida en "
                    "Orientar. Puede que haya que revisar la lectura del caso más "
                    "adelante, en Compartir."
                ),
                "resultado": "Seguimiento registrado en el cuaderno.",
                "confianza_coherente": (
                    "+[confianza] Confianza — la lectura que das cuadra con lo que "
                    "se observa."
                ),
                "confianza_incoherente": (
                    "[confianza] Confianza — el equipo nota que el resultado que "
                    "reportas no encaja del todo con lo que realmente está pasando."
                ),
                "continuar": "Continuar",
                "volver": "← Volver al mapa",
            },
        ),
        TemplateStation(
            id="compartir",
            orden=5,
            titulo="Compartir",
            subtitulo="Coordinar y comunicar",
            descripcion="¿Con quién compartes lo aprendido?",
            tipo=QuestionType.multiple,
            opciones=[
                option(
                    "tutor",
                    "Tutor",
                    "👩‍🏫",
                    reaccion_coherente=(
                        "Coincide contigo: en clase también se nota que [resumen de "
                        "la hipótesis]."
                    ),
                    reaccion_incoherente=(
                        "Duda: en clase no termina de ver que [resumen de la "
                        "hipótesis]. Cree que la estrategia no encaja del todo."
                    ),
                ),
                option(
                    "orientador",
                    "Orientador",
                    "🧑‍💼",
                    reaccion_coherente=(
                        "Valida la lectura del caso y sugiere mantener el mismo "
                        "enfoque el próximo trimestre."
                    ),
                    reaccion_incoherente=(
                        "Plantea una lectura distinta y recomienda observar un poco "
                        "más antes de cerrar el caso."
                    ),
                ),
                option(
                    "familia",
                    "Familia",
                    "👨‍👩‍👧",
                    reaccion_coherente=(
                        "Confirma que en casa también se ve esa misma necesidad, y "
                        "agradece que se haya tenido en cuenta."
                    ),
                    reaccion_incoherente=(
                        "En casa ven algo distinto a lo que describe el caso, y no "
                        "se sienten del todo representados."
                    ),
                ),
                option(
                    "especialista",
                    "Especialista",
                    "👨‍🏫",
                    reaccion_coherente=(
                        "Refrenda el diagnóstico con criterios técnicos y no ve "
                        "necesidad de intervención adicional."
                    ),
                    reaccion_incoherente=(
                        "Recomienda una segunda observación: los datos disponibles no "
                        "son concluyentes todavía."
                    ),
                ),
            ],
            contenido={
                "introduccion": (
                    "La aldea reúne a quienes acompañan a Alex. ¿Con quién compartes "
                    "lo aprendido?"
                ),
                "semana_agotada": (
                    "La semana se ha acabado. Sólo hay tiempo para una reunión exprés "
                    "con una persona antes de cerrar el expediente."
                ),
                "seleccion_semana_agotada": "Elige a una persona",
                "accion": "Compartir",
                "titulo_reacciones": "Reacciones al caso",
                "confianza": (
                    "Confianza del equipo: [porcentaje]% — [nivel de acuerdo]."
                ),
                "cerrar": "Cerrar el caso",
            },
        ),
    ]


def build_template_content() -> dict[str, object]:
    return {
        "orden_estaciones": [
            "explorar",
            "orientar",
            "actuar",
            "acompanar",
            "compartir",
        ],
        "regla_desbloqueo": (
            "Las estaciones se completan en orden; las posteriores permanecen "
            "bloqueadas hasta completar las anteriores."
        ),
        "imprevistos": [
            {
                "id": "llamada_familia",
                "estacion_id": "actuar",
                "icono": "📞",
                "texto": (
                    "La familia de Alex llama pidiendo una reunión urgente antes de "
                    "seguir adelante."
                ),
                "opciones": [
                    {
                        "id": "atender_ahora",
                        "texto": "Atenderla ahora",
                        "coste_dias": 1,
                        "confianza": 8,
                    },
                    {
                        "id": "seguir_plan",
                        "texto": "Seguir con el plan",
                        "coste_dias": 0,
                        "confianza": -4,
                    },
                ],
            },
            {
                "id": "mal_dia",
                "estacion_id": "acompanar",
                "icono": "😕",
                "texto": (
                    "El tutor avisa: Alex ha tenido un mal día en clase y eso siembra "
                    "dudas sobre si la hipótesis sigue en pie."
                ),
                "opciones": [
                    {
                        "id": "revisar_tutor",
                        "texto": "Revisar la lectura con el tutor",
                        "coste_dias": 1,
                        "confianza": 6,
                    },
                    {
                        "id": "mantener_rumbo",
                        "texto": "Mantener el rumbo",
                        "coste_dias": 0,
                        "confianza": -6,
                    },
                ],
            },
        ],
        "nota_imprevistos": (
            "Los imprevistos no son respuestas correctas o incorrectas; introducen "
            "situaciones inesperadas propias de un caso real."
        ),
        "cierre": {
            "niveles": [
                {"id": "acuerdo_pleno", "min": 70, "texto": "ACUERDO PLENO"},
                {
                    "id": "acuerdo_reservas",
                    "min": 40,
                    "max": 69,
                    "texto": "ACUERDO CON RESERVAS",
                },
                {
                    "id": "sin_consenso",
                    "max": 39,
                    "texto": "CERRADO SIN CONSENSO",
                },
            ],
            "mensajes": [
                "CASO DE ALEX — CERRADO",
                "CASO RESUELTO",
                "CASO CERRADO CON MATICES",
                "MISIÓN COMPLETADA",
                "Has coordinado el caso completo de principio a fin.",
                "Has recorrido todo el mapa de BRÚJULA.",
            ],
        },
        "cuaderno": {
            "titulo": "Cuaderno del docente",
            "secciones": ["Pistas recogidas", "Mis notas", "Pistas del caso"],
            "descripcion": (
                "Este es tu espacio: anota lo que observas, tus dudas o lo que te "
                "gustaría recordar sobre el caso de Alex. No se corrige ni se "
                "comparte con nadie."
            ),
            "placeholder": "Escribe una nota sobre Alex...",
            "categoria_inicial": "General",
            "guardar": "Guardar nota",
            "sin_notas": "Todavía no has escrito ninguna nota.",
            "aviso_contrastes": (
                "[número] pista(s) tienen una lectura alternativa que las complica; "
                "míralas con más atención antes de fijar tu hipótesis en Orientar."
            ),
            "sin_pistas": (
                "Todavía no has recogido ninguna pista. Explora el mapa para empezar "
                "a reunir evidencias sobre la situación de aprendizaje."
            ),
            "lectura_alternativa": "Otra lectura posible: [contraste]",
        },
        "data_station": {
            "titulo": "Data Station",
            "descripcion": (
                "Resumen del recorrido de este alumno/a por el caso de Alex: progreso, "
                "hipótesis, decisiones e intervenciones registradas hasta ahora. El "
                "botón de descarga genera un informe en PDF listo para tutoría, "
                "orientación o familia."
            ),
            "descargar": "Descargar PDF",
            "generando": "Generando…",
            "metricas": [
                "XP total",
                "Estaciones completadas",
                "Días quedan de la semana",
                "Confianza del equipo",
                "Pistas recogidas",
                "Notas del cuaderno",
                "[porcentaje]% del caso completado",
            ],
            "estados_hipotesis": [
                "Confirmada por los datos y el equipo.",
                "Sostenida, aunque con lecturas distintas.",
                "Todavía sin verificar.",
            ],
            "estados_estacion": [
                "Completada",
                "En curso / disponible",
                "Bloqueada — orden aún no alcanzado",
            ],
            "compartido_con": "Compartido con",
        },
        "navegacion": {
            "barra": [
                "[número] día / días",
                "[porcentaje]%",
                "[hipótesis]",
                "[XP] XP",
                "[número] Pistas",
            ],
            "acciones": ["Data Station", "Reiniciar", "Volver al mapa"],
            "bloqueada": (
                "Todavía no puedes entrar en [estación]. El orden es Explorar → "
                "Orientar → Actuar → Acompañar → Compartir: completa antes las "
                "anteriores."
            ),
            "cerrado_matices": (
                "Caso cerrado — con matices que no todos compartían. Así son los "
                "casos reales."
            ),
            "resuelto": "Has resuelto el caso completo. ¡Gran trabajo, coordinador!",
            "dias_restantes": (
                "Quedan [número] días de la semana. Toca decidir: [estación]."
            ),
            "confirmar_reinicio": (
                "¿Reiniciar el caso desde el principio? Se perderá todo el progreso "
                "guardado (XP, pistas, hipótesis, decisiones...) y volverás a "
                "Explorar con el resto de estaciones bloqueadas."
            ),
        },
        "guia": [
            "Pulsa una estación desbloqueada para empezar su misión.",
            "Completa las misiones en orden para abrir el resto del mapa.",
            "Tus pistas guardadas están en el Cuaderno, arriba a la derecha.",
            "Cada misión superada suma XP a tu progreso.",
            "Pedir un consejo a Brúix",
        ],
        "resumen_interacciones": [
            {
                "estacion": "Explorar",
                "accion": "Investigar",
                "opciones": "Observar / Hablar / Producciones",
                "resultado": "Pistas + contraste; −1 día por pista",
            },
            {
                "estacion": "Orientar",
                "accion": "Sostener una hipótesis",
                "opciones": "Reto / Vínculo / Autonomía",
                "resultado": "Hipótesis de trabajo; −1 día",
            },
            {
                "estacion": "Actuar",
                "accion": "Elegir intervención",
                "opciones": "Reto abierto / Andamiaje / Producto",
                "resultado": "Intervención; ±15 Confianza; −1 día",
            },
            {
                "estacion": "Acompañar",
                "accion": "Interpretar seguimiento",
                "opciones": "Mejorado / Se mantiene / Empeorado",
                "resultado": "Seguimiento; confianza variable; −1 día",
            },
            {
                "estacion": "Compartir",
                "accion": "Coordinar",
                "opciones": "Tutor / Orientador / Familia / Especialista",
                "resultado": "Reacciones y cierre según confianza",
            },
        ],
        "variables_dinamicas": (
            "Los valores entre corchetes son variables dinámicas. Las voces, "
            "reacciones e imprevistos dependen de las decisiones, las pistas y la "
            "confianza."
        ),
    }


async def ensure_default_journey() -> JourneyTemplate:
    template = await JourneyTemplate.find_one(
        JourneyTemplate.nombre == TEMPLATE_NAME,
        JourneyTemplate.version == TEMPLATE_VERSION,
    )
    stations = build_stations()
    content = build_template_content()

    active_templates = await JourneyTemplate.find(
        JourneyTemplate.activa == True  # noqa: E712
    ).to_list()
    for active in active_templates:
        if template is None or active.id != template.id:
            active.activa = False
            await active.save()

    if template is None:
        template = JourneyTemplate(
            nombre=TEMPLATE_NAME,
            version=TEMPLATE_VERSION,
            activa=True,
            estaciones=stations,
            contenido=content,
            created_by="system",
        )
        await template.insert()
    else:
        template.activa = True
        template.estaciones = stations
        template.contenido = content
        await template.save()
    return template


async def ensure_alex_scenario(template: JourneyTemplate) -> CaseScenario:
    hypotheses = [
        option(
            "reto",
            "Necesita más reto",
            "🎯",
            descripcion=(
                "El patrón apunta a falta de desafío cognitivo, no a dificultad."
            ),
        ),
        option(
            "vinculo",
            "Necesita más vínculo",
            "🤝",
            descripcion=(
                "El patrón apunta a una necesidad de compañía y pertenencia."
            ),
        ),
        option(
            "autonomia",
            "Necesita más autonomía",
            "🧭",
            descripcion=(
                "El patrón apunta a falta de voz y decisión sobre su propio trabajo."
            ),
        ),
    ]
    scenario = await CaseScenario.find_one(CaseScenario.slug == SCENARIO_SLUG)
    values = {
        "nombre": "Caso de Alex",
        "template_id": str(template.id),
        "template_version": template.version,
        "alumno": Student(
            nombre="Alex",
            edad=9,
            curso="No especificado",
            descripcion=(
                "Termina algunas tareas muy rápido y pierde interés cuando las "
                "actividades son repetitivas."
            ),
            es_ficticio=True,
        ),
        "presentacion": CASE_PRESENTATION,
        "hipotesis": hypotheses,
        "estado_inicial": InteractiveCaseState(),
        "contenido": {
            "aviso": (
                "No existe una respuesta única marcada como correcta. Las tres "
                "hipótesis son lecturas posibles; las pistas de Explorar pueden hacer "
                "que una quede mejor respaldada."
            )
        },
        "activa": True,
    }
    if scenario is None:
        scenario = CaseScenario(slug=SCENARIO_SLUG, **values)
        await scenario.insert()
    else:
        for field, value in values.items():
            setattr(scenario, field, value)
        scenario.updated_at = utcnow()
        await scenario.save()
    return scenario


async def ensure_alex_case_for_user(
    user: User,
    template: JourneyTemplate | None = None,
    scenario: CaseScenario | None = None,
) -> Case:
    if template is None:
        template = await ensure_default_journey()
    if scenario is None:
        scenario = await ensure_alex_scenario(template)

    existing = await Case.find_one(
        Case.profesor_id == str(user.id),
        Case.scenario_id == str(scenario.id),
    )
    if existing is not None:
        return existing

    required = sum(station.obligatoria for station in template.estaciones)
    case = Case(
        profesor_id=str(user.id),
        template_id=str(template.id),
        template_version=template.version,
        scenario_id=str(scenario.id),
        alumno=scenario.alumno.model_copy(deep=True),
        progreso=CaseProgress(completadas=0, total=required, porcentaje=0),
        estado_interactivo=deepcopy(scenario.estado_inicial),
        retention_until=utcnow() + timedelta(days=settings.data_retention_days),
    )
    await case.insert()
    return case


async def ensure_seed_content() -> None:
    template = await ensure_default_journey()
    scenario = await ensure_alex_scenario(template)
    users = await User.find_all().to_list()
    for user in users:
        await ensure_alex_case_for_user(user, template, scenario)
