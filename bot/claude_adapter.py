# bot/claude_adapter.py
import json
import anthropic

SYSTEM_PROMPT = """Sei un coach di corsa e forza specializzato.
Se il motivo è stanchezza fisica, proponi riposo attivo o riduzione del volume.
Se il motivo è mancanza di tempo, proponi come recuperare il workout saltato.
Rispondi SOLO in italiano. Rispondi SOLO con JSON valido nel formato specificato. Nessun testo fuori dal JSON.
RPE (Rate of Perceived Exertion) 1-10: scala di sforzo percepito.
Se l'atleta ha completato gli allenamenti con RPE ≥ 8, prioritizza il recupero attivo nel giorno successivo.
Se RPE ≤ 4, l'allenamento era sottotono: puoi suggerire di mantenere o aumentare leggermente il carico.
Se l'atleta ha scritto qualcosa, citalo esplicitamente nell'adaptation e rispondi in modo personale."""

FALLBACK = ("Continua con il piano previsto. 💪", False, "")


def _reason_text(w: dict) -> str:
    if w.get('reason') == 'tired':   return 'stanchezza fisica'
    if w.get('reason') == 'no_time': return 'mancanza di tempo'
    return 'motivo in nota libera'


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
    obiettivo = context.get('obiettivo', '')

    skipped_workouts = context['skipped_workouts']
    noted_workouts = context.get('noted_workouts', [])
    user_notes = context.get('user_notes', [])
    high_rpe_trigger = context.get('high_rpe_trigger', False)

    # Mappa workout_key → nota per inlineare la nota accanto al workout saltato
    notes_map = {n['workout_key']: n['nota'] for n in user_notes if n.get('workout_key') and n.get('nota')}

    skipped_lines = '\n'.join(
        f'- {w["tipo"]}: {w["descrizione"]} (motivo: {_reason_text(w)})'
        + (f' — l\'atleta ha scritto: "{notes_map[w["workout_key"]]}"' if w.get('workout_key') and w['workout_key'] in notes_map else '')
        for w in skipped_workouts
    )
    today_lines = '\n'.join(
        f'- {w["tipo"]}: {w["descrizione"]}' for w in context['today_workouts']
    )

    done_workouts = context.get('done_workouts', [])
    if done_workouts:
        done_lines = '\n'.join(
            f'- {w["tipo"]}: {w["descrizione"]} — RPE {w["rpe"]}/10'
            for w in done_workouts
        )
        done_section = f"\nIeri l'atleta ha completato:\n{done_lines}\n"
    else:
        done_section = ''

    rest_note_entry = next(
        (n for n in user_notes if n.get('workout_key') == 'rest'),
        None,
    )
    notes_section = ''

    if high_rpe_trigger and not skipped_workouts:
        trigger_line = "L'atleta ha completato tutti gli allenamenti ma con RPE elevato. Proponi un adattamento per recupero."
        opening = f"Ieri l'atleta ha completato gli allenamenti con RPE elevato.\n{done_section.strip()}"
        done_section = ''
    elif not skipped_workouts and rest_note_entry and not high_rpe_trigger:
        trigger_line = 'Valuta quello che l\'atleta ha scritto e proponi eventuali aggiustamenti per oggi se necessario.'
        opening = f"Ieri era giorno di riposo. L'atleta ha scritto:\n\"{rest_note_entry['nota']}\""
    elif not skipped_workouts and noted_workouts:
        noted_lines = '\n'.join(
            f'- {w["tipo"]}: {w["descrizione"]} — l\'atleta ha scritto: "{w["nota"]}"'
            for w in noted_workouts
        )
        opening = f"Ieri l'atleta ha annotato:\n{noted_lines}"
        trigger_line = "Considera quello che l'atleta ha scritto e rispondi in modo personale; adatta il piano di oggi solo se necessario."
    elif skipped_workouts:
        opening = f"Ieri l'atleta ha saltato:\n{skipped_lines}"
        trigger_line = 'Proponi un adattamento considerando il motivo del salto e quello che l\'atleta ha scritto.'
    else:
        return FALLBACK

    user_prompt = f"""{opening}
{done_section}{notes_section}
Settimana corrente: Settimana {context['week_number']} — {context['week_focus']}
Obiettivo: {obiettivo}

Allenamento previsto oggi:
{today_lines}

{trigger_line}
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
