# weekly-workout

Piano di allenamento settimanale per la gara 10km del 26 Aprile 2026.

## Obiettivi
- **Primario:** Gara 10km — 26 Aprile 2026
- **Secondario:** Forza e resistenza gambe (metodo Resistenza Verticale) + arrampicata boulder e indoor

## Stack
- `index.html` — UI single-page (GitHub Pages: https://USERNAME.github.io/weekly-workout/)
- `data/plan_apr2026.json` — Piano completo: WEEKS, DETAILS, PIANI (fonte di verità condivisa con il bot)
- `bot/` — Telegram bot Python (Railway) con Claude API per adattamento piano
- Supabase — Persistenza stato workout completati
- Railway — Hosting bot 24/7

## Regole importanti
- **Non modificare i piani di allenamento** in `data/plan_apr2026.json` senza una ragione esplicita dell'utente
- L'HTML carica i dati via `fetch('./data/plan_apr2026.json')` all'avvio — qualsiasi modifica al piano va fatta nel JSON, non nell'HTML
- Il bot usa la **service role key** Supabase (env var `SUPABASE_KEY`); l'HTML usa la **anon key**
- Il bot usa **JobQueue integrato** di python-telegram-bot (non APScheduler esterno)
- Il timezone è sempre `ZoneInfo("Europe/Rome")` (gestisce CET/CEST automaticamente)

## File critici
- `index.html` — UI + Supabase integration (i dati ora vengono da `data/plan_apr2026.json` via fetch)
- `index.html` — funzione `renderCalendar()` — logica rendering calendario con stato done/skipped
- `bot/main.py` — entry point bot + scheduler (22:00 check serale, 07:00 check mattutino)
- `bot/claude_adapter.py` — chiamata Claude API con fallback su errore
- `bot/schedule_logic.py` — determina se oggi è giorno di allenamento e quale workout

## Variabili d'ambiente necessarie (Railway)
- `TELEGRAM_TOKEN` — token @BotFather
- `CHAT_ID` — ID chat personale (ottenuto via getUpdates dopo /start)
- `SUPABASE_URL` — URL progetto Supabase
- `SUPABASE_KEY` — service role key Supabase (bot)
- `ANTHROPIC_API_KEY` — API key Anthropic

## Variabili d'ambiente HTML (iniettate da GitHub Actions)
`assets/app.js` contiene placeholder `__SUPABASE_URL__` e `__SUPABASE_ANON_KEY__` che vengono sostituiti dal workflow `.github/workflows/deploy.yml` prima del deploy su `gh-pages`.

## Sviluppo locale (con Supabase configurato)
Dopo aver clonato il repo, `assets/app.js` ha i placeholder.
Per sviluppo locale:
1. Sostituisci manualmente `__SUPABASE_URL__` e `__SUPABASE_ANON_KEY__` in `assets/app.js` con i valori reali
2. Esegui `git update-index --skip-worktree assets/app.js` per evitare commit accidentali
3. NON fare commit di `assets/app.js` con le chiavi reali — il deploy avviene via GitHub Actions

## Setup Supabase (prima esecuzione)
1. Crea progetto su supabase.com
2. Esegui `docs/supabase/schema.sql` nell'editor SQL Supabase
3. Copia URL e keys dalla sezione Settings → API

## Setup Railway (prima esecuzione)
1. Push repo su GitHub
2. Connetti Railway a repo GitHub
3. Imposta env vars in Railway dashboard
4. Per ottenere CHAT_ID: manda /start al bot → `curl "https://api.telegram.org/bot{TOKEN}/getUpdates"` → leggi `message.from.id`

## RPE (Rate of Perceived Exertion)
- Scala 1-10: 1=facile, 10=massimo sforzo
- Inserito via Telegram (dopo ✅ Sì al check serale) o via HTML (selettore dopo "Fatto")
- Claude usa RPE come contesto nel check mattutino
- RPE ≥ 8 triggerà Claude anche se non ci sono workout saltati
