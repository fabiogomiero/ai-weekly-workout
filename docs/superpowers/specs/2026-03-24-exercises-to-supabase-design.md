# Design: Exercises Migration to Supabase

**Date:** 2026-03-24
**Status:** Implemented

## Context

`EX_CATS` (3 categorie) e `ESERCIZI` (34 esercizi in 6 sezioni) erano oggetti JS inline in `assets/app.js`. Migrati in tabelle Supabase per ridurre le dimensioni del file JS e permettere future modifiche al catalogo esercizi senza toccare il codice.

---

## Schema

```sql
exercise_categories (id TEXT PK, label TEXT, sort_order INTEGER)
exercises (id UUID PK, category_id TEXT FK, section_title TEXT, title TEXT, muscle TEXT, tip TEXT, yt TEXT, sort_order INTEGER)
```

Unique index su `(category_id, title)` per idempotenza degli INSERT.

---

## Fetch in initApp()

Dopo `loadWorkoutLog()`, due query Supabase:
1. `exercise_categories` ordinata per `sort_order` → popola `EX_CATS`
2. `exercises` ordinata per `category_id, sort_order` → popola `ESERCIZI` (groupBy category_id + section_title)

Le variabili `EX_CATS` e `ESERCIZI` diventano `let` (invece di `const`) per permettere l'assegnazione asincrona.

---

## Degradazione graceful

Se Supabase non è configurato o non raggiungibile, il try/catch lascia `EX_CATS = []` e `ESERCIZI = {}`. Il tab esercizi appare vuoto ma l'app non crasha — il calendario e il workout log funzionano normalmente.

---

## File Modificati

| File | Modifica |
|---|---|
| `docs/supabase/schema.sql` | Aggiunge tabelle `exercise_categories` e `exercises` con seed data |
| `assets/app.js` | Rimuove `EX_CATS`/`ESERCIZI` inline; aggiunge fetch in `initApp()` |
