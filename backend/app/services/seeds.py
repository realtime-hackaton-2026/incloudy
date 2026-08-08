from ..models import (
    JourneyTemplate,
    QuestionType,
    StationOption,
    TemplateStation,
)


async def ensure_default_journey() -> None:
    if await JourneyTemplate.find_one(JourneyTemplate.activa == True) is not None:  # noqa: E712
        return

    template = JourneyTemplate(
        nombre="Recorrido pedagógico inicial",
        version=1,
        activa=True,
        created_by="system",
        estaciones=[
            TemplateStation(
                id="explorar",
                orden=1,
                titulo="Explorar",
                descripcion="Reconoce las primeras señales observables del caso.",
                tipo=QuestionType.multiple,
                opciones=[
                    StationOption(
                        id="dificultad_atencion",
                        texto="Presenta dificultad para mantener la atención",
                    ),
                    StationOption(
                        id="necesita_instrucciones_breves",
                        texto="Responde mejor a instrucciones breves",
                    ),
                    StationOption(
                        id="participacion_variable",
                        texto="Su participación cambia según la actividad",
                    ),
                ],
            ),
            TemplateStation(
                id="orientar",
                orden=2,
                titulo="Orientar",
                descripcion="Identifica la necesidad educativa prioritaria.",
                tipo=QuestionType.single,
                opciones=[
                    StationOption(
                        id="apoyo_organizacion",
                        texto="Apoyo para organizar tareas y tiempos",
                    ),
                    StationOption(
                        id="apoyo_comunicacion",
                        texto="Apoyo para expresar necesidades e ideas",
                    ),
                    StationOption(
                        id="apoyo_regulacion",
                        texto="Apoyo para regular emociones y conducta",
                    ),
                ],
            ),
            TemplateStation(
                id="acompanar",
                orden=3,
                titulo="Acompañar",
                descripcion="Selecciona apoyos adecuados para el alumno.",
                tipo=QuestionType.multiple,
                opciones=[
                    StationOption(
                        id="rutina_visual",
                        texto="Utilizar una rutina o agenda visual",
                    ),
                    StationOption(
                        id="instrucciones_pasos",
                        texto="Dividir las instrucciones en pasos pequeños",
                    ),
                    StationOption(
                        id="acompanamiento_pares",
                        texto="Incluir acompañamiento de pares",
                    ),
                ],
            ),
            TemplateStation(
                id="actuar",
                orden=4,
                titulo="Actuar",
                descripcion="Define acciones concretas para el aula.",
                tipo=QuestionType.multiple,
                opciones=[
                    StationOption(
                        id="adaptar_actividad",
                        texto="Adaptar la extensión o formato de la actividad",
                    ),
                    StationOption(
                        id="pausas_planificadas",
                        texto="Incluir pausas planificadas",
                    ),
                    StationOption(
                        id="refuerzo_positivo",
                        texto="Aplicar refuerzo positivo específico",
                    ),
                ],
            ),
            TemplateStation(
                id="compartir",
                orden=5,
                titulo="Compartir",
                descripcion="Define cómo revisar y compartir el seguimiento.",
                tipo=QuestionType.single,
                opciones=[
                    StationOption(
                        id="revision_semanal",
                        texto="Realizar una revisión semanal",
                    ),
                    StationOption(
                        id="revision_quincenal",
                        texto="Realizar una revisión quincenal",
                    ),
                    StationOption(
                        id="revision_por_hitos",
                        texto="Revisar cuando se complete cada objetivo",
                    ),
                ],
            ),
        ],
    )
    await template.insert()
