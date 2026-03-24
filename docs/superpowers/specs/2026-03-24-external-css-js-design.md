# Design: External CSS and JS Files

**Date:** 2026-03-24
**Status:** Implemented

## Motivazione
`piano_allenamento.html` aveva 1117 righe con CSS e JS inline. Separare i file migliora la leggibilità, facilita il versionamento delle modifiche e permette al browser di fare caching separato.

## Struttura risultante
- `piano_allenamento.html` — ~150 righe, solo struttura HTML
- `assets/style.css` — ~627 righe CSS
- `assets/app.js` — ~340 righe JavaScript

## Note tecniche
- `assets/app.js` NON usa `type="module"` — le funzioni restano globali per compatibilità con `onclick="..."` inline nell'HTML
- CDN Supabase carica prima di `assets/app.js` (dipendenza `window.supabase`)
- I path relativi (`fetch('./data/plan_apr2026.json')`) funzionano perché tutti i file sono nella root del repo
