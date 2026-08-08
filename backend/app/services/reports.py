from html import escape
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..models import Case, JourneyTemplate


def build_case_pdf(case: Case, template: JourneyTemplate) -> bytes:
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.8 * cm,
        leftMargin=1.8 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title=case.alumno.titulo_caso(),
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph(escape(case.alumno.titulo_caso()), styles["Title"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            escape(case.alumno.descripcion or "Sin descripción"),
            styles["BodyText"],
        ),
        Spacer(1, 0.4 * cm),
    ]
    state = case.estado_interactivo
    metrics = [
        ["Progreso", f"{case.progreso.porcentaje}%"],
        ["Días restantes", str(state.dias_restantes)],
        ["Confianza", f"{state.confianza_equipo}%"],
        ["XP", str(state.xp_total)],
        ["Hipótesis", state.hipotesis_sostenida or "Sin definir"],
    ]
    table = Table(metrics, colWidths=[5 * cm, 10 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#E8EEF8")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.extend([table, Spacer(1, 0.5 * cm)])

    stations = {station.id: station for station in template.estaciones}
    for response in case.respuestas:
        station = stations.get(response.estacion_id)
        if station is None:
            continue
        options = {item.id: item.texto for item in station.opciones}
        selected = ", ".join(
            options[item]
            for item in response.opciones_seleccionadas
            if item in options
        )
        story.append(Paragraph(escape(station.titulo), styles["Heading2"]))
        story.append(Paragraph(escape(selected or "Sin selección"), styles["BodyText"]))
        if response.comentario:
            story.append(
                Paragraph(
                    f"Observación: {escape(response.comentario)}",
                    styles["BodyText"],
                )
            )

    if case.resumen_final.contenido:
        story.extend(
            [
                Spacer(1, 0.5 * cm),
                Paragraph("Resumen final", styles["Heading2"]),
                Paragraph(escape(case.resumen_final.contenido), styles["BodyText"]),
            ]
        )
    document.build(story)
    return buffer.getvalue()
