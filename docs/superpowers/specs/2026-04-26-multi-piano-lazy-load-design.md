# Design: Multi-piano con lazy loading storico

**Data:** 2026-04-26  
**Obiettivo:** Aggiungere il piano Maggio–Giugno 2026 all'app mantenendo il piano Aprile navigabile nello storico, con caricamento lazy dei piani storici.

## Contesto

L'app carica attualmente un singolo file JSON hardcoded (`plan_apr2026.json`). Il bot punta allo stesso file via `PLAN_JSON_PATH` in `config.py`. Il piano Maggio–Giugno (`plan_magglu2026.json`) è già stato creato e va integrato come piano corrente. Il piano Aprile deve rimanere navigabile nello storico ma non viene caricato all'avvio.

## Approccio scelto: manifest + lazy loading

All'avvio si carica solo il piano corrente. I piani storici vengono caricati on demand al click nello storico e cachati in memoria per evitare fetch ripetute.

## Struttura dati

### `data/plans.json` (nuovo file)

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

I file piano esistenti (`plan_apr2026.json`, `plan_magglu2026.json`) non vengono modificati.

## Frontend (`assets/app.js`)

### Init

1. Fetch `data/plans.json` → popola `PIANI` e identifica il piano con `current: true`
2. Fetch del file del piano corrente → popola `DETAILS` e `WEEKS`
3. Aggiunge l'id del piano corrente a `LOADED_PLANS` (Set)
4. Popola `#obiettivo` con il campo `gara` del piano corrente

### Lazy loading (`selectPiano`)

```
selectPiano(id):
  se id in LOADED_PLANS → naviga al calendario
  altrimenti:
    mostra "Caricamento..." nella cal-grid
    fetch del file del piano (trovato in PIANI)
    se successo:
      merge DETAILS ← piano.details
      merge WEEKS ← piano.weeks
      aggiungi id a LOADED_PLANS
      naviga al calendario
    se errore:
      mostra messaggio errore + pulsante "Torna al piano corrente"
      currentPiano NON viene aggiornato (rimane il piano precedente)
```

### Variabili globali modificate

- `LOADED_PLANS`: `Set<string>` — id dei piani già caricati in memoria
- `PIANI`: popolato dal manifest (non più dal file piano)
- `DETAILS`, `WEEKS`: merge incrementale ad ogni lazy load

## HTML (`index.html`)

| Elemento | Modifica |
|----------|----------|
| `.header-meta` (righe 20-24) | Rimuovere "Gara 10 km" e "26 Aprile 2026" hardcoded; aggiungere `<div id="obiettivo"></div>` popolato da JS |
| `div.prog-wrap` (righe 40-89) | Rimuovere l'intera barra progressione corsa (hardcoded ad Aprile, non ha equivalente nel nuovo piano) |
| Testo istruzioni storico (riga 136) | Aggiornare: "aggiungi una voce in `data/plans.json`" |

## Bot (`bot/`)

### `config.py`

- `PLAN_JSON_PATH`: non più hardcoded, letto dal manifest
- `RACE_DATE_STR`: rimosso
- Aggiungere `PLAN_GARA`: stringa `gara` del piano corrente (dal manifest)

```python
import json
from pathlib import Path

_manifest_path = Path(__file__).parent.parent / 'data' / 'plans.json'
_manifest = json.loads(_manifest_path.read_text(encoding='utf-8'))
_current = next(p for p in _manifest if p['current'])

PLAN_JSON_PATH = Path(__file__).parent.parent / 'data' / _current['file']
PLAN_GARA = _current['gara']
```

### `main.py`

- Importare `PLAN_GARA` al posto di `RACE_DATE_STR`
- Sostituire `days_to_race` con `obiettivo: PLAN_GARA` nel contesto inviato a Claude (righe 167 e 244)

## File modificati

| File | Tipo modifica |
|------|---------------|
| `data/plans.json` | Nuovo |
| `assets/app.js` | Init, selectPiano, header obiettivo |
| `index.html` | Rimuovere countdown e prog-wrap, aggiungere #obiettivo |
| `bot/config.py` | PLAN_JSON_PATH da manifest, rimuovere RACE_DATE_STR |
| `bot/main.py` | Sostituire days_to_race con obiettivo |

## File NON modificati

- `data/plan_apr2026.json`
- `data/plan_magglu2026.json`
- `bot/schedule_logic.py`
- `bot/claude_adapter.py`
