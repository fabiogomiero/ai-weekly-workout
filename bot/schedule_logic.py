# bot/schedule_logic.py
import json
from datetime import date
from pathlib import Path
from typing import Optional


def load_plan(plan_path: Path) -> dict:
    with open(plan_path, encoding='utf-8') as f:
        return json.load(f)


def get_workouts_for_date(target_date: date, plan: dict) -> list[dict]:
    """
    Restituisce la lista di workout per la data data.
    Ogni elemento: { key, cls, txt, title, body }
    Lista vuota se la data non è nel piano o è giorno di riposo.
    """
    target_iso = target_date.isoformat()
    for week in plan['weeks']:
        for day in week['days']:
            if day.get('isoDate') == target_iso:
                badges = day.get('badges', [])
                if not badges:
                    return []
                result = []
                for b in badges:
                    detail = plan['details'].get(b['key'], {})
                    result.append({
                        'key': b['key'],
                        'cls': b['cls'],
                        'txt': b['txt'],
                        'title': detail.get('title', b['txt']),
                        'body': detail.get('body', ''),
                    })
                return result
    return []


def is_rest_day(target_date: date, plan: dict) -> bool:
    """
    True se la data è un giorno di riposo nel piano
    (giorno presente ma senza workout, o non nel piano).
    """
    target_iso = target_date.isoformat()
    for week in plan['weeks']:
        for day in week['days']:
            if day.get('isoDate') == target_iso:
                return not bool(day.get('badges'))
    # Data non trovata nel piano → tratta come riposo
    return True


def get_week_context(target_date: date, plan: dict) -> Optional[dict]:
    """Restituisce il contesto della settimana per la data data."""
    target_iso = target_date.isoformat()
    for week in plan['weeks']:
        for day in week['days']:
            if day.get('isoDate') == target_iso:
                return {'label': week['label'], 'note': week.get('note', '')}
    return None
