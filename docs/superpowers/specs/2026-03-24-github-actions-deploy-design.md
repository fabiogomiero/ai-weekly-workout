# Design: GitHub Actions Deploy with Secrets Injection

**Date:** 2026-03-24
**Status:** Implemented

## Context

`assets/app.js` richiedeva `SUPABASE_URL` e `SUPABASE_ANON_KEY` hardcoded nel sorgente — visibili nel repository pubblico su GitHub. La soluzione adottata usa GitHub Actions per iniettare i valori reali da GitHub Secrets prima del deploy su `gh-pages`, mantenendo placeholder nel sorgente versionato.

---

## Decisioni di Design

- **Placeholders nel sorgente:** `__SUPABASE_URL__` e `__SUPABASE_ANON_KEY__` in `assets/app.js`
- **Sostituzione:** `sed -i` nel workflow GitHub Actions, solo sul branch `gh-pages` (il sorgente su `main` mantiene i placeholder)
- **Deploy action:** `JamesIves/github-pages-deploy-action@v4` — branch `gh-pages`, folder `.` (root)
- **Trigger:** push su `main` + `workflow_dispatch` (lancio manuale)

---

## Flusso CI/CD

```
push su main
  → actions/checkout@v4
  → sed sostituisce __SUPABASE_URL__ e __SUPABASE_ANON_KEY__ in assets/app.js
  → JamesIves deploy → branch gh-pages aggiornato con chiavi reali
```

Il branch `main` non contiene mai le chiavi — solo i placeholder.

---

## Setup GitHub (una tantum)

1. `Settings → Secrets and variables → Actions → New repository secret`
2. Aggiungi: `SUPABASE_URL` (es. `https://xxx.supabase.co`)
3. Aggiungi: `SUPABASE_ANON_KEY` (anon key dal progetto Supabase)
4. `Settings → Pages → Source: Deploy from a branch → Branch: gh-pages → folder: / (root)`

URL finale: `https://USERNAME.github.io/weekly-workout/piano_allenamento.html`

---

## Sviluppo Locale

`assets/app.js` nel repository contiene i placeholder — non funziona direttamente nel browser senza sostituzione.

Per sviluppo locale con Supabase attivo:
```bash
# Sostituisci manualmente i placeholder in assets/app.js
# (non committare con le chiavi reali)
git update-index --skip-worktree assets/app.js
```

Il comando `skip-worktree` dice a Git di ignorare le modifiche locali al file — non verranno incluse in `git add .` o commit accidentali.

---

## File Modificati

| File | Modifica |
|---|---|
| `assets/app.js` | Costanti Supabase → placeholder `__SUPABASE_URL__` e `__SUPABASE_ANON_KEY__` |
| `.github/workflows/deploy.yml` | Workflow creato |
| `CLAUDE.md` | Sezione sviluppo locale + skip-worktree |
