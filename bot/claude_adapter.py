# bot/claude_adapter.py
import json
import anthropic

SYSTEM_PROMPT = """Sei un coach di corsa e forza specializzato.
Obiettivo primario dell'atleta: correre 10km il 26 Aprile 2026.
Obiettivo secondario: aumentare forza e resistenza gambe (metodo Resistenza Verticale) + arrampicata boulder/indoor.
Quando proponi adattamenti, prioritizza sempre il recupero per la gara.
Se il motivo è stanchezza fisica, proponi riposo attivo o riduzione del volume.
Se il motivo è mancanza di tempo, proponi come recuperare il workout saltato.
Rispondi SOLO in italiano. Rispondi SOLO con JSON valido nel formato specificato. Nessun testo fuori dal JSON."""

FALLBACK = ("Continua con il piano previsto. 💪", False, "")


def _parse_claude_response(raw: str) -> tuple[str, bool, str]:
    """
    Parsa la risposta JSON di Claude.
    Se invalida o mancante di campi → restituisce FALLBACK.
    """
    try:
        data = json.loads(raw)
        adaptation = str(data['adaptation'])
        today_modified = bool(data['today_modified'])
        # today_override solo se today_modified=True
        today_override = str(data.get('today_override', '')) if today_modified else ''
        return adaptation, today_modified, today_override
    except (json.JSONDecodeError, KeyError, TypeError):
        return FALLBACK


def propose_adaptation(
    context: dict,
    api_key: str,
) -> tuple[str, bool, str]:
    """
    Chiama Claude API con il contesto del workout saltato.
    Restituisce (adaptation_text, today_modified, today_override).
    In caso di qualsiasi errore, restituisce FALLBACK.
    """
    # Usa il valore passato nel context (testabile e deterministico)
    days_to_race = context['days_to_race']

    skipped_lines = '\n'.join(
        f'- {w["tipo"]}: {w["descrizione"]} (motivo: {"stanchezza fisica" if w["reason"] == "tired" else "mancanza di tempo"})'
        for w in context['skipped_workouts']
    )
    today_lines = '\n'.join(
        f'- {w["tipo"]}: {w["descrizione"]}' for w in context['today_workouts']
    )

    user_prompt = f"""Ieri l'atleta ha saltato:
{skipped_lines}

Settimana corrente: Settimana {context['week_number']} — {context['week_focus']}
Giorni alla gara 10km: {days_to_race}

Allenamento previsto oggi:
{today_lines}

Proponi un adattamento considerando il motivo del salto.
Formato risposta JSON esatto:
{{"adaptation": "...", "today_modified": false, "today_override": ""}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-haiku-4-5-20251001',  # haiku: veloce ed economico per questo uso
            max_tokens=300,
            system=SYSTEM_PROMPT,
            messages=[{'role': 'user', 'content': user_prompt}],
        )
        raw = response.content[0].text
        return _parse_claude_response(raw)
    except Exception:
        return FALLBACK
