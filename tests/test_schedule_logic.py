# tests/test_schedule_logic.py
import json
from datetime import date
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / 'bot'))

from schedule_logic import get_workouts_for_date, is_rest_day

# Carica il piano reale per i test
PLAN_PATH = Path(__file__).parent.parent / 'data' / 'plan_apr2026.json'
with open(PLAN_PATH, encoding='utf-8') as f:
    PLAN = json.load(f)


def test_get_workouts_known_date():
    """23 marzo 2026 è Mobilità/recupero (mob0)."""
    workouts = get_workouts_for_date(date(2026, 3, 23), PLAN)
    assert len(workouts) == 1
    assert workouts[0]['key'] == 'mob0'


def test_is_rest_day_true():
    """28 marzo 2026 è giorno di riposo (Sett. 1)."""
    assert is_rest_day(date(2026, 3, 28), PLAN) is True


def test_is_rest_day_false():
    """25 marzo 2026 NON è riposo (Corsa Lv 6)."""
    assert is_rest_day(date(2026, 3, 25), PLAN) is False


def test_race_day():
    """26 aprile 2026 è il giorno della gara."""
    workouts = get_workouts_for_date(date(2026, 4, 26), PLAN)
    assert any(w['key'] == 'r10' for w in workouts)


def test_date_not_in_plan():
    """Data fuori dal piano: restituisce lista vuota."""
    workouts = get_workouts_for_date(date(2025, 1, 1), PLAN)
    assert workouts == []
