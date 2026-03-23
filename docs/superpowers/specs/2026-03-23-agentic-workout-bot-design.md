# Design: Agentic Workout Bot + HTML Enhancement

**Date:** 2026-03-23
**Status:** Approved (v2 — post spec review)

## Context

`piano_allenamento.html` è un'app client-side per il piano di allenamento verso la gara 10km del 26 Aprile 2026 (obiettivo primario) e per lo sviluppo di forza/resistenza gambe con metodo Resistenza Verticale + arrampicata boulder/indoor (obiettivo secondario).

L'app va resa "agentica": ogni mattina alle 7:00 deve controllare se l'allenamento del giorno precedente è stato fatto, e in caso contrario chiamare Claude API per proporre un adattamento del piano, inviando tutto via Telegram.

---

## Architettura

```
piano_allenamento.html  ←→  Supabase (REST API)  ←→  Python Bot (Railway)
        ↑                                                     │
  data/plan_apr2026.json  ←────────────────────────────────  │
  (fetch locale)                  Claude API ────────────────┘
                                  Telegram
```

**Componenti:**

| Componente | Tecnologia | Ruolo |
|---|---|---|
| `piano_allenamento.html` | Vanilla JS + Supabase JS SDK | UI + marca workout done |
| `data/plan_apr2026.json` | JSON statico | Fonte di verità del piano (HTML e bot) |
| `bot/main.py` | python-telegram-bot 20.x (async + JobQueue) | Bot Telegram + scheduler integrato |
| `bot/claude_adapter.py` | Anthropic Python SDK | Chiamata Claude API con error handling |
| `bot/config.py` | env vars | TELEGRAM_TOKEN, SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY, CHAT_ID |
| Supabase | PostgreSQL managed | Persistenza stato workout |
| Railway | PaaS | Hosting bot 24/7 |

### Decisione chiave: `data/plan_apr2026.json`

I dati workout (`DETAILS`, `WEEKS`) vengono estratti dall'HTML in un file JSON separato:
```
data/
  plan_apr2026.json   # Piano completo: weeks, workout_keys, descrizioni, tipo, livello
```

L'HTML usa `fetch('./data/plan_apr2026.json')` invece degli oggetti inline.
Il bot carica lo stesso file all'avvio (`json.load`).
Questo garantisce che bot e HTML abbiano sempre lo stesso piano senza duplicazione.

---

## Supabase Schema

```sql
-- Tabella principale
CREATE TABLE workout_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  workout_key   TEXT NOT NULL,
  status        TEXT CHECK (status IN ('done', 'skipped')),  -- nullable: NULL = check serale inviato ma senza risposta ancora
  reason        TEXT CHECK (reason IN ('tired', 'no_time') OR reason IS NULL),
  adapted_notes TEXT,
  evening_check_sent  BOOLEAN DEFAULT FALSE,  -- previene doppio invio serale
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX workout_log_date_key ON workout_log(date, workout_key);

-- Trigger per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workout_log_updated_at
  BEFORE UPDATE ON workout_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: abilita row-level security
ALTER TABLE workout_log ENABLE ROW LEVEL SECURITY;

-- Policy: chiunque con la anon key può leggere, inserire, aggiornare
-- (app personale, protezione basata su anon key non divulgata)
CREATE POLICY "allow_all_authenticated" ON workout_log
  FOR ALL USING (true) WITH CHECK (true);
```

**Nota sicurezza:** La `anon key` Supabase sarà visibile nel sorgente HTML (app personale su browser locale). La RLS limita l'accesso al solo progetto associato a quella key. Accettabile per uso personale.

---

## Logica "nessuna risposta serale"

**Non esiste uno stato `pending`.** La logica è:

```python
# Morning check: cerca riga per ieri
row = supabase.select where date = yesterday

if row is None:
    # Nessuna risposta al check serale → beneficio del dubbio → trattato come 'done'
    send_today_workout()
elif row.status == 'done':
    send_today_workout()
elif row.status == 'skipped':
    call_claude_and_send_adaptation()
```

Lo `status` in Supabase è solo `'done'` o `'skipped'`. `NULL` (assenza di riga) = beneficio del dubbio.

---

## Flusso Bot

### Setup iniziale (una tantum)

```
1. Crea bot su @BotFather → ottieni TELEGRAM_TOKEN
2. Manda /start al bot
3. Chiama: GET https://api.telegram.org/bot{TOKEN}/getUpdates
4. Leggi il campo message.from.id → è il tuo CHAT_ID
5. Salva CHAT_ID in Railway env vars
```

### Scheduler (python-telegram-bot JobQueue — no APScheduler esterno)

```python
# In main.py - usa il JobQueue integrato in python-telegram-bot (async nativo)
application.job_queue.run_daily(
    evening_check,
    time=datetime.time(22, 0, tzinfo=ZoneInfo("Europe/Rome"))  # 22:00 CET/CEST auto
)
application.job_queue.run_daily(
    morning_check,
    time=datetime.time(7, 0, tzinfo=ZoneInfo("Europe/Rome"))   # 07:00 CET/CEST auto
)
```

**Timezone:** Sempre `ZoneInfo("Europe/Rome")` — gestisce automaticamente CET (UTC+1) e CEST (UTC+2).
Dipendenza aggiuntiva: `tzdata` (necessario su Railway/Linux).

### Check Serale (22:00 CET/CEST)

```
Bot carica plan_apr2026.json
Determina workout di oggi (data → lista workout_key)
Se oggi è giorno di riposo → nessun messaggio

Per ogni workout_key di oggi:
  Controlla su Supabase: esiste riga con date=oggi AND workout_key=key AND evening_check_sent=TRUE?
    └── Sì → già inviato per questa key (prevenzione doppio invio dopo restart) → skip questa key

  Upsert riga {date: oggi, workout_key: key, evening_check_sent: TRUE}  -- status rimane NULL
  Invia Telegram: "Hai fatto [nome workout]? — [descrizione breve]"
                  [✅ Sì] [❌ No]
```

**Giorni con più workout:** il loop invia un messaggio separato per ogni workout_key, con il check anti-doppio per singola (date, workout_key).

**Callback ✅ Sì:**
```
Upsert Supabase: {date, workout_key, status: 'done'}
Bot risponde: "Ottimo! 💪"
```

**Callback ❌ No:**
```
Bot chiede: "Perché hai saltato?"
            [😴 Ero stanco] [⏰ Non ho avuto tempo]
```

**Callback 😴 Stanco:**
```
Upsert Supabase: {date, workout_key, status: 'skipped', reason: 'tired'}
Bot risponde: "Ok, il recupero è parte dell'allenamento. 🛌"
```

**Callback ⏰ No time:**
```
Upsert Supabase: {date, workout_key, status: 'skipped', reason: 'no_time'}
Bot risponde: "Capito, vediamo domani come recuperare. 📅"
```

### Check Mattutino (07:00 CET/CEST)

```
Bot carica plan_apr2026.json
Determina workout di ieri e di oggi

Legge Supabase: tutte le righe con date = ieri

Se nessuna riga ieri (o tutte done) → invia solo workout di oggi:
  "☀️ Buongiorno!\n💪 Oggi: [workout del giorno]"

Se almeno una riga skipped → chiama claude_adapter.propose_adaptation():
  contesto = {
    "skipped_workouts": [{tipo, descrizione, livello, reason}],
    "today_workouts": [{tipo, descrizione}],
    "week_number": N,
    "week_focus": "...",
    "days_to_race": (date(2026, 4, 26) - date.today()).days,  # costante nel bot
    "primary_goal": "Gara 10km 26 Aprile 2026",
    "secondary_goal": "Forza gambe (Resistenza Verticale) + arrampicata"
  }

  Claude risponde JSON:
  {
    "adaptation": "testo proposta (max 3 righe)",
    "today_modified": false,
    "today_override": ""   // ignorato se today_modified=false
  }

  Salva adaptation in Supabase: {adapted_notes: adaptation}

  Bot manda:
  "⚠️ Ieri hai saltato [workout] ([motivo]).\n
   📋 Claude propone: [adaptation]\n\n
   💪 Oggi: [today_workout o today_override se today_modified=true]"
```

---

## Claude API — Design

### System Prompt

```
Sei un coach di corsa e forza specializzato.
Obiettivo primario dell'atleta: correre 10km il 26 Aprile 2026.
Obiettivo secondario: aumentare forza e resistenza gambe (metodo Resistenza Verticale) + arrampicata boulder/indoor.
Quando proponi adattamenti, prioritizza sempre il recupero per la gara.
Se il motivo è stanchezza fisica, proponi riposo attivo o riduzione del volume.
Se il motivo è mancanza di tempo, proponi come recuperare il workout saltato.
Rispondi SOLO in italiano. Rispondi SOLO con JSON valido nel formato specificato. Nessun testo fuori dal JSON.
```

### User Prompt (template Python)

```python
f"""
Ieri l'atleta ha saltato:
{chr(10).join(f'- {w["tipo"]}: {w["descrizione"]} (motivo: {"stanchezza fisica" if w["reason"]=="tired" else "mancanza di tempo"})' for w in skipped_workouts)}

Settimana corrente: Settimana {week_number} — {week_focus}
Giorni alla gara 10km: {days_to_race}

Allenamento previsto oggi:
{chr(10).join(f'- {w["tipo"]}: {w["descrizione"]}' for w in today_workouts)}

Proponi un adattamento considerando il motivo del salto.
Formato risposta JSON esatto:
{{"adaptation": "...", "today_modified": false, "today_override": ""}}
"""
```

### Error Handling in `claude_adapter.py`

```python
try:
    response = client.messages.create(...)
    data = json.loads(response.content[0].text)
    # Validazione campi obbligatori
    assert "adaptation" in data
    assert "today_modified" in data
    today_override = data.get("today_override", "") if data["today_modified"] else ""
    return data["adaptation"], data["today_modified"], today_override
except (json.JSONDecodeError, AssertionError, KeyError):
    return "Continua con il piano previsto. 💪", False, ""
except anthropic.APIError:
    return "Impossibile contattare Claude. Continua con il piano previsto.", False, ""
```

---

## Modifiche HTML

### Bug Fix WEEKS

1. **Settimana 5**: `'Sab 26/4 🏁'` → `'Dom 26/4 🏁'` (26 aprile 2026 è **domenica**)
2. **Settimana 5**: rimuovere l'8° giorno vuoto `{ date: '', badges: [], rest: true }` (già `cols: 7`, solo il giorno va rimosso)
3. **Settimana 1**: `cols: 8` è intenzionale (settimana parziale con giorni alternativi) — non modificare

### Estrazione dati in `data/plan_apr2026.json`

Estrarre `WEEKS`, `DETAILS`, `PIANI` in un file JSON e caricarli via `fetch`:
```js
const plan = await fetch('./data/plan_apr2026.json').then(r => r.json())
const { WEEKS, DETAILS, PIANI } = plan
```

`ESERCIZI` può rimanere inline nell'HTML (non usato dal bot).
`PIANI` viene estratto nel JSON per completezza ma è usato solo dall'HTML (sezione "Storico piani"), non dal bot.

### Integrazione Supabase (Supabase JS SDK via CDN)

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

```js
const SUPABASE_URL = 'https://xxx.supabase.co'   // config costanti in cima al file
const SUPABASE_ANON_KEY = 'eyJ...'
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

**Al load:**
```js
const { data: logs } = await supabase.from('workout_log').select('date,workout_key,status,reason')
// Applica .done-day / .skipped-day ai badge corrispondenti
```

**Pulsante "Fatto":**
- Visibile su ogni giorno con workout (passato e corrente), non sui giorni di riposo
- Testo: "✓ Fatto" → dopo click → "✓ Completato" (non cliccabile)
- Se `status = 'skipped'` (segnato via Telegram): mostra "↩ Recuperato" (cliccabile → upsert `done`)
- Upsert con conflict target `(date, workout_key)`:
```js
await supabase.from('workout_log').upsert(
  { date, workout_key, status: 'done' },
  { onConflict: 'date,workout_key' }
)
```

**Stili aggiuntivi (minimal, non invasivi):**
- `.done-day`: badge con bordo verde + "✓"
- `.skipped-day`: badge con bordo arancione + "✗"
- `.btn-fatto`: bottone piccolo sotto il badge

---

## File da Creare/Modificare

| File | Azione |
|---|---|
| `piano_allenamento.html` | Modifica: bug fix WEEKS, fetch plan JSON, integrazione Supabase, pulsanti Fatto |
| `data/plan_apr2026.json` | **Crea**: estrai WEEKS + DETAILS + PIANI dall'HTML |
| `bot/main.py` | **Crea**: bot Telegram + JobQueue scheduler |
| `bot/claude_adapter.py` | **Crea**: wrapper Claude API con error handling |
| `bot/config.py` | **Crea**: configurazione da env vars |
| `bot/requirements.txt` | **Crea**: dipendenze Python con versioni constrainted |
| `bot/railway.toml` | **Crea**: configurazione deploy |
| `bot/.env.example` | **Crea**: template variabili d'ambiente |
| `CLAUDE.md` | **Crea**: documentazione progetto |
| `docs/supabase/schema.sql` | **Crea**: SQL completo per setup Supabase |

### `bot/requirements.txt`

```
python-telegram-bot>=20.0,<21.0
anthropic>=0.25,<1.0
supabase>=2.0,<3.0
python-dotenv>=1.0,<2.0
tzdata>=2024.1
```

### `bot/railway.toml`

```toml
[build]
builder = "nixpacks"

[deploy]
# Railway esegue da root del repo; "python bot/main.py" è relativo alla root
startCommand = "python bot/main.py"
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 3
```

### `bot/.env.example`

```
TELEGRAM_TOKEN=your_bot_token_here
CHAT_ID=your_chat_id_here
SUPABASE_URL=https://xxx.supabase.co
# Usa la SERVICE ROLE key (non la anon key) per il bot — bypassa RLS lato server
# La anon key va usata solo nell'HTML (browser)
SUPABASE_KEY=your_service_role_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

---

## Verifica End-to-End

1. **Setup Supabase:** esegui `docs/supabase/schema.sql` → verifica tabella e RLS
2. **Setup bot locale:**
   ```bash
   cp bot/.env.example bot/.env  # compila le variabili
   # Manda /start al bot su Telegram
   # curl "https://api.telegram.org/bot{TOKEN}/getUpdates" → copia chat_id
   python bot/main.py
   ```
3. **Test check serale manuale:** aggiungi comando `/test_evening` nel bot → simula invio messaggio serale → clicca Sì/No su Telegram → verifica riga su Supabase
4. **Test check mattutino manuale:** comando `/test_morning` → verifica messaggio ricevuto (con o senza adattamento Claude)
5. **Test HTML:** apri `piano_allenamento.html` → verifica tabella 7 colonne uniformi → verifica "Dom 26/4 🏁" → clicca "Fatto" su un giorno → verifica record Supabase → ricarica pagina → verifica badge `.done-day`
6. **Railway deploy:** push repo su GitHub → connetti a Railway → imposta env vars → verifica deploy attivo → aspetta 22:00 per check serale reale
7. **Ciclo completo:** check serale (22:00) → rispondi "No" + "Stanco" → check mattutino (7:00) → verifica messaggio adattamento Claude
