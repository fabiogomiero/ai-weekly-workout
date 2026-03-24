# Morning Message: Workout Detail + Deep-link — Design Spec

**Data:** 2026-03-24
**Scope:** Migliorare il messaggio mattutino di Telegram aggiungendo il dettaglio del workout e un deep-link alla pagina GitHub Pages che porta direttamente al giorno odierno.

---

## Contesto

Il messaggio mattutino del bot attualmente mostra solo il titolo breve di ogni workout (es. "Corsa Lv 7 (2ª)") e un link generico alla pagina. L'utente vuole:

1. Vedere il dettaglio operativo del workout direttamente in Telegram (body completo, senza markup HTML)
2. Aprire la pagina web e ritrovarsi automaticamente sulla settimana e sul giorno corretto, con scroll verso il giorno odierno

---

## Componente A — Dettaglio workout in Telegram

### File coinvolti
- `bot/main.py` — funzione `morning_check()`

### Dati disponibili
`get_workouts_for_date()` in `bot/schedule_logic.py` restituisce già ogni workout come:
```python
{ 'key': ..., 'cls': ..., 'txt': ..., 'title': ..., 'body': '<strong>5\' camminando...</strong> Testo...' }
```
Il campo `body` contiene HTML inline (`<strong>`, a volte `<br>`). Va strippato prima di inviarlo.

### Modifiche

**1. Aggiungere helper `strip_html(html: str) -> str`** in `bot/main.py`:
```python
import re

def strip_html(html: str) -> str:
    # Converte <br> in newline prima di rimuovere gli altri tag
    text = re.sub(r'<br\s*/?>', '\n', html)
    text = re.sub(r'<[^>]+>', '', text).strip()
    # Sanifica caratteri Markdown V1 per evitare formattazione non voluta in Telegram
    text = text.replace('_', '\\_').replace('*', '\\*')
    return text
```

**2. Aggiornare la costruzione di `today_txt`** — le due occorrenze in `morning_check()`:

```python
# Prima (solo titolo):
today_txt = "💪 *Oggi:*\n" + '\n'.join(f"• {w['title']}" for w in today_workouts)

# Dopo (titolo + body, usando w['body'] già presente nel dict):
def fmt_workout(w: dict) -> str:
    body = strip_html(w.get('body', ''))
    return f"• {w['title']}" + (f"\n  _{body}_" if body else "")

today_txt = "💪 *Oggi:*\n" + '\n'.join(fmt_workout(w) for w in today_workouts)
```

`fmt_workout` non richiede `plan` come argomento — `body` è già nel dict di ogni workout.

**3. Override Claude (riga ~185):** quando `today_modified and today_override`, `today_txt` viene sostituito interamente con il testo di Claude. Nessuna modifica richiesta a quella riga — il body non si applica all'override, intenzionalmente.

---

## Componente B — Deep-link anchor alla data

### File coinvolti
- `bot/main.py` — tutti i `send_message` con `PAGE_URL`
- `assets/app.js` — `renderCalendar()` e `initApp()`

### Struttura URL
```
https://fabiogomiero.github.io/ai-weekly-workout/#2026-03-24
```

Il fragment `#YYYY-MM-DD` corrisponde all'`id` del div del giorno nel calendario.

### Modifiche bot (`bot/main.py`)

Sostituire `PAGE_URL` con `f"{PAGE_URL}#{today.isoformat()}"` in tutti e 4 i `send_message` di `morning_check()`. Il `today` è già disponibile come variabile locale.

### Modifiche frontend (`assets/app.js`)

**1. Aggiungere helper locale per la data odierna in fuso orario locale**

```js
// Usa 'sv-SE' locale per ottenere YYYY-MM-DD in ora locale (non UTC)
const getTodayStr = () => new Date().toLocaleDateString('sv-SE');
```

**2. Fix `isToday` in `renderCalendar()`**

Il campo `day.today` nel JSON non è mai valorizzato (bug preesistente — il campo non esiste nel JSON). Sostituire con calcolo dinamico. Modificare la riga del `cls`:

```js
// Prima:
const cls = ['cal-day', isRest ? 'rest' : '', day.today ? 'today' : '', day.alt ? 'alt' : '']
  .filter(Boolean).join(' ');

// Dopo:
const isToday = day.isoDate === getTodayStr();
const cls = ['cal-day', isRest ? 'rest' : '', isToday ? 'today' : '', day.alt ? 'alt' : '']
  .filter(Boolean).join(' ');
```

**3. Aggiungere `id` ai div `.cal-day`**

Nel template string del div, aggiungere `id="${day.isoDate || ''}"`. I giorni senza `isoDate` ricevono `id=""` che è non-queryable ma non causa errori.

**4. Ristrutturare la parte finale di `initApp()`**

Attualmente l'ultima parte di `initApp()` è:
```js
updateCountdown();
renderWeekTabs();
renderCalendar();   // ← prima e unica chiamata a renderCalendar
```

**Sostituire** le ultime tre righe con:
```js
updateCountdown();

// Auto-select settimana corrente
const todayStr = getTodayStr();
const weeks = weeksForPiano(currentPiano);
const todayWeekIdx = weeks.findIndex(w => w.days?.some(d => d.isoDate === todayStr));
if (todayWeekIdx >= 0) {
  currentWeekIdx = todayWeekIdx;
}

renderWeekTabs();
renderCalendar();   // unica chiamata, già sul week corretto

// Scroll all'anchor se presente nel URL
if (location.hash) {
  const el = document.querySelector(location.hash);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

Questo evita il doppio `renderCalendar()`: si aggiorna `currentWeekIdx` prima del render, non dopo.

---

## Edge cases

| Caso | Comportamento |
|------|---------------|
| Workout senza `body` | `strip_html('')` → stringa vuota → mostra solo il titolo |
| `body` con underscore o asterischi | Escapati da `strip_html()` prima dell'invio |
| Giorno di riposo | `today_txt` = "🛌 Oggi è giorno di riposo." — invariato, nessun body |
| Override Claude attivo | `today_txt` rimpiazzato interamente da Claude — nessun body aggiunto |
| Hash non trovato nel DOM | `querySelector` ritorna null, optional chaining previene errori |
| Oggi non in nessuna settimana (post-gara) | `todayWeekIdx = -1`, `if` non si attiva, rimane `currentWeekIdx = 0` |
| Link da Telegram senza hash | `location.hash === ''`, nessun scroll |

---

## Verifica

1. **Telegram bot locale:** avvia `python bot/main.py`, invia `/test_morning` → il messaggio deve mostrare il body in corsivo sotto ogni workout + URL con `#YYYY-MM-DD`
2. **Markdown safety:** verifica che il messaggio non mostri formattazione rotta (es. testo che scompare o diventa bold/italic non voluto)
3. **Pagina web:** apri `http://localhost:8080/#2026-03-24` → deve aprirsi sulla settimana corretta, scrollare al giorno, giorno odierno evidenziato con classe `today`
4. **Auto-select:** apri la pagina senza hash → deve comunque partire sulla settimana corrente (non sulla settimana 0)
5. **Giorno di riposo:** modifica temporaneamente un badge in JSON per il giorno corrente → messaggio non deve mostrare body per quel workout
