# tests/test_claude_adapter.py
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
sys.path.insert(0, str(Path(__file__).parent.parent / 'bot'))

from claude_adapter import propose_adaptation, _parse_claude_response

SAMPLE_CONTEXT = {
    'skipped_workouts': [{'tipo': 'Corsa', 'descrizione': 'Corsa Lv7', 'reason': 'tired'}],
    'today_workouts': [{'tipo': 'Forza', 'descrizione': 'Forza gambe base'}],
    'week_number': 2,
    'week_focus': 'Lv 7 running',
    'days_to_race': 20,
    'primary_goal': 'Gara 10km 26 Aprile 2026',
    'secondary_goal': 'Forza gambe (Resistenza Verticale) + arrampicata',
}


def test_parse_valid_response():
    raw = '{"adaptation": "Riposo attivo oggi.", "today_modified": false, "today_override": ""}'
    adaptation, modified, override = _parse_claude_response(raw)
    assert adaptation == "Riposo attivo oggi."
    assert modified is False
    assert override == ""


def test_parse_today_modified_true():
    raw = '{"adaptation": "Sostituisci corsa con camminata.", "today_modified": true, "today_override": "Camminata 30 min"}'
    _, modified, override = _parse_claude_response(raw)
    assert modified is True
    assert override == "Camminata 30 min"


def test_parse_today_modified_false_ignores_override():
    raw = '{"adaptation": "Vai avanti.", "today_modified": false, "today_override": "Questo non conta"}'
    _, modified, override = _parse_claude_response(raw)
    assert modified is False
    assert override == ""  # ignorato quando today_modified=false


def test_parse_invalid_json_fallback():
    adaptation, modified, override = _parse_claude_response("risposta non JSON")
    assert "piano previsto" in adaptation.lower()
    assert modified is False


def test_parse_missing_field_fallback():
    raw = '{"adaptation": "Ok."}'  # manca today_modified
    adaptation, modified, override = _parse_claude_response(raw)
    assert "piano previsto" in adaptation.lower()


def test_propose_adaptation_api_error_fallback():
    """Se Claude API fallisce per qualsiasi motivo, restituisce messaggio di fallback."""
    with patch('claude_adapter.anthropic.Anthropic') as mock_cls:
        # Simula un'eccezione generica (evita dipendenza dal costruttore di APIError)
        mock_cls.return_value.messages.create.side_effect = Exception("simulated API failure")
        adaptation, modified, override = propose_adaptation(SAMPLE_CONTEXT, api_key='fake')
    assert "piano previsto" in adaptation.lower()
    assert modified is False
