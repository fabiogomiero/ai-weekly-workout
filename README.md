# ai-weekly-workout

Piano di allenamento settimanale verso la gara 10km del 26 Aprile 2026,
con bot Telegram per check giornalieri e adattamento del piano via Claude AI.

## Stack

| Componente | Tecnologia | Ruolo |
|---|---|---|
| `piano_allenamento.html` | Vanilla JS + Supabase JS SDK | UI calendario + log workout |
| `assets/app.js` / `assets/style.css` | JS / CSS | Frontend logic e stili |
| `data/plan_apr2026.json` | JSON statico | Piano allenamento (fonte di verità) |
| `bot/` | Python + python-telegram-bot | Bot Telegram + scheduler |
| Supabase | PostgreSQL managed | Persistenza stato workout e RPE |
| Railway | PaaS | Hosting bot 24/7 |
| GitHub Pages | Static hosting | Hosting pagina HTML |

## Requisiti

- Python 3.12+
- Account: Supabase, Railway, Telegram (BotFather), Anthropic

## Setup

### 1. Supabase
1. Crea progetto su supabase.com
2. Esegui `docs/supabase/schema.sql` nell'editor SQL
3. Copia **URL**, **anon key** e **service role key** da Settings → API

### 2. Telegram Bot
1. Crea bot su `@BotFather` → `/newbot` → copia il TOKEN
2. Manda `/start` al bot
3. Ottieni CHAT_ID:
   ```bash
   curl "https://api.telegram.org/bot{TOKEN}/getUpdates"
   # Leggi: result[0].message.from.id
   ```

### 3. GitHub Pages
1. Push su GitHub
2. Settings → Secrets → Actions → aggiungi `SUPABASE_URL` e `SUPABASE_ANON_KEY`
3. Settings → Pages → Branch: `gh-pages`
4. Il workflow `.github/workflows/deploy.yml` si attiva ad ogni push su `master`

### 4. Railway (bot 24/7)
1. New Project → Deploy from GitHub repo
2. Variables → aggiungi:
   - `TELEGRAM_TOKEN`
   - `CHAT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_KEY` ← service role key (non anon key!)
   - `ANTHROPIC_API_KEY`

### 5. Sviluppo locale

```bash
python -m venv bot/.venv

# Windows:
bot\.venv\Scripts\Activate.ps1
# macOS/Linux:
source bot/.venv/bin/activate

pip install -r bot/requirements.txt
cp bot/.env.example bot/.env   # compila con i valori reali
```

Per usare la pagina HTML localmente con Supabase reale:
```bash
# Sostituisci __SUPABASE_URL__ e __SUPABASE_ANON_KEY__ in assets/app.js
git update-index --skip-worktree assets/app.js   # evita commit accidentali
python -m http.server 8080
# Apri http://localhost:8080/piano_allenamento.html
```

## Test

```bash
pip install pytest
python -m pytest tests/ -v
# Output atteso: 12 passed
```

### Test manuale bot
Con il bot avviato (`python bot/main.py`):
- `/test_evening` → simula check serale (22:00)
- `/test_morning` → simula check mattutino (07:00)
