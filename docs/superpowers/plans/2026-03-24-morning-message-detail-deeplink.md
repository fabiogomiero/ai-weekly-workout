# Morning Message Detail + Deep-link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere il dettaglio del workout nel messaggio mattutino di Telegram e un deep-link anchor alla data odierna nella pagina GitHub Pages.

**Architecture:** Due modifiche indipendenti coordinate: (A) il bot legge `body` già presente nel dict di ogni workout e lo mostra strippato da HTML nel messaggio; (B) il bot appende `#YYYY-MM-DD` all'URL e il frontend usa quell'anchor per auto-selezionare la settimana corretta e scrollare al giorno.

**Tech Stack:** Python 3.12 (bot), Vanilla JS (frontend), pytest (test bot), git + gh CLI (branch + PR)

---

## File map

| File | Tipo | Modifiche |
|------|------|-----------|
| `bot/main.py` | Modifica | Aggiunge `strip_html()`, `fmt_workout()`, anchor nell'URL |
| `assets/app.js` | Modifica | `getTodayStr()`, fix `isToday`, `id` su cal-day, auto-select week + scroll |
| `tests/test_main_helpers.py` | Crea | Unit test per `strip_html()` e `fmt_workout()` |

---

## Task 0: Crea branch feature

- [ ] **Crea ed entra nel branch**

```bash
cd c:/Users/fgomi/Works/projects/personal/weekly-workout
git checkout develop && git pull origin develop
git checkout -b feature/morning-detail-deeplink
```

---

## Task 1: `strip_html()` in `bot/main.py`

**Files:**
- Modifica: `bot/main.py` (in cima al file, dopo gli import)
- Crea: `tests/test_main_helpers.py`

- [ ] **Step 1: Scrivi il test failing**

Crea `tests/test_main_helpers.py`:

```python
# tests/test_main_helpers.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / 'bot'))

from main import strip_html


def test_strip_html_removes_strong():
    assert strip_html('<strong>Testo</strong> normale') == 'Testo normale'

def test_strip_html_converts_br_to_newline():
    assert strip_html('Prima riga<br>Seconda riga') == 'Prima riga\nSeconda riga'
    assert strip_html('Prima riga<br/>Seconda riga') == 'Prima riga\nSeconda riga'

def test_strip_html_escapes_markdown_chars():
    assert strip_html('3x_12 squat') == '3x\\_12 squat'
    assert strip_html('**bold**') == '\\*\\*bold\\*\\*'

def test_strip_html_empty():
    assert strip_html('') == ''

def test_strip_html_no_html():
    assert strip_html('Testo semplice') == 'Testo semplice'
```

- [ ] **Step 2: Verifica che il test fallisca**

```bash
cd c:/Users/fgomi/Works/projects/personal/weekly-workout
python -m pytest tests/test_main_helpers.py -v
```

Atteso: `ImportError: cannot import name 'strip_html' from 'main'`

- [ ] **Step 3: Aggiungi `import re` e `strip_html()` in `bot/main.py`**

Aggiungi `import re` tra gli import esistenti, poi aggiungi la funzione dopo gli import e prima del blocco `# ── EVENING CHECK`:

```python
def strip_html(html: str) -> str:
    """Rimuove tag HTML e sanifica caratteri Markdown V1."""
    text = re.sub(r'<br\s*/?>', '\n', html)
    text = re.sub(r'<[^>]+>', '', text).strip()
    text = text.replace('_', '\\_').replace('*', '\\*')
    return text
```

- [ ] **Step 4: Verifica che i test passino**

```bash
python -m pytest tests/test_main_helpers.py -v
```

Atteso: 5 test PASSED

- [ ] **Step 5: Commit**

```bash
git add bot/main.py tests/test_main_helpers.py
git commit -m "feat: add strip_html helper for telegram message formatting"
```

---

## Task 2: `fmt_workout()` e aggiornamento `today_txt`

**Files:**
- Modifica: `bot/main.py` — aggiunge `fmt_workout()` e aggiorna la costruzione di `today_txt` (riga ~98)
- Modifica: `tests/test_main_helpers.py` — aggiunge test per `fmt_workout()`

- [ ] **Step 1: Scrivi il test failing**

Aggiungi in `tests/test_main_helpers.py`:

```python
from main import strip_html, fmt_workout


def test_fmt_workout_with_body():
    w = {'title': 'Corsa Lv 7', 'body': "<strong>5' camminando</strong> + 25' corsa"}
    result = fmt_workout(w)
    # strip_html rimuove <strong>, non tocca apostrofi; nessun _ o * nel testo → nessun escape
    assert result == "• Corsa Lv 7\n  _5' camminando + 25' corsa_"

def test_fmt_workout_without_body():
    w = {'title': 'Riposo attivo', 'body': ''}
    assert fmt_workout(w) == '• Riposo attivo'

def test_fmt_workout_body_with_br():
    w = {'title': 'Mobilità', 'body': 'Riga 1<br>Riga 2'}
    result = fmt_workout(w)
    assert '• Mobilità\n  _Riga 1\nRiga 2_' == result
```

- [ ] **Step 2: Verifica che il test fallisca**

```bash
python -m pytest tests/test_main_helpers.py::test_fmt_workout_with_body -v
```

Atteso: `ImportError: cannot import name 'fmt_workout'`

- [ ] **Step 3: Aggiungi `fmt_workout()` in `bot/main.py`** (subito dopo `strip_html`):

```python
def fmt_workout(w: dict) -> str:
    """Formatta un workout per il messaggio Telegram: titolo + body opzionale."""
    body = strip_html(w.get('body', ''))
    return f"• {w['title']}" + (f"\n  _{body}_" if body else "")
```

- [ ] **Step 4: Verifica che i test passino**

```bash
python -m pytest tests/test_main_helpers.py -v
```

Atteso: tutti i test PASSED

- [ ] **Step 5: Aggiorna la costruzione di `today_txt` in `morning_check()`**

**Occorrenza** (riga ~98, ramo `else` del `is_rest_day`):
```python
# Prima:
today_txt = "💪 *Oggi:*\n" + '\n'.join(f"• {w['title']}" for w in today_workouts)

# Dopo:
today_txt = "💪 *Oggi:*\n" + '\n'.join(fmt_workout(w) for w in today_workouts)
```

**Occorrenza 2** — NON esiste una seconda costruzione separata: la variabile `today_txt` è costruita una volta sola (riga ~98) e poi riusata nei vari `send_message`. La riga ~185 (`today_txt = f"💪 *Oggi (adattato):* {today_override}"`) è l'override Claude — lasciala invariata.

- [ ] **Step 6: Test di regressione completo**

```bash
python -m pytest tests/ -v
```

Atteso: tutti i test esistenti PASSED + nuovi test PASSED

- [ ] **Step 7: Commit**

```bash
git add bot/main.py tests/test_main_helpers.py
git commit -m "feat: show workout body detail in morning telegram message"
```

---

## Task 3: URL con anchor `#YYYY-MM-DD` nel bot

**Files:**
- Modifica: `bot/main.py` — aggiorna i 4 `send_message` che usano `PAGE_URL`

- [ ] **Step 1: Individua le occorrenze di `PAGE_URL`**

In `morning_check()` `PAGE_URL` appare in 3 `send_message` diretti (righe ~103, ~116, ~135) e in 1 f-string assemblata nella variabile `msg` (riga ~192). Tutte e 4 devono usare `f"{PAGE_URL}#{today.isoformat()}"` invece di `PAGE_URL`.

Cerca:
```bash
grep -n "PAGE_URL" bot/main.py
```

- [ ] **Step 2: Sostituisci `PAGE_URL` con anchor nelle 4 occorrenze**

In ognuna delle 4 send_message sostituisci `{PAGE_URL}` con `{PAGE_URL}#{today.isoformat()}` nel testo del messaggio.

Esempio (riga ~103):
```python
# Prima:
await context.bot.send_message(chat_id=CHAT_ID, text=f"☀️ Buongiorno!\n\n{today_txt}\n\n🔗 {PAGE_URL}", parse_mode='Markdown')

# Dopo:
await context.bot.send_message(chat_id=CHAT_ID, text=f"☀️ Buongiorno!\n\n{today_txt}\n\n🔗 {PAGE_URL}#{today.isoformat()}", parse_mode='Markdown')
```

Idem per le righe ~116, ~135, ~192-193.

- [ ] **Step 3: Test di regressione**

```bash
python -m pytest tests/ -v
```

Atteso: tutti i test PASSED

- [ ] **Step 4: Commit**

```bash
git add bot/main.py
git commit -m "feat: append #YYYY-MM-DD anchor to morning telegram link"
```

---

## Task 4: Frontend — `getTodayStr()`, fix `isToday`, `id` su cal-day

**Files:**
- Modifica: `assets/app.js` — funzione `renderCalendar()`

- [ ] **Step 1: Aggiungi `getTodayStr()` come funzione module-level**

In `assets/app.js`, aggiungi subito dopo le dichiarazioni `let` iniziali (riga ~33):

```js
/** Restituisce 'YYYY-MM-DD' nella timezone locale del browser */
const getTodayStr = () => new Date().toLocaleDateString('sv-SE');
```

- [ ] **Step 2: Aggiorna `renderCalendar()` — fix `isToday` e aggiungi `id`**

In `renderCalendar()`, nella funzione `map` di `w.days`, individua la riga che costruisce `cls` (attuale):

```js
const cls = ['cal-day', isRest ? 'rest' : '', day.today ? 'today' : '', day.alt ? 'alt' : ''].filter(Boolean).join(' ');
```

Sostituisci con:

```js
const isToday = day.isoDate === getTodayStr();
const cls = ['cal-day', isRest ? 'rest' : '', isToday ? 'today' : '', day.alt ? 'alt' : ''].filter(Boolean).join(' ');
```

Poi, nel template string del div `.cal-day`, aggiungi l'attributo `id`. Trova il tag di apertura del div (contiene `class="${cls}"`) e aggiungi `id="${day.isoDate || ''}"`:

```js
// Prima (esempio):
`<div class="${cls}" onclick="...">

// Dopo:
`<div id="${day.isoDate || ''}" class="${cls}" onclick="...">
```

- [ ] **Step 3: Verifica visiva manuale**

Avvia un server locale:
```bash
cd c:/Users/fgomi/Works/projects/personal/weekly-workout
python -m http.server 8080
```

Apri `http://localhost:8080/` nel browser. Verifica:
- Il giorno odierno (24 marzo 2026) ha una classe visiva diversa (`.today`)
- Apri DevTools → Inspector → trova il div del giorno odierno → deve avere `id="2026-03-24"`

- [ ] **Step 4: Commit**

```bash
git add assets/app.js
git commit -m "feat: fix today highlight and add id to calendar day cells"
```

---

## Task 5: Frontend — auto-select settimana corrente + scroll anchor

**Files:**
- Modifica: `assets/app.js` — fine di `initApp()`

- [ ] **Step 1: Individua le ultime 3 righe di `initApp()`**

In `assets/app.js`, l'ultima parte di `initApp()` (prima della `}` di chiusura) è:

```js
updateCountdown();
renderWeekTabs();
renderCalendar();
```

- [ ] **Step 2: Sostituisci le ultime 3 righe con il blocco auto-select + scroll**

```js
updateCountdown();

// Auto-select la settimana che contiene oggi
const todayStr = getTodayStr();
const weeks = weeksForPiano(currentPiano);
const todayWeekIdx = weeks.findIndex(w => w.days?.some(d => d.isoDate === todayStr));
if (todayWeekIdx >= 0) {
  currentWeekIdx = todayWeekIdx;
}

renderWeekTabs();
renderCalendar();

// Scroll all'anchor se presente nel URL (es. #2026-03-24 dal link Telegram)
if (location.hash) {
  const el = document.querySelector(location.hash);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

- [ ] **Step 3: Verifica manuale — auto-select settimana**

Con il server locale attivo (`http://localhost:8080/`):
- Apri la pagina senza hash → deve mostrare direttamente la settimana corrente (non la settimana 1)
- Il tab della settimana corrente deve essere evidenziato come attivo

- [ ] **Step 4: Verifica manuale — deep-link anchor**

Apri `http://localhost:8080/#2026-03-24`:
- La pagina deve caricarsi sulla settimana corrente
- La pagina deve scrollare automaticamente al giorno 2026-03-24
- Il giorno deve avere la classe `.today` visiva

- [ ] **Step 5: Commit**

```bash
git add assets/app.js
git commit -m "feat: auto-select current week and scroll to anchor on page load"
```

---

## Task 6: Commit spec + plan e PR finale

- [ ] **Step 1: Aggiungi spec e plan al commit**

```bash
git add docs/superpowers/specs/2026-03-24-morning-message-detail-deeplink-design.md
git add docs/superpowers/plans/2026-03-24-morning-message-detail-deeplink.md
git commit -m "docs: add spec and plan for morning message detail + deeplink"
```

- [ ] **Step 2: Push del branch**

```bash
git push -u origin feature/morning-detail-deeplink
```

- [ ] **Step 3: Apri la PR verso `develop`**

```bash
gh pr create \
  --base develop \
  --title "feature: workout detail in morning message + deep-link to today" \
  --body "$(cat <<'EOF'
## Summary
- Aggiunto dettaglio completo del workout (body strippato da HTML) nel messaggio mattutino di Telegram
- URL nel messaggio ora include anchor `#YYYY-MM-DD` per portare direttamente al giorno odierno
- Frontend: fix del bug `day.today` mai applicato, auto-select settimana corrente, scroll all'anchor
- Aggiunto `id=\"YYYY-MM-DD\"` su ogni cella del calendario per il deep-link

## Files changed
- `bot/main.py` — `strip_html()`, `fmt_workout()`, URL con anchor
- `assets/app.js` — `getTodayStr()`, fix `isToday`, `id` cal-day, auto-select + scroll
- `tests/test_main_helpers.py` — unit test per le nuove funzioni

## Test
```bash
python -m pytest tests/ -v
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
