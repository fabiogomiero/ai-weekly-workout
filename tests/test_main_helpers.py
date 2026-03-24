# tests/test_main_helpers.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / 'bot'))

from main import strip_html


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
