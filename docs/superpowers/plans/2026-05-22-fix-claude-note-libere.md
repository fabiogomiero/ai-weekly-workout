# Fix Claude: Note Libere Ignorate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correggere `bot/claude_adapter.py` affinché Claude legga e acknowledgi sempre le note libere (status='altro') scritte dall'utente su giorni normali di allenamento, invece di restituire il FALLBACK 💪.

**Architecture:** Il bug sta nella costruzione del prompt in `propose_adaptation()`: quando esistono note libere ma nessun workout saltato e non è un giorno di riposo, `opening` dice "Ieri l'atleta ha saltato: [vuoto]" — Claude Haiku risponde fuori formato JSON → FALLBACK. Fix: aggiungere un terzo ramo condizionale per opening/trigger_line + una riga al SYSTEM_PROMPT per garantire sempre l'acknowledgment.

**Tech Stack:** Python 3.12, `anthropic` SDK, Claude Haiku 4.5

---

### Task 1: Fix SYSTEM_PROMPT — acknowledgment obbligatorio note libere

**Files:**
- Modify: `bot/claude_adapter.py:5-11`

- [ ] **Step 1: Aggiungi riga al SYSTEM_PROMPT**

Sostituisci il SYSTEM_PROMPT esistente (righe 5-11) con:

```python
SYSTEM_PROMPT = """Sei un coach di corsa e forza specializzato.
Se il motivo è stanchezza fisica, proponi riposo attivo o riduzione del volume.
Se il motivo è mancanza di tempo, proponi come recuperare il workout saltato.
Rispondi SOLO in italiano. Rispondi SOLO con JSON valido nel formato specificato. Nessun testo fuori dal JSON.
RPE (Rate of Perceived Exertion) 1-10: scala di sforzo percepito.
Se l'atleta ha completato gli allenamenti con RPE ≥ 8, prioritizza il recupero attivo nel giorno successivo.
Se RPE ≤ 4, l'allenamento era sottotono: puoi suggerire di mantenere o aumentare leggermente il carico.
Se l'atleta ha scritto una nota libera, menziona sempre nell'adaptation di averla letta, anche se il piano non necessita modifiche."""
```

- [ ] **Step 2: Commit**

```bash
git add bot/claude_adapter.py
git commit -m "fix: SYSTEM_PROMPT — acknowledgment obbligatorio note libere"
```

---

### Task 2: Fix opening e trigger_line per il caso "note-only"

**Files:**
- Modify: `bot/claude_adapter.py:84-94`

**Contesto:** il caso da aggiungere è: `not skipped_workouts AND other_notes AND not rest_note_entry`. Attualmente questo caso cade nel ramo `else` di trigger_line ("Proponi un adattamento considerando il motivo del salto") e nel ramo `else` di opening ("Ieri l'atleta ha saltato: [vuoto]") — prompt logicamente contraddittorio che confonde Haiku.

- [ ] **Step 1: Aggiungi terzo ramo a trigger_line e opening**

Sostituisci le righe 84-94 (trigger_line + opening) con:

```python
    if high_rpe_trigger and not skipped_workouts:
        trigger_line = "L'atleta ha completato tutti gli allenamenti ma con RPE elevato. Proponi un adattamento per recupero."
    elif not skipped_workouts and rest_note_entry and not high_rpe_trigger:
        trigger_line = 'Valuta la nota e proponi eventuali aggiustamenti per oggi se necessario.'
    elif not skipped_workouts and other_notes:
        trigger_line = "Conferma nell'adaptation di aver letto la nota; adatta il piano di oggi solo se la nota lo giustifica."
    else:
        trigger_line = 'Proponi un adattamento considerando il motivo del salto.'

    if not skipped_workouts and rest_note_entry:
        opening = f"Ieri era giorno di riposo. L'atleta ha annotato:\n- {rest_note_entry['nota']}"
    elif not skipped_workouts and other_notes:
        notes_text = '\n'.join(f'- [{n["workout_key"]}] {n["nota"]}' for n in other_notes)
        opening = f"Ieri l'atleta ha annotato:\n{notes_text}"
        notes_section = ''  # già nell'opening, evita duplicazione nel prompt
    else:
        opening = f"Ieri l'atleta ha saltato:\n{skipped_lines}"
```

- [ ] **Step 2: Verifica visiva del prompt generato**

Apri Python interattivo e simula il caso note-only per verificare che il prompt sia coerente:

```python
import sys; sys.path.insert(0, 'bot')
from claude_adapter import propose_adaptation

# Simula: nota libera su giorno normale, nessun salto
ctx = {
    'skipped_workouts': [],
    'today_workouts': [{'tipo': 'Corsa', 'descrizione': 'Corsa facile 5km'}],
    'week_number': 4,
    'week_focus': 'Resistenza base',
    'obiettivo': 'Alta Montagna Estate 2026',
    'done_workouts': [],
    'high_rpe_trigger': False,
    'user_notes': [{'workout_key': 'corsa', 'nota': 'Ho fatto arrampicata invece della corsa'}],
}
# Verifica manuale del prompt — non chiamare l'API, controlla solo la logica:
# opening deve contenere "Ieri l'atleta ha annotato:" + la nota
# trigger_line deve contenere "Conferma nell'adaptation"
# notes_section deve essere vuota (nota già nell'opening)
```

Atteso: nessun errore, opening coerente.

- [ ] **Step 3: Commit**

```bash
git add bot/claude_adapter.py
git commit -m "fix: opening/trigger_line per note libere senza workout saltati"
```

---

### Task 3: Test manuale end-to-end

- [ ] **Step 1: Deploy su Railway**

Pusha il branch e mergia la PR. Railway farà rebuild automatico.

- [ ] **Step 2: Simula il caso via comando Telegram**

Invia `/test_morning` al bot dopo aver inserito manualmente in Supabase una riga con:
```sql
INSERT INTO workout_log (date, workout_key, status, user_note, evening_check_sent)
VALUES (CURRENT_DATE - 1, 'corsa', 'altro', 'Ho fatto arrampicata invece', true);
```

Atteso: il bot risponde con un messaggio che include riferimento alla nota (non 💪 FALLBACK).

- [ ] **Step 3: Verifica log Railway**

Nei Deploy Logs Railway: nessun `Exception` nel path `propose_adaptation`. La risposta di Claude deve essere JSON valido.
