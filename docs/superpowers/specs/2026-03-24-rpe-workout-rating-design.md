# Design: RPE Workout Rating + GitHub Pages

**Date:** 2026-03-24
**Status:** Implemented

## Context

Estensione del sistema agentico base (spec `2026-03-23-agentic-workout-bot-design.md`).

Aggiunge la valutazione RPE (Rate of Perceived Exertion) agli allenamenti completati, usata da Claude per calibrare il piano del giorno successivo. L'HTML viene pubblicato su GitHub Pages.

---

## Decisioni di Design

- **Scala:** RPE 1-10 (standard running/fitness)
- **Input:** entrambi — Telegram (dopo ✅ Sì al check serale) e HTML (selettore inline dopo "Fatto")
- **Uso RPE:** soft — passa RPE a Claude come contesto, non modifica il JSON del piano
- **Trigger Claude:** RPE ≥ 8 su workout completati triggerà Claude anche senza workout saltati
- **Hosting HTML:** GitHub Pages (repo pubblica); bot resta su Railway

---

## Supabase Schema

```sql
ALTER TABLE workout_log
  ADD COLUMN IF NOT EXISTS rpe INTEGER CHECK (rpe BETWEEN 1 AND 10);
```

---

## Flusso Telegram

**Check serale — dopo "✅ Sì":**
```
Bot mostra keyboard RPE:
  Riga 1: [1] [2] [3] [4] [5]
  Riga 2: [6] [7] [8] [9] [10]
  Testo: "Come è andato? (RPE 1=facile … 10=massimo sforzo)"

Callback rpe:{n}:{date}:{workout_key}:
  → UPDATE workout_log SET rpe=N WHERE date=... AND workout_key=...
  → Bot risponde: "✅ Fatto — RPE N/10 📊"
```

---

## HTML

**Dopo click "Fatto":**
```
Selettore inline con legenda:
  "1 facile          10 difficile"
  [1][2][3][4][5][6][7][8][9][10]

Click su un numero → saveRpe() → UPDATE Supabase → mostra "RPE N/10"
```

**Al reload della pagina:** `renderCalendar` legge `rpe` dalla cache Supabase e mostra "RPE N/10" accanto al badge completato.

---

## Check Mattutino — Logica Claude

```python
# Nuovo trigger: RPE ≥ 8 anche se nessun workout saltato
high_rpe_rows = [r for r in yesterday_logs if r['status'] == 'done' and r['rpe'] >= 8]

if not skipped and not high_rpe_rows:
    # Messaggio semplice senza Claude
    send_today_workout()
elif skipped:
    # Flusso esistente + contesto RPE
    call_claude_and_send_adaptation()
elif high_rpe_rows:
    # Nuovo: trigger solo per RPE alto
    call_claude_and_send_adaptation()
```

**Contesto Claude aggiuntivo:**
```python
{
    "done_workouts": [{"tipo": ..., "descrizione": ..., "rpe": N}],
    "high_rpe_trigger": True/False,
    # ... campi esistenti
}
```

**System prompt aggiunto:**
```
RPE (Rate of Perceived Exertion) 1-10: scala di sforzo percepito.
Se l'atleta ha completato gli allenamenti con RPE ≥ 8, prioritizza il recupero attivo nel giorno successivo.
Se RPE ≤ 4, l'allenamento era sottotono: puoi suggerire di mantenere o aumentare leggermente il carico.
```

**Messaggio mattutino — high-RPE senza skip:**
```
☀️ Buongiorno!

📊 Ieri RPE alto: _Corsa Lv7 RPE 9_
📋 Claude propone: [adattamento]

💪 Oggi: [workout del giorno]
```

---

## GitHub Pages

Nessun file aggiuntivo necessario — la struttura del repo è già compatibile.

Setup (una tantum):
1. Push repo su GitHub
2. Settings → Pages → branch main, folder `/`
3. URL: `https://USERNAME.github.io/weekly-workout/piano_allenamento.html`

Il `fetch('./data/plan_apr2026.json')` usa path relativo → funziona su GitHub Pages.

---

## File Modificati

| File | Modifica |
|---|---|
| `docs/supabase/schema.sql` | `ALTER TABLE` per colonna `rpe` |
| `bot/main.py` | `handle_done` → RPE keyboard; nuovo `handle_rpe`; `morning_check` trigger RPE ≥ 8 |
| `bot/claude_adapter.py` | Contesto `done_workouts` + `high_rpe_trigger`; system prompt RPE |
| `piano_allenamento.html` | `loadWorkoutLog` include `rpe`; `markAsDone` mostra picker; `renderCalendar` mostra RPE; `saveRpe()` |
| `tests/test_claude_adapter.py` | Test high-RPE fallback |
| `CLAUDE.md` | Documentazione GitHub Pages + sezione RPE |
