# tests/test_main_helpers.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / 'bot'))

from main import strip_html, fmt_workout


def test_strip_html_removes_strong():
    assert strip_html('<strong>Testo</strong> normale') == 'Testo normale'

def test_strip_html_converts_br_to_newline():
    assert strip_html('Prima riga<br>Seconda riga') == 'Prima riga\nSeconda riga'
    assert strip_html('Prima riga<br/>Seconda riga') == 'Prima riga\nSeconda riga'

def test_strip_html_escapes_markdown_chars():
    assert strip_html('3x_12 squat') == '3x\\_12 squat'
    assert strip_html('**bold**') == '\\*\\*bold\\*\\*'

def test_strip_html_empty():
    assert strip_html('') == ''

def test_strip_html_no_html():
    assert strip_html('Testo semplice') == 'Testo semplice'


def test_fmt_workout_with_body():
    w = {'title': 'Corsa Lv 7', 'body': "<strong>5' camminando</strong> + 25' corsa"}
    result = fmt_workout(w)
    # strip_html removes <strong>, does not touch apostrophes; no _ or * → no escaping
    assert result == "• Corsa Lv 7\n  _5' camminando + 25' corsa_"

def test_fmt_workout_without_body():
    w = {'title': 'Riposo attivo', 'body': ''}
    assert fmt_workout(w) == '• Riposo attivo'

def test_fmt_workout_body_with_br():
    w = {'title': 'Mobilità', 'body': 'Riga 1<br>Riga 2'}
    result = fmt_workout(w)
    assert '• Mobilità\n  _Riga 1\nRiga 2_' == result
