# Multi-piano con Lazy Loading Storico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere il piano Maggio–Giugno 2026 come piano corrente, mantenendo Aprile navigabile nello storico tramite lazy loading on demand.

**Architecture:** Un manifest `data/plans.json` elenca tutti i piani con i relativi file. All'avvio si carica solo il piano con `current: true`. Al click su un piano storico, `selectPiano` fa fetch del suo JSON e mergia `DETAILS`/`WEEKS` in memoria (cachando l'id in `LOADED_PLANS` per evitare fetch ripetute). Il bot legge il manifest per ricavare dinamicamente `PLAN_JSON_PATH` e `PLAN_GARA`.

**Tech Stack:** Vanilla JS (frontend), Python 3.11+ (bot), JSON (dati), GitHub Actions (deploy), Railway (bot hosting)

---

## File Map

| File | Azione | Responsabilità |
|------|--------|----------------|
| `data/plans.json` | Crea | Manifest di tutti i piani con file path e flag current |
| `bot/config.py` | Modifica | PLAN_JSON_PATH e PLAN_GARA da manifest; rimuovere RACE_DATE_STR |
| `bot/main.py` | Modifica | Importare PLAN_GARA; sostituire days_to_race e primary_goal hardcoded |
| `index.html` | Modifica | Aggiornare title, header, rimuovere prog-wrap, aggiornare istruzioni storico |
| `assets/app.js` | Modifica | initApp da manifest + piano corrente; selectPiano con lazy loading; rimuovere updateCountdown |

---

## Task 1: Crea il manifest `data/plans.json`

**Files:**
- Create: `data/plans.json`

- [ ] **Step 1: Crea il file manifest**

```json
[
  {
    "id": "apr2026",
    "label": "Piano Aprile 2026",
    "meta": "23 mar → 26 apr 2026",
    "gara": "10 km — 26 Aprile 2026",
    "current": false,
    "file": "plan_apr2026.json"
  },
  {
    "id": "maggiu2026",
    "label": "Piano Maggio–Giugno 2026",
    "meta": "27 apr → 28 giu 2026",
    "gara": "Alta Montagna Estate 2026",
    "current": true,
    "file": "plan_magglu2026.json"
  }
]
```

- [ ] **Step 2: Verifica che entrambi i file referenziati esistano**

```bash
ls data/plan_apr2026.json data/plan_magglu2026.json data/plans.json
```

Expected: tutti e tre i file listati senza errori.

- [ ] **Step 3: Commit**

```bash
git add data/plans.json
git commit -m "feat: add plans manifest with apr2026 and maggiu2026"
```

---

## Task 2: Aggiorna `bot/config.py`

**Files:**
- Modify: `bot/config.py`

- [ ] **Step 1: Sostituisci il contenuto di `bot/config.py`**

Sostituisci il blocco delle costanti piano (righe 14-16) con la lettura dinamica dal manifest:

```python
import os
from pathlib import Path
from dotenv import load_dotenv
import json

# Carica .env se esiste (sviluppo locale)
load_dotenv(Path(__file__).parent / '.env')

TELEGRAM_TOKEN = os.environ['TELEGRAM_TOKEN']
CHAT_ID = int(os.environ['CHAT_ID'])
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']  # service role key
ANTHROPIC_API_KEY = os.environ['ANTHROPIC_API_KEY']

# Piano corrente ricavato dal manifest
_manifest_path = Path(__file__).parent.parent / 'data' / 'plans.json'
_manifest = json.loads(_manifest_path.read_text(encoding='utf-8'))
_current = next(p for p in _manifest if p['current'])

PLAN_JSON_PATH = Path(__file__).parent.parent / 'data' / _current['file']
PLAN_GARA = _current['gara']

PAGE_URL = 'https://fabiogomiero.github.io/ai-weekly-workout/'
```

- [ ] **Step 2: Verifica che il modulo sia importabile**

Dalla directory `bot/`:

```bash
cd bot && python -c "from config import PLAN_JSON_PATH, PLAN_GARA, PAGE_URL; print(PLAN_JSON_PATH, PLAN_GARA)"
```

Expected output:
```
.../data/plan_magglu2026.json Alta Montagna Estate 2026
```

- [ ] **Step 3: Commit**

```bash
git add bot/config.py
git commit -m "feat: derive PLAN_JSON_PATH and PLAN_GARA from plans manifest"
```

---

## Task 3: Aggiorna `bot/main.py`

**Files:**
- Modify: `bot/main.py` (righe 15, 167-168, 244-245)

`RACE_DATE_STR` viene rimosso dall'import e sostituito con `PLAN_GARA`. `days_to_race` e `primary_goal` hardcoded vengono rimossi/sostituiti nei due dict `claude_context`.

- [ ] **Step 1: Aggiorna la riga di import da config (riga 14-16)**

Sostituisci:
```python
from config import (
    TELEGRAM_TOKEN, CHAT_ID, SUPABASE_URL, SUPABASE_KEY,
    ANTHROPIC_API_KEY, PLAN_JSON_PATH, RACE_DATE_STR, PAGE_URL
)
```
Con:
```python
from config import (
    TELEGRAM_TOKEN, CHAT_ID, SUPABASE_URL, SUPABASE_KEY,
    ANTHROPIC_API_KEY, PLAN_JSON_PATH, PLAN_GARA, PAGE_URL
)
```

- [ ] **Step 2: Aggiorna il primo `claude_context` (intorno a riga 162)**

Sostituisci:
```python
            claude_context = {
                'skipped_workouts': [],
                'today_workouts': [{'tipo': w['cls'].replace('b-','').capitalize(), 'descrizione': w['title']} for w in today_workouts],
                'week_number': week_num,
                'week_focus': week_ctx.get('note', ''),
                'days_to_race': (date.fromisoformat(RACE_DATE_STR) - today).days,
                'primary_goal': 'Gara 10km 26 Aprile 2026',
                'secondary_goal': 'Forza gambe (Resistenza Verticale) + arrampicata',
                'done_workouts': [],
                'high_rpe_trigger': False,
                'user_notes': [{'workout_key': 'rest', 'nota': rest_note}],
            }
```
Con:
```python
            claude_context = {
                'skipped_workouts': [],
                'today_workouts': [{'tipo': w['cls'].replace('b-','').capitalize(), 'descrizione': w['title']} for w in today_workouts],
                'week_number': week_num,
                'week_focus': week_ctx.get('note', ''),
                'obiettivo': PLAN_GARA,
                'secondary_goal': 'Forza gambe (Resistenza Verticale) + arrampicata',
                'done_workouts': [],
                'high_rpe_trigger': False,
                'user_notes': [{'workout_key': 'rest', 'nota': rest_note}],
            }
```

- [ ] **Step 3: Aggiorna il secondo `claude_context` (intorno a riga 239)**

Sostituisci:
```python
        claude_context = {
            'skipped_workouts': skipped_with_detail,
            'today_workouts': [{'tipo': w['cls'].replace('b-','').capitalize(), 'descrizione': w['title']} for w in today_workouts],
            'week_number': week_num,
            'week_focus': week_ctx.get('note', ''),
            'days_to_race': (date.fromisoformat(RACE_DATE_STR) - today).days,
            'primary_goal': 'Gara 10km 26 Aprile 2026',
            'secondary_goal': 'Forza gambe (Resistenza Verticale) + arrampicata',
            'done_workouts': done_with_rpe,
            'high_rpe_trigger': bool(high_rpe_rows),
            'user_notes': [
                {'workout_key': r['workout_key'], 'nota': r['user_note']}
                for r in note_rows if r.get('user_note')
            ],
        }
```
Con:
```python
        claude_context = {
            'skipped_workouts': skipped_with_detail,
            'today_workouts': [{'tipo': w['cls'].replace('b-','').capitalize(), 'descrizione': w['title']} for w in today_workouts],
            'week_number': week_num,
            'week_focus': week_ctx.get('note', ''),
            'obiettivo': PLAN_GARA,
            'secondary_goal': 'Forza gambe (Resistenza Verticale) + arrampicata',
            'done_workouts': done_with_rpe,
            'high_rpe_trigger': bool(high_rpe_rows),
            'user_notes': [
                {'workout_key': r['workout_key'], 'nota': r['user_note']}
                for r in note_rows if r.get('user_note')
            ],
        }
```

- [ ] **Step 4: Verifica che non rimangano riferimenti a RACE_DATE_STR**

```bash
grep -n "RACE_DATE_STR" bot/main.py bot/config.py
```

Expected: nessun output.

- [ ] **Step 5: Verifica che il bot sia sintatticamente valido**

```bash
cd bot && python -m py_compile main.py && echo "OK"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add bot/main.py
git commit -m "feat: replace days_to_race with obiettivo from PLAN_GARA in claude context"
```

---

## Task 4: Aggiorna `index.html`

**Files:**
- Modify: `index.html`

Tre interventi: aggiornare il `<title>`, sostituire il `.header-meta` hardcoded con un `#obiettivo` dinamico, rimuovere la `div.prog-wrap`, aggiornare le istruzioni dello storico.

- [ ] **Step 1: Aggiorna il `<title>`**

Sostituisci:
```html
<title>Piano Allenamento — Gara 10km 26 Aprile 2026</title>
```
Con:
```html
<title>Piano Allenamento — Alta Montagna Estate 2026</title>
```

- [ ] **Step 2: Sostituisci il blocco `.header-meta`**

Sostituisci (righe 20-24):
```html
      <div class="header-meta">
        <div>Gara 10 km</div>
        <div>26 Aprile 2026</div>
        <div id="days-to-go"></div>
      </div>
```
Con:
```html
      <div class="header-meta">
        <div id="obiettivo"></div>
      </div>
```

- [ ] **Step 3: Rimuovi la `div.prog-wrap` intera (righe 40-89)**

Rimuovi tutto il blocco:
```html
    <!-- Barra progressione corsa -->
    <div class="prog-wrap">
      <div class="prog-label">Progressione sessioni corsa → 26 apr 2026</div>
      <div class="prog-rows">
        <div class="prog-row">
          <div class="prog-row-lbl">Lv 6</div>
          <div class="prog-segs">
            <div class="prog-seg seg-done"  title="Lv6 #1 — fatto"></div>
            <div class="prog-seg seg-mont"  title="Montagna dom 22/3 — carico equivalente"></div>
            <div class="prog-seg seg-curr"  title="Lv6 #2 — mer 25 mar"></div>
            <div class="prog-seg seg-curr"  title="Lv6 #3 — dom 29 o lun 30 mar"></div>
            <div class="prog-seg seg-empty" style="flex:7"></div>
          </div>
        </div>
        <div class="prog-row">
          <div class="prog-row-lbl">Lv 7</div>
          <div class="prog-segs">
            <div class="prog-seg seg-empty" style="flex:4"></div>
            <div class="prog-seg seg-s1" title="Lv7 #1 — mar 31 mar"></div>
            <div class="prog-seg seg-s1" title="Lv7 #2 — ven 3 apr"></div>
            <div class="prog-seg seg-s1" title="Lv7 #3 — dom 5 apr (o lun 6)"></div>
            <div class="prog-seg seg-empty" style="flex:4"></div>
          </div>
        </div>
        <div class="prog-row">
          <div class="prog-row-lbl">Lv 8</div>
          <div class="prog-segs">
            <div class="prog-seg seg-empty" style="flex:7"></div>
            <div class="prog-seg seg-s2" title="Lv8 #1 — mar 8 apr"></div>
            <div class="prog-seg seg-s2" title="Lv8 #2 — gio 10 apr"></div>
            <div class="prog-seg seg-empty" style="flex:2"></div>
          </div>
        </div>
        <div class="prog-row">
          <div class="prog-row-lbl">Lv 9</div>
          <div class="prog-segs">
            <div class="prog-seg seg-empty" style="flex:9"></div>
            <div class="prog-seg seg-s3" title="Lv9 #1 — lun 14 apr"></div>
            <div class="prog-seg seg-s3" title="Lv9 #2 — gio 17 apr"></div>
            <div class="prog-seg seg-empty" style="flex:1"></div>
          </div>
        </div>
        <div class="prog-row">
          <div class="prog-row-lbl">Gara</div>
          <div class="prog-segs">
            <div class="prog-seg seg-empty" style="flex:11"></div>
            <div class="prog-seg seg-gara" title="GARA — dom 26 apr"></div>
          </div>
        </div>
      </div>
    </div>
```

Il risultato deve avere `<!-- Week tabs -->` come primo elemento figlio di `#section-calendario`.

- [ ] **Step 4: Aggiorna le istruzioni nello storico (righe 126-142)**

Sostituisci il blocco `.storico-info` e `.howto`:
```html
    <div class="storico-info">
      Qui trovi tutti i piani mensili. Per aggiungere un nuovo piano, aggiungi un oggetto nell'array <code>PIANI</code>
      in fondo allo script, e aggiungi le settimane nell'array <code>WEEKS</code> con la chiave <code>piano</code>
      corrispondente. I dettagli degli allenamenti vanno nell'oggetto <code>DETAILS</code>.
    </div>
    <div class="storico-plan-list" id="storico-list"></div>
    <div class="howto">
      <h3>Come aggiornare il piano</h3>
      <ol>
        <li>Apri il file HTML in un editor di testo (es. VS Code, Notepad++).</li>
        <li>Trova l'array <code>PIANI</code> nello script. Aggiungi un nuovo oggetto con <code>id</code>, <code>label</code>, <code>meta</code>, <code>gara</code>.</li>
        <li>Trova l'array <code>WEEKS</code>. Aggiungi le nuove settimane con <code>piano: 'id_del_tuo_piano'</code>.</li>
        <li>Aggiungi i dettagli di ogni allenamento nell'oggetto <code>DETAILS</code> con chiavi univoche.</li>
        <li>Per marcare un allenamento come completato, aggiungi <code>done: true</code> al badge nella settimana.</li>
        <li>Salva il file e riaprilo nel browser. Nessun server necessario.</li>
      </ol>
    </div>
```
Con:
```html
    <div class="storico-info">
      Qui trovi tutti i piani mensili. Per aggiungere un nuovo piano, aggiungi una voce in <code>data/plans.json</code>
      con i campi <code>id</code>, <code>label</code>, <code>meta</code>, <code>gara</code>, <code>file</code>
      e imposta <code>current: true</code> sul piano attivo.
    </div>
    <div class="storico-plan-list" id="storico-list"></div>
    <div class="howto">
      <h3>Come aggiungere un nuovo piano</h3>
      <ol>
        <li>Crea il file JSON del piano in <code>data/</code> (es. <code>plan_lugoset2026.json</code>) con la struttura <code>piani</code>, <code>details</code>, <code>weeks</code>.</li>
        <li>Apri <code>data/plans.json</code> e aggiungi una voce con <code>"current": true</code> per il nuovo piano e <code>"current": false</code> per il precedente.</li>
        <li>Aggiorna <code>bot/config.py</code> non è necessario: il bot legge il manifest automaticamente.</li>
      </ol>
    </div>
```

- [ ] **Step 5: Verifica la struttura HTML**

Apri `index.html` in un editor e verifica:
- Nessuna occorrenza di `days-to-go` o `prog-wrap`
- Il tag `<div id="obiettivo">` è presente nell'header
- Il primo figlio di `#section-calendario` è `<!-- Week tabs -->`

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: replace hardcoded header/progress-bar with dynamic obiettivo element"
```

---

## Task 5: Aggiorna `assets/app.js`

**Files:**
- Modify: `assets/app.js`

Quattro modifiche:
1. Aggiungere variabile `LOADED_PLANS`
2. Rimuovere `updateCountdown()`
3. Riscrivere `initApp()` per caricare manifest → piano corrente
4. Riscrivere `selectPiano()` con lazy loading + error handling

- [ ] **Step 1: Aggiorna il commento e aggiungi `LOADED_PLANS` (riga 10-11)**

Sostituisci:
```js
// PIANI, DETAILS, WEEKS vengono caricati da data/plan_apr2026.json all'avvio
let PIANI = [], DETAILS = {}, WEEKS = [];
```
Con:
```js
// PIANI caricato da data/plans.json; DETAILS e WEEKS mergiati piano per piano
let PIANI = [], DETAILS = {}, WEEKS = [];
const LOADED_PLANS = new Set();
```

- [ ] **Step 2: Rimuovi la funzione `updateCountdown()` (righe 38-46)**

Rimuovi l'intero blocco:
```js
/* ── Countdown ── */
function updateCountdown() {
  const gara = new Date('2026-04-26');
  const today = new Date();
  today.setHours(0,0,0,0);
  const diff = Math.ceil((gara - today) / 86400000);
  const el = document.getElementById('days-to-go');
  if (el) el.textContent = diff > 0 ? `${diff} giorni alla gara` : diff === 0 ? 'Oggi è il giorno!' : 'Gara completata';
}
```

- [ ] **Step 3: Riscrivi `selectPiano()` con lazy loading (riga 194-200)**

Sostituisci:
```js
function selectPiano(id) {
  currentPiano = id;
  currentWeekIdx = 0;
  renderWeekTabs();
  renderCalendar();
  document.getElementById('detail-panel').innerHTML = '<div class="detail-empty">— clicca su un allenamento per i dettagli —</div>';
}
```
Con:
```js
async function selectPiano(id) {
  if (!LOADED_PLANS.has(id)) {
    const pianoDef = PIANI.find(p => p.id === id);
    if (!pianoDef) return;
    document.getElementById('cal-grid').innerHTML = '<p style="padding:20px">Caricamento...</p>';
    try {
      const res = await fetch(`./data/${pianoDef.file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const plan = await res.json();
      Object.assign(DETAILS, plan.details);
      WEEKS.push(...plan.weeks);
      LOADED_PLANS.add(id);
    } catch (e) {
      const prevPiano = currentPiano;
      document.getElementById('cal-grid').innerHTML =
        `<p style="color:red;padding:20px">Errore caricamento piano: ${e.message}</p>` +
        `<p style="padding:0 20px"><button onclick="selectPiano('${prevPiano}');showSection('calendario')">← Torna al piano corrente</button></p>`;
      return;
    }
  }
  currentPiano = id;
  currentWeekIdx = 0;
  renderWeekTabs();
  renderCalendar();
  document.getElementById('detail-panel').innerHTML = '<div class="detail-empty">— clicca su un allenamento per i dettagli —</div>';
}
```

- [ ] **Step 4: Riscrivi `initApp()` (righe 296-363)**

Sostituisci l'intera funzione `initApp`:
```js
/* ── INIT ── */
async function initApp() {
  try {
    const manifestRes = await fetch('./data/plans.json');
    if (!manifestRes.ok) throw new Error(`Manifest HTTP ${manifestRes.status}`);
    PIANI = await manifestRes.json();

    const currentDef = PIANI.find(p => p.current) || PIANI[0];
    const planRes = await fetch(`./data/${currentDef.file}`);
    if (!planRes.ok) throw new Error(`Piano HTTP ${planRes.status}`);
    const plan = await planRes.json();
    Object.assign(DETAILS, plan.details);
    WEEKS.push(...plan.weeks);
    LOADED_PLANS.add(currentDef.id);
    currentPiano = currentDef.id;

    const obiettivoEl = document.getElementById('obiettivo');
    if (obiettivoEl) obiettivoEl.textContent = currentDef.gara;
  } catch (e) {
    console.error('Errore caricamento piano:', e);
    document.getElementById('cal-grid').innerHTML = '<p style="color:red;padding:20px">Errore caricamento piano. Apri da un server locale (non direttamente dal filesystem).</p>';
    return;
  }
  await loadWorkoutLog();
  // Carica categorie esercizi
  try {
    const { data: cats } = await supabaseClient
      .from('exercise_categories')
      .select('id, label')
      .order('sort_order');
    EX_CATS = (cats || []).map(c => ({ id: c.id, label: c.label }));

    const { data: exRows } = await supabaseClient
      .from('exercises')
      .select('category_id, section_title, title, muscle, tip, yt')
      .order('category_id')
      .order('sort_order');

    ESERCIZI = {};
    (exRows || []).forEach(row => {
      if (!ESERCIZI[row.category_id]) ESERCIZI[row.category_id] = [];
      const cat = ESERCIZI[row.category_id];
      let section = cat.find(s => s.section === row.section_title);
      if (!section) {
        section = { section: row.section_title, items: [] };
        cat.push(section);
      }
      section.items.push({
        title: row.title,
        muscle: row.muscle,
        tip: row.tip,
        yt: row.yt,
      });
    });
  } catch (e) {
    console.warn('Esercizi non caricati da Supabase:', e.message);
  }

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
}
```

- [ ] **Step 5: Verifica che non rimangano riferimenti a `updateCountdown` o `plan_apr2026`**

```bash
grep -n "updateCountdown\|plan_apr2026\|days-to-go\|RACE_DATE" assets/app.js
```

Expected: nessun output.

- [ ] **Step 6: Commit**

```bash
git add assets/app.js
git commit -m "feat: load plans from manifest with lazy loading for storico"
```

---

## Task 6: Test manuale e PR

**Files:** nessuno (verifica e push)

- [ ] **Step 1: Avvia un server locale e apri l'app**

```bash
python -m http.server 8080
```

Apri `http://localhost:8080` nel browser.

- [ ] **Step 2: Verifica piano corrente**

- L'header mostra "Alta Montagna Estate 2026" (non "Gara 10 km / 26 Aprile 2026")
- Nessuna barra di progressione sopra il calendario
- Il calendario mostra le settimane di Maggio–Giugno 2026
- La settimana corrente viene auto-selezionata (o la prima se oggi non è nel piano)

- [ ] **Step 3: Verifica storico — navigazione Aprile**

- Clicca "Storico piani" nella nav
- Vedi due voci: "Piano Aprile 2026" (completato) e "Piano Maggio–Giugno 2026" (in corso)
- Clicca "Piano Aprile 2026"
- L'app mostra brevemente "Caricamento..." poi il calendario di Aprile
- Clicca di nuovo "Piano Aprile 2026" (già in cache): nessuna fetch, navigazione immediata

- [ ] **Step 4: Verifica storico — errore simulato (opzionale)**

Per testare il path di errore, rinomina temporaneamente `data/plan_apr2026.json` in `data/plan_apr2026.json.bak`, ricarica, clicca Aprile nello storico: deve comparire il messaggio di errore con il pulsante "← Torna al piano corrente". Ripristina il file dopo.

- [ ] **Step 5: Push e PR**

```bash
git push -u origin feature/26-multi-piano-lazy-load
gh pr create \
  --title "feat: multi-piano con lazy loading storico (#26)" \
  --body "$(cat <<'EOF'
## Summary
- Aggiunge `data/plans.json` come manifest dei piani
- Carica il piano corrente (Maggio-Giugno) all'avvio; Aprile è caricato on demand al click storico
- Rimuove countdown e barra progressione corsa hardcodata dall'HTML
- Bot legge PLAN_JSON_PATH e PLAN_GARA dal manifest invece di hardcode

## Test plan
- [ ] Header mostra "Alta Montagna Estate 2026"
- [ ] Calendario mostra settimane Maggio-Giugno
- [ ] Click "Piano Aprile 2026" nello storico: carica e naviga al calendario Aprile
- [ ] Secondo click su Aprile: navigazione immediata (cache)
- [ ] `python -m py_compile bot/main.py bot/config.py` senza errori
- [ ] `grep RACE_DATE_STR bot/main.py bot/config.py` → nessun output

Closes #26
EOF
)"
```
