// ── SUPABASE CONFIG ──
// Usa la anon key (non la service role key) — ok per uso personale con RLS
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';  // sostituisci dopo setup Supabase
const SUPABASE_ANON_KEY = 'eyJ...';                        // sostituisci dopo setup Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Map: "YYYY-MM-DD:workout_key" → { status, reason }
let workoutLogCache = {};

// PIANI, DETAILS, WEEKS vengono caricati da data/plan_apr2026.json all'avvio
let PIANI = [], DETAILS = {}, WEEKS = [];

/* ══════════════════════════════════════════════════════════
   ESERCIZI & VIDEO
══════════════════════════════════════════════════════════ */
function ytUrl(q) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
}

const EX_CATS = [
  { id: 'forza', label: 'Forza gambe' },
  { id: 'mob',   label: 'Mobilità' },
  { id: 'corsa', label: 'Tecnica corsa' },
];

const ESERCIZI = {
  forza: [
    {
      section: 'Esercizi principali',
      items: [
        { title:'Squat corpo libero', muscle:'Quadricipiti · glutei · core', tip:'Piedi larghezza spalle, punte leggermente fuori. Ginocchia seguono le punte. Scendi come su una sedia dietro di te.', yt:'squat corpo libero esecuzione corretta tutorial italiano' },
        { title:'Squat con pesi (manubri)', muscle:'Quadricipiti · glutei · core', tip:'Manubri ai fianchi o sulle spalle. Stessa meccanica del corpo libero. Tronco eretto, schiena neutra.', yt:'squat con manubri esecuzione corretta tutorial italiano' },
        { title:'Squat con elastico (intorno alle cosce)', muscle:'Quadricipiti · glutei medi · abduttori', tip:'Mini-band intorno alle cosce. Spingi le ginocchia fuori durante tutto il movimento. Attiva i glutei medi spesso trascurati.', yt:'squat elastico mini band tutorial italiano gambe' },
        { title:'Affondi alternati', muscle:'Quadricipiti · glutei · femorali', tip:'Passo ampio, ginocchio posteriore sfiora il pavimento. Ginocchio anteriore non supera la punta del piede. Busto eretto.', yt:'affondi alternati esecuzione corretta tutorial italiano' },
        { title:'Affondi cammino con elastico', muscle:'Quadricipiti · glutei · stabilizzatori', tip:'Elastico intorno alle cosce per attivare i glutei medi. Avanza passo dopo passo mantenendo la tensione laterale.', yt:'affondi camminati elastico tutorial esecuzione italiano' },
        { title:'Step-up su sedia', muscle:'Quadricipiti · glutei · equilibrio', tip:'Spingi con il tallone del piede sul gradino, non con la punta. Porta la coscia opposta in alto. Fondamentale per la montagna.', yt:'step up sedia esercizio gambe tutorial italiano' },
        { title:'Step-up con pesi', muscle:'Quadricipiti · glutei · femorali', tip:'Stessa meccanica dello step-up base. I manubri aumentano il carico senza cambiare il gesto. Altezza gradino: coscia parallela al suolo.', yt:'step up manubri gradino tutorial italiano' },
        { title:'Bulgarian split squat', muscle:'Quadricipiti · glutei · stabilizzatori caviglia', tip:'Piede posteriore su sedia. Scendi verticalmente, non in avanti. L\'esercizio più specifico per la salita in montagna.', yt:'bulgarian split squat tutorial italiano esecuzione corretta' },
        { title:'Hip hinge / Romanian deadlift', muscle:'Femorali · glutei · erettori schiena', tip:'Busto in avanti con schiena piatta, bacino indietro. Ginocchia si piegano poco. Senti l\'allungamento dei femorali.', yt:'hip hinge deadlift rumeno manubri tutorial italiano' },
        { title:'RDL monogamba (single-leg deadlift)', muscle:'Femorali · glutei · propriocezione', tip:'Equilibrio su una gamba. Busto avanza, gamba libera sale dietro. Essenziale per prevenire distorsioni in discesa.', yt:'single leg deadlift monogamba tutorial italiano esecuzione' },
        { title:'Glute bridge', muscle:'Glutei · core · femorali', tip:'Schiena a terra, piedi vicini ai glutei. Spingi i fianchi in alto, spremi i glutei in cima. Tieni 1-2 secondi.', yt:'glute bridge esecuzione corretta tutorial italiano' },
        { title:'Glute bridge monogamba', muscle:'Glutei · stabilizzatori · core', tip:'Una gamba tesa in aria. Richiede stabilità del bacino. Corregge asimmetrie tra i lati.', yt:'glute bridge monogamba single leg tutorial italiano' },
        { title:'Glute bridge con elastico', muscle:'Glutei medi · abduttori', tip:'Mini-band sopra le ginocchia. Spingi le ginocchia fuori mentre sali. Attiva i glutei medi (previene il valgismo).', yt:'glute bridge elastico mini band tutorial gambe italiano' },
        { title:'Wall sit', muscle:'Quadricipiti · resistenza isometrica', tip:'Schiena al muro, cosce parallele al suolo, ginocchia a 90°. Esercizio isometrico: simula l\'affaticamento della discesa prolungata.', yt:'wall sit esercizio isometrico tutorial italiano' },
        { title:'Calf raise (in piedi)', muscle:'Polpacci (gastrocnemio)', tip:'Sali sulle punte lentamente, scendi lentamente. Su un gradino per maggiore escursione. Fondamentale per corsa e discesa.', yt:'calf raise polpacci tutorial italiano esecuzione gradino' },
        { title:'Single-leg calf raise', muscle:'Polpacci · stabilità caviglia', tip:'Una gamba sola. Molto più difficile del bilaterale. Inizia appoggiandoti a un muro. Progressione naturale del calf raise.', yt:'single leg calf raise monogamba polpacci tutorial italiano' },
        { title:'Box jump basso', muscle:'Potenza gambe · reattività', tip:'Gradino basso 20-30 cm. Atterraggio morbido con ginocchia flesse, mai rigido. Solo settimana 3 di picco.', yt:'box jump basso tutorial esecuzione sicura italiano' },
      ],
    },
  ],
  mob: [
    {
      section: 'Mobilità anca e catena posteriore',
      items: [
        { title:'World lunge', muscle:'Flessori anca · adduttori · torace', tip:'Affondo lungo, mano a terra lato piede anteriore, poi ruota il busto aprendo il braccio verso il soffitto. Uno dei migliori esercizi di mobilità globale.', yt:'world lunge mobilità anca tutorial italiano' },
        { title:'90/90 stretch', muscle:'Rotatori interni/esterni anca · piriforme', tip:'Seduto a terra, entrambe le gambe a 90°. Schiena dritta. Inclinati in avanti sulla gamba anteriore. Per chi porta il peso dello zaino.', yt:'90 90 hip stretch mobilità anca tutorial italiano' },
        { title:'Piriforme stretch', muscle:'Piriforme · rotatori profondi anca', tip:'Sdraiato, porta il piede sul ginocchio opposto (figura 4). Tira la coscia verso il petto. Allevia il dolore al nervo sciatico da affaticamento.', yt:'piriforme stretch sciatico tutorial italiano' },
        { title:'Ileopsoas stretch', muscle:'Flessori anca · ileopsoas', tip:'Affondo basso, ginocchio posteriore a terra. Spingi il bacino in avanti e in basso. Contrasta l\'accorciamento da corsa e postura seduta.', yt:'ileopsoas stretch flessori anca tutorial italiano' },
      ],
    },
    {
      section: 'Mobilità caviglia e polpacci',
      items: [
        { title:'Pompate caviglia in downward dog', muscle:'Polpacci · tendine di Achille · caviglia', tip:'Posizione cane verso il basso. Alterna il tallone al suolo lentamente su ogni lato. Fondamentale dopo corsa e discesa.', yt:'downward dog pompate polpacci mobilità caviglia tutorial' },
        { title:'Mobilità caviglia a muro', muscle:'Articolazione tibiotarsica · peronei', tip:'Piede vicino al muro, spingi il ginocchio verso il muro senza alzare il tallone. Aumenta la distanza progressivamente.', yt:'mobilità caviglia muro tutorial ankle mobility italiano' },
        { title:'Single-leg deadlift leggerissimo (propriocezione)', muscle:'Propriocezione caviglia · femorali · equilibrio', tip:'Peso minimo o corpo libero, lentissimo. L\'obiettivo è allenare i recettori della caviglia per terreno irregolare.', yt:'single leg deadlift propriocezione equilibrio tutorial' },
      ],
    },
    {
      section: 'Recupero miofasciale',
      items: [
        { title:'Foam roller quadricipiti', muscle:'Quadricipiti · fascia lata · IT-band', tip:'Lento, 30-60 secondi per lato. Fermati sui punti dolenti 5-10 secondi. Non rotolare veloce. Dopo ogni corsa lunga.', yt:'foam roller quadricipiti it band tutorial italiano' },
        { title:'Foam roller polpacci', muscle:'Gastrocnemio · soleo · tendine Achille', tip:'Sovrapponi una gamba sull\'altra per aumentare il peso. Ruota il piede interno/esterno per coprire tutto il muscolo.', yt:'foam roller polpacci massaggio miofasciale tutorial italiano' },
        { title:'Respirazione diaframmatica (metodo RV)', muscle:'Diaframma · core profondo · sistema nervoso', tip:'Sdraiato, mano sul petto e mano sulla pancia. Inspira gonfiando solo la pancia. Espira lentamente. 5 minuti dopo sessioni intense.', yt:'respirazione diaframmatica tutorial tecnica italiano' },
      ],
    },
    {
      section: 'Mobilità dinamica (pre-gara / warm-up)',
      items: [
        { title:'Leg swing (avanti/dietro e laterali)', muscle:'Flessori/estensori anca · abduttori', tip:'Appoggiati a un muro. Oscillazioni libere e controllate, non forzate. Attiva senza affaticare. Solo dinamica prima della gara.', yt:'leg swing mobilità dinamica anca warm up corsa italiano' },
        { title:'Intrarotazioni anca', muscle:'Rotatori interni anca · glutei medi', tip:'In piedi, ginocchio in su e ruota verso l\'interno. Lento e controllato. Attiva i muscoli stabilizzatori.', yt:'intrarotazione anca mobilità dinamica warm up italiano' },
        { title:'A-skip (skip leggero)', muscle:'Flessori anca · polpacci · coordinazione', tip:'Ginocchio in alto, piede di spinta che si estende. Ritmico e leggero. 2×20 metri bastano come attivazione pre-gara.', yt:'skip corsa esercizio riscaldamento a-skip tutorial italiano' },
      ],
    },
  ],
  corsa: [
    {
      section: 'Tecnica e metodo',
      items: [
        { title:'Respirazione nasale durante la corsa', muscle:'Tecnica respiratoria · controllo intensità', tip:'Cardine del metodo RV: se non riesci a respirare solo dal naso, stai andando troppo forte. Rallenta finché non la mantieni. Migliora l\'efficienza aerobica.', yt:'respirazione nasale corsa metodo tecnica tutorial italiano' },
        { title:'Strides (accelerazioni controllate)', muscle:'Fibre veloci · tecnica di passo', tip:'20 secondi a ritmo gara o leggermente più veloce, poi cammina 60 secondi. Nelle settimane di scarico: tengono vive le fibre veloci senza accumulare fatica.', yt:'strides accelerazioni corsa tecnica tutorial italiano' },
        { title:'Tecnica di corsa in salita', muscle:'Postura · braccia · frequenza passi', tip:'Busto leggermente in avanti, passi più corti, braccia che pompano. Non tentare di mantenere la stessa velocità in piano.', yt:'tecnica corsa salita tutorial italiano montagna' },
        { title:'Run/walk — strategia gara', muscle:'Gestione fatica · tattica', tip:'8\' corsa + 2\' cammino: strategia valida se non si arriva al Lv 10. Il cammino non è fallimento — è tattica. Spesso si finisce più veloci che correndo tutto di fila al limite.', yt:'run walk strategia gara 10km tutorial italiano' },
      ],
    },
  ],
};

/* ══════════════════════════════════════════════════════════
   LOGICA APP
══════════════════════════════════════════════════════════ */

/* Settimane del piano corrente */
function weeksForPiano(pid) {
  return WEEKS.filter(w => w.piano === pid);
}

let currentPiano = PIANI.find(p => p.current)?.id || PIANI[0].id;
let currentWeekIdx = 0;
let currentExCat = 'forza';

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
    const cls = ['cal-day', isRest ? 'rest' : '', day.today ? 'today' : '', day.alt ? 'alt' : ''].filter(Boolean).join(' ');

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

    return `<div class="${cls}">
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
  } catch (e) {
    console.error('Errore caricamento piano:', e);
    document.getElementById('cal-grid').innerHTML = '<p style="color:red;padding:20px">Errore caricamento piano. Apri da un server locale (non direttamente dal filesystem).</p>';
    return;
  }
  await loadWorkoutLog();
  updateCountdown();
  renderWeekTabs();
  renderCalendar();
}

document.addEventListener('DOMContentLoaded', initApp);
