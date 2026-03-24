// ── SUPABASE CONFIG ──
// Usa la anon key (non la service role key) — ok per uso personale con RLS
const SUPABASE_URL = 'https://voohflnrsywdqqydjdjn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_H2ye2SnPYQLbSCska1dcvg_DQvF0MC1';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Map: "YYYY-MM-DD:workout_key" → { status, reason }
let workoutLogCache = {};

// PIANI, DETAILS, WEEKS vengono caricati da data/plan_apr2026.json all'avvio
let PIANI = [], DETAILS = {}, WEEKS = [];
let EX_CATS = [];
let ESERCIZI = {};

/* ══════════════════════════════════════════════════════════
   ESERCIZI & VIDEO
══════════════════════════════════════════════════════════ */
function ytUrl(q) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
}

/* ══════════════════════════════════════════════════════════
   LOGICA APP
══════════════════════════════════════════════════════════ */

/* Settimane del piano corrente */
function weeksForPiano(pid) {
  return WEEKS.filter(w => w.piano === pid);
}

let currentPiano = null;
let currentWeekIdx = 0;
let currentExCat = 'forza';

/** Restituisce 'YYYY-MM-DD' nella timezone locale del browser */
const getTodayStr = () => new Date().toLocaleDateString('sv-SE');

/* ── Countdown ── */
function updateCountdown() {
  const gara = new Date('2026-04-26');
  const today = new Date();
  today.setHours(0,0,0,0);
  const diff = Math.ceil((gara - today) / 86400000);
  const el = document.getElementById('days-to-go');
  if (el) el.textContent = diff > 0 ? `${diff} giorni alla gara` : diff === 0 ? 'Oggi è il giorno!' : 'Gara completata';
}

/* ── Section switcher ── */
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  event.currentTarget.classList.add('active');
  if (id === 'storico') renderStorico();
  if (id === 'esercizi') renderEsercizi();
}

/* ── Calendario ── */
function renderWeekTabs() {
  const weeks = weeksForPiano(currentPiano);
  const tabs = document.getElementById('week-tabs');
  tabs.innerHTML = weeks.map((w, i) =>
    `<button class="week-tab${i === currentWeekIdx ? ' active' : ''}" onclick="selectWeek(${i})">${w.label}</button>`
  ).join('');
}

function selectWeek(idx) {
  currentWeekIdx = idx;
  renderWeekTabs();
  renderCalendar();
  document.getElementById('detail-panel').innerHTML = '<div class="detail-empty">— clicca su un allenamento per i dettagli —</div>';
}

function renderCalendar() {
  const weeks = weeksForPiano(currentPiano);
  const w = weeks[currentWeekIdx];
  if (!w) return;
  document.getElementById('week-note').textContent = w.note;
  const cols = w.cols || 7;
  const grid = document.getElementById('cal-grid');
  grid.className = `cal-grid cols-${cols}`;

  grid.innerHTML = w.days.map(day => {
    const isRest = !day.badges || day.badges.length === 0;
    const isToday = day.isoDate === getTodayStr();
    const cls = ['cal-day', isRest ? 'rest' : '', isToday ? 'today' : '', day.alt ? 'alt' : ''].filter(Boolean).join(' ');

    const badges = (day.badges || []).map(b => {
      const logKey = `${day.isoDate || ''}:${b.key}`;
      const logEntry = day.isoDate ? workoutLogCache[logKey] : null;
      const isDone = logEntry?.status === 'done';
      const isSkipped = logEntry?.status === 'skipped';

      const statusCls = isDone ? ' b-done' : isSkipped ? ' b-skipped' : '';
      const onclick = `onclick="showDetail('${b.key}')"`;

      // Pulsante Fatto (su tutti i giorni con workout, passati e presenti)
      let fatoBtn = '';
      if (day.isoDate && !isRest) {
        if (isDone) {
          const rpe = logEntry?.rpe;
          const rpeDisplay = rpe ? `<span class="rpe-value">RPE ${rpe}/10</span>` : '';
          fatoBtn = `<button class="btn-fatto btn-fatto-done" disabled>✓ Completato</button>${rpeDisplay}`;
        } else if (isSkipped) {
          fatoBtn = `<button class="btn-fatto btn-fatto-skipped" onclick="markAsDone('${day.isoDate}','${b.key}',this)">↩ Recuperato</button>`;
        } else {
          fatoBtn = `<button class="btn-fatto" onclick="markAsDone('${day.isoDate}','${b.key}',this)">✓ Fatto</button>`;
        }
      }

      return `<span class="badge ${b.cls}${statusCls}" ${onclick}>${b.txt}</span>${fatoBtn}`;
    }).join('');

    return `<div id="${day.isoDate || ''}" class="${cls}">
      <div class="day-date">${day.date || ''}</div>
      ${isRest ? '<span class="rest-label">Riposo</span>' : badges}
    </div>`;
  }).join('');
}

function showDetail(key) {
  const d = DETAILS[key];
  if (!d) return;
  document.getElementById('detail-panel').innerHTML =
    `<div class="detail-title">${d.title}</div>${d.body}`;
}

/* ── Esercizi ── */
function renderExCatTabs() {
  document.getElementById('ex-cat-tabs').innerHTML = EX_CATS.map(c =>
    `<button class="ex-cat-tab${c.id === currentExCat ? ' active' : ''}" onclick="selectExCat('${c.id}')">${c.label}</button>`
  ).join('');
}

function selectExCat(id) {
  currentExCat = id;
  renderExCatTabs();
  renderEsercizi();
}

function renderEsercizi() {
  renderExCatTabs();
  const groups = ESERCIZI[currentExCat] || [];
  let html = '';
  groups.forEach(g => {
    html += `<div class="ex-section-label">${g.section}</div><div class="ex-grid">`;
    g.items.forEach(ex => {
      html += `<div class="ex-card">
        <div class="ex-card-title">${ex.title}</div>
        <div class="ex-card-muscle">${ex.muscle}</div>
        <div class="ex-card-tip">${ex.tip}</div>
        <a class="yt-btn" href="${ytUrl(ex.yt)}" target="_blank" rel="noopener">
          <svg class="yt-icon" viewBox="0 0 24 24"><path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.3 5 12 5 12 5s-4.3 0-7 .1c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.3.9C6.8 19 12 19 12 19s4.3 0 7-.2c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 9.6 21.8 8 21.8 8zM9.8 14.5V9.3l5.4 2.6-5.4 2.6z"/></svg>
          Cerca su YouTube
        </a>
      </div>`;
    });
    html += '</div>';
  });
  document.getElementById('ex-content').innerHTML = html;
}

/* ── Storico ── */
function renderStorico() {
  document.getElementById('storico-list').innerHTML = PIANI.map(p => `
    <div class="storico-plan-item" style="cursor:pointer" onclick="selectPiano('${p.id}');showSection('calendario')">
      <div>
        <div class="storico-plan-name">${p.label}</div>
        <div class="storico-plan-meta">${p.meta}${p.gara ? ' · ' + p.gara : ''}</div>
      </div>
      <span class="storico-badge${p.current ? ' current' : ''}">${p.current ? 'in corso' : 'completato'}</span>
    </div>
  `).join('');
}

function selectPiano(id) {
  currentPiano = id;
  currentWeekIdx = 0;
  renderWeekTabs();
  renderCalendar();
  document.getElementById('detail-panel').innerHTML = '<div class="detail-empty">— clicca su un allenamento per i dettagli —</div>';
}

async function loadWorkoutLog() {
  try {
    const { data, error } = await supabaseClient
      .from('workout_log')
      .select('date, workout_key, status, reason, rpe');
    if (error) throw error;
    workoutLogCache = {};
    (data || []).forEach(row => {
      workoutLogCache[`${row.date}:${row.workout_key}`] = { status: row.status, reason: row.reason, rpe: row.rpe };
    });
  } catch (e) {
    console.warn('Supabase non configurato o non raggiungibile:', e.message);
    // App funziona anche senza Supabase (read-only mode)
  }
}

async function markAsDone(dateStr, workoutKey, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const { error } = await supabaseClient
      .from('workout_log')
      .upsert(
        { date: dateStr, workout_key: workoutKey, status: 'done' },
        { onConflict: 'date,workout_key' }
      );
    if (error) throw error;
    workoutLogCache[`${dateStr}:${workoutKey}`] = { status: 'done', reason: null };
    btn.textContent = '✓ Completato';
    btn.classList.add('btn-fatto-done');
    // Mostra selettore RPE dopo il pulsante
    const rpeContainer = document.createElement('div');
    rpeContainer.className = 'rpe-picker';
    rpeContainer.innerHTML =
      '<div class="rpe-legend"><span>1 facile</span><span>10 difficile</span></div>' +
      '<div class="rpe-buttons">' +
      Array.from({length: 10}, (_, i) => i + 1)
        .map(n => `<button class="rpe-btn" onclick="saveRpe('${dateStr}','${workoutKey}',${n},this.closest('.rpe-picker'))">${n}</button>`)
        .join('') +
      '</div>';
    btn.parentElement.appendChild(rpeContainer);
  } catch (e) {
    btn.textContent = '✓ Fatto';
    btn.disabled = false;
    console.error('Errore salvataggio:', e);
    alert('Errore salvataggio. Verifica la configurazione Supabase.');
  }
}

async function saveRpe(dateStr, workoutKey, rpe, container) {
  try {
    await supabaseClient
      .from('workout_log')
      .update({ rpe })
      .eq('date', dateStr)
      .eq('workout_key', workoutKey);
    workoutLogCache[`${dateStr}:${workoutKey}`].rpe = rpe;
    container.innerHTML = `<span class="rpe-value">RPE ${rpe}/10</span>`;
  } catch (e) {
    console.error('Errore salvataggio RPE:', e);
  }
}

/* ── INIT ── */
async function initApp() {
  try {
    const res = await fetch('./data/plan_apr2026.json');
    const plan = await res.json();
    PIANI = plan.piani;
    DETAILS = plan.details;
    WEEKS = plan.weeks;
    currentPiano = PIANI.find(p => p.current)?.id || PIANI[0]?.id;
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
    // EX_CATS e ESERCIZI restano vuoti: il tab esercizi non mostra nulla ma l'app non crasha
  }
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
}

document.addEventListener('DOMContentLoaded', initApp);
