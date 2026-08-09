"""backend/tests/test_debate_parsing.py // a turn must survive the shapes a
model actually returns, not only the one it was asked for."""

from app.services.debate import _parse_turn

CLEAN = (
    '{"argumento": "Separemos lo observado de lo interpretado.", '
    '"fortalezas": ["Evita etiquetar"], "riesgos": ["El apoyo tarda"]}'
)


def test_parses_a_well_formed_turn():
    turn = _parse_turn(CLEAN)
    assert turn["argumento"] == "Separemos lo observado de lo interpretado."
    assert turn["fortalezas"] == ["Evita etiquetar"]
    assert turn["riesgos"] == ["El apoyo tarda"]


def test_survives_a_stray_closing_brace():
    """The reported failure: one extra ``}`` dumped the raw JSON on screen."""
    turn = _parse_turn(CLEAN + "}")
    assert turn["argumento"] == "Separemos lo observado de lo interpretado."
    assert turn["fortalezas"] == ["Evita etiquetar"]
    assert not turn["argumento"].startswith("{")


def test_survives_prose_wrapped_around_the_object():
    turn = _parse_turn(f"Claro, aquí tienes mi turno:\n{CLEAN}\nEspero que ayude.")
    assert turn["argumento"] == "Separemos lo observado de lo interpretado."


def test_survives_a_fenced_code_block():
    turn = _parse_turn(f"```json\n{CLEAN}\n```")
    assert turn["argumento"] == "Separemos lo observado de lo interpretado."


def test_keeps_braces_that_live_inside_the_argument():
    raw = '{"argumento": "Usa {llaves} y \\"comillas\\" aquí.", "fortalezas": [], "riesgos": []}'
    assert _parse_turn(raw)["argumento"] == 'Usa {llaves} y "comillas" aquí.'


def test_a_string_where_a_list_belongs_is_one_item_not_many_letters():
    raw = '{"argumento": "Hola", "fortalezas": "Una sola", "riesgos": []}'
    assert _parse_turn(raw)["fortalezas"] == ["Una sola"]


def test_caps_each_column_at_three_and_drops_blanks():
    raw = (
        '{"argumento": "Hola", "fortalezas": ["a", "  ", "b", "c", "d"], '
        '"riesgos": []}'
    )
    assert _parse_turn(raw)["fortalezas"] == ["a", "b", "c"]


def test_plain_prose_still_becomes_an_argument():
    """No JSON at all costs the two columns, never the whole turn."""
    turn = _parse_turn("El equipo debería observar una semana más.")
    assert turn["argumento"] == "El equipo debería observar una semana más."
    assert turn["fortalezas"] == []
