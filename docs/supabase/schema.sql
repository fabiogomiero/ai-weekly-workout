-- Piano allenamento: workout log
-- Esegui questo script nell'editor SQL di Supabase

CREATE TABLE IF NOT EXISTS workout_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                 DATE NOT NULL,
  workout_key          TEXT NOT NULL,
  -- NULL = check serale inviato ma senza risposta ancora (beneficio del dubbio mattino)
  status               TEXT CHECK (status IN ('done', 'skipped')),
  reason               TEXT CHECK (reason IN ('tired', 'no_time') OR reason IS NULL),
  adapted_notes        TEXT,
  evening_check_sent   BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Unique index: una riga per (data, workout)
CREATE UNIQUE INDEX IF NOT EXISTS workout_log_date_key
  ON workout_log(date, workout_key);

-- Trigger updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workout_log_updated_at ON workout_log;
CREATE TRIGGER workout_log_updated_at
  BEFORE UPDATE ON workout_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE workout_log ENABLE ROW LEVEL SECURITY;

-- Policy: anon key può leggere/scrivere (app personale, RLS protegge da altri progetti)
DROP POLICY IF EXISTS "allow_all" ON workout_log;
CREATE POLICY "allow_all" ON workout_log
  FOR ALL USING (true) WITH CHECK (true);

-- Aggiunta colonna RPE (Rate of Perceived Exertion, scala 1-10)
-- Esegui questo ALTER se la tabella workout_log è già presente
ALTER TABLE workout_log
  ADD COLUMN IF NOT EXISTS rpe INTEGER CHECK (rpe BETWEEN 1 AND 10);

-- Aggiunta status 'altro' e colonna user_note (per nota libera da Telegram o HTML)
ALTER TABLE workout_log
  DROP CONSTRAINT IF EXISTS workout_log_status_check;
ALTER TABLE workout_log
  ADD CONSTRAINT workout_log_status_check
  CHECK (status IN ('done', 'skipped', 'altro') OR status IS NULL);
ALTER TABLE workout_log
  ADD COLUMN IF NOT EXISTS user_note TEXT;

-- ── EXERCISE CATEGORIES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_categories (
  id          TEXT PRIMARY KEY,   -- 'forza', 'mob', 'corsa'
  label       TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0
);

INSERT INTO exercise_categories (id, label, sort_order) VALUES
  ('forza', 'Forza gambe',   1),
  ('mob',   'Mobilità',      2),
  ('corsa', 'Tecnica corsa', 3)
ON CONFLICT (id) DO NOTHING;

-- ── EXERCISES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   TEXT NOT NULL REFERENCES exercise_categories(id),
  section_title TEXT NOT NULL,
  title         TEXT NOT NULL,
  muscle        TEXT,
  tip           TEXT,
  yt            TEXT,  -- query stringa ricerca YouTube (usata da ytUrl() nell'HTML)
  sort_order    INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS exercises_category_title
  ON exercises(category_id, title);

-- RLS
ALTER TABLE exercise_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON exercise_categories;
CREATE POLICY "allow_all" ON exercise_categories FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON exercises;
CREATE POLICY "allow_all" ON exercises FOR ALL USING (true) WITH CHECK (true);

-- ── SEED DATA ────────────────────────────────────────────────────────────────

-- Forza gambe: 17 esercizi in 1 sezione
INSERT INTO exercises (category_id, section_title, title, muscle, tip, yt, sort_order) VALUES
  ('forza', 'Esercizi principali', 'Squat corpo libero', 'Quadricipiti · glutei · core', 'Piedi larghezza spalle, punte leggermente fuori. Ginocchia seguono le punte. Scendi come su una sedia dietro di te.', 'squat corpo libero esecuzione corretta tutorial italiano', 1),
  ('forza', 'Esercizi principali', 'Squat con pesi (manubri)', 'Quadricipiti · glutei · core', 'Manubri ai fianchi o sulle spalle. Stessa meccanica del corpo libero. Tronco eretto, schiena neutra.', 'squat con manubri esecuzione corretta tutorial italiano', 2),
  ('forza', 'Esercizi principali', 'Squat con elastico (intorno alle cosce)', 'Quadricipiti · glutei medi · abduttori', 'Mini-band intorno alle cosce. Spingi le ginocchia fuori durante tutto il movimento. Attiva i glutei medi spesso trascurati.', 'squat elastico mini band tutorial italiano gambe', 3),
  ('forza', 'Esercizi principali', 'Affondi alternati', 'Quadricipiti · glutei · femorali', 'Passo ampio, ginocchio posteriore sfiora il pavimento. Ginocchio anteriore non supera la punta del piede. Busto eretto.', 'affondi alternati esecuzione corretta tutorial italiano', 4),
  ('forza', 'Esercizi principali', 'Affondi cammino con elastico', 'Quadricipiti · glutei · stabilizzatori', 'Elastico intorno alle cosce per attivare i glutei medi. Avanza passo dopo passo mantenendo la tensione laterale.', 'affondi camminati elastico tutorial esecuzione italiano', 5),
  ('forza', 'Esercizi principali', 'Step-up su sedia', 'Quadricipiti · glutei · equilibrio', 'Spingi con il tallone del piede sul gradino, non con la punta. Porta la coscia opposta in alto. Fondamentale per la montagna.', 'step up sedia esercizio gambe tutorial italiano', 6),
  ('forza', 'Esercizi principali', 'Step-up con pesi', 'Quadricipiti · glutei · femorali', 'Stessa meccanica dello step-up base. I manubri aumentano il carico senza cambiare il gesto. Altezza gradino: coscia parallela al suolo.', 'step up manubri gradino tutorial italiano', 7),
  ('forza', 'Esercizi principali', 'Bulgarian split squat', 'Quadricipiti · glutei · stabilizzatori caviglia', 'Piede posteriore su sedia. Scendi verticalmente, non in avanti. L''esercizio più specifico per la salita in montagna.', 'bulgarian split squat tutorial italiano esecuzione corretta', 8),
  ('forza', 'Esercizi principali', 'Hip hinge / Romanian deadlift', 'Femorali · glutei · erettori schiena', 'Busto in avanti con schiena piatta, bacino indietro. Ginocchia si piegano poco. Senti l''allungamento dei femorali.', 'hip hinge deadlift rumeno manubri tutorial italiano', 9),
  ('forza', 'Esercizi principali', 'RDL monogamba (single-leg deadlift)', 'Femorali · glutei · propriocezione', 'Equilibrio su una gamba. Busto avanza, gamba libera sale dietro. Essenziale per prevenire distorsioni in discesa.', 'single leg deadlift monogamba tutorial italiano esecuzione', 10),
  ('forza', 'Esercizi principali', 'Glute bridge', 'Glutei · core · femorali', 'Schiena a terra, piedi vicini ai glutei. Spingi i fianchi in alto, spremi i glutei in cima. Tieni 1-2 secondi.', 'glute bridge esecuzione corretta tutorial italiano', 11),
  ('forza', 'Esercizi principali', 'Glute bridge monogamba', 'Glutei · stabilizzatori · core', 'Una gamba tesa in aria. Richiede stabilità del bacino. Corregge asimmetrie tra i lati.', 'glute bridge monogamba single leg tutorial italiano', 12),
  ('forza', 'Esercizi principali', 'Glute bridge con elastico', 'Glutei medi · abduttori', 'Mini-band sopra le ginocchia. Spingi le ginocchia fuori mentre sali. Attiva i glutei medi (previene il valgismo).', 'glute bridge elastico mini band tutorial gambe italiano', 13),
  ('forza', 'Esercizi principali', 'Wall sit', 'Quadricipiti · resistenza isometrica', 'Schiena al muro, cosce parallele al suolo, ginocchia a 90°. Esercizio isometrico: simula l''affaticamento della discesa prolungata.', 'wall sit esercizio isometrico tutorial italiano', 14),
  ('forza', 'Esercizi principali', 'Calf raise (in piedi)', 'Polpacci (gastrocnemio)', 'Sali sulle punte lentamente, scendi lentamente. Su un gradino per maggiore escursione. Fondamentale per corsa e discesa.', 'calf raise polpacci tutorial italiano esecuzione gradino', 15),
  ('forza', 'Esercizi principali', 'Single-leg calf raise', 'Polpacci · stabilità caviglia', 'Una gamba sola. Molto più difficile del bilaterale. Inizia appoggiandoti a un muro. Progressione naturale del calf raise.', 'single leg calf raise monogamba polpacci tutorial italiano', 16),
  ('forza', 'Esercizi principali', 'Box jump basso', 'Potenza gambe · reattività', 'Gradino basso 20-30 cm. Atterraggio morbido con ginocchia flesse, mai rigido. Solo settimana 3 di picco.', 'box jump basso tutorial esecuzione sicura italiano', 17)
ON CONFLICT (category_id, title) DO NOTHING;

-- Mobilità: 13 esercizi in 4 sezioni
INSERT INTO exercises (category_id, section_title, title, muscle, tip, yt, sort_order) VALUES
  ('mob', 'Mobilità anca e catena posteriore', 'World lunge', 'Flessori anca · adduttori · torace', 'Affondo lungo, mano a terra lato piede anteriore, poi ruota il busto aprendo il braccio verso il soffitto. Uno dei migliori esercizi di mobilità globale.', 'world lunge mobilità anca tutorial italiano', 1),
  ('mob', 'Mobilità anca e catena posteriore', '90/90 stretch', 'Rotatori interni/esterni anca · piriforme', 'Seduto a terra, entrambe le gambe a 90°. Schiena dritta. Inclinati in avanti sulla gamba anteriore. Per chi porta il peso dello zaino.', '90 90 hip stretch mobilità anca tutorial italiano', 2),
  ('mob', 'Mobilità anca e catena posteriore', 'Piriforme stretch', 'Piriforme · rotatori profondi anca', 'Sdraiato, porta il piede sul ginocchio opposto (figura 4). Tira la coscia verso il petto. Allevia il dolore al nervo sciatico da affaticamento.', 'piriforme stretch sciatico tutorial italiano', 3),
  ('mob', 'Mobilità anca e catena posteriore', 'Ileopsoas stretch', 'Flessori anca · ileopsoas', 'Affondo basso, ginocchio posteriore a terra. Spingi il bacino in avanti e in basso. Contrasta l''accorciamento da corsa e postura seduta.', 'ileopsoas stretch flessori anca tutorial italiano', 4),
  ('mob', 'Mobilità caviglia e polpacci', 'Pompate caviglia in downward dog', 'Polpacci · tendine di Achille · caviglia', 'Posizione cane verso il basso. Alterna il tallone al suolo lentamente su ogni lato. Fondamentale dopo corsa e discesa.', 'downward dog pompate polpacci mobilità caviglia tutorial', 5),
  ('mob', 'Mobilità caviglia e polpacci', 'Mobilità caviglia a muro', 'Articolazione tibiotarsica · peronei', 'Piede vicino al muro, spingi il ginocchio verso il muro senza alzare il tallone. Aumenta la distanza progressivamente.', 'mobilità caviglia muro tutorial ankle mobility italiano', 6),
  ('mob', 'Mobilità caviglia e polpacci', 'Single-leg deadlift leggerissimo (propriocezione)', 'Propriocezione caviglia · femorali · equilibrio', 'Peso minimo o corpo libero, lentissimo. L''obiettivo è allenare i recettori della caviglia per terreno irregolare.', 'single leg deadlift propriocezione equilibrio tutorial', 7),
  ('mob', 'Recupero miofasciale', 'Foam roller quadricipiti', 'Quadricipiti · fascia lata · IT-band', 'Lento, 30-60 secondi per lato. Fermati sui punti dolenti 5-10 secondi. Non rotolare veloce. Dopo ogni corsa lunga.', 'foam roller quadricipiti it band tutorial italiano', 8),
  ('mob', 'Recupero miofasciale', 'Foam roller polpacci', 'Gastrocnemio · soleo · tendine Achille', 'Sovrapponi una gamba sull''altra per aumentare il peso. Ruota il piede interno/esterno per coprire tutto il muscolo.', 'foam roller polpacci massaggio miofasciale tutorial italiano', 9),
  ('mob', 'Recupero miofasciale', 'Respirazione diaframmatica (metodo RV)', 'Diaframma · core profondo · sistema nervoso', 'Sdraiato, mano sul petto e mano sulla pancia. Inspira gonfiando solo la pancia. Espira lentamente. 5 minuti dopo sessioni intense.', 'respirazione diaframmatica tutorial tecnica italiano', 10),
  ('mob', 'Mobilità dinamica (pre-gara / warm-up)', 'Leg swing (avanti/dietro e laterali)', 'Flessori/estensori anca · abduttori', 'Appoggiati a un muro. Oscillazioni libere e controllate, non forzate. Attiva senza affaticare. Solo dinamica prima della gara.', 'leg swing mobilità dinamica anca warm up corsa italiano', 11),
  ('mob', 'Mobilità dinamica (pre-gara / warm-up)', 'Intrarotazioni anca', 'Rotatori interni anca · glutei medi', 'In piedi, ginocchio in su e ruota verso l''interno. Lento e controllato. Attiva i muscoli stabilizzatori.', 'intrarotazione anca mobilità dinamica warm up italiano', 12),
  ('mob', 'Mobilità dinamica (pre-gara / warm-up)', 'A-skip (skip leggero)', 'Flessori anca · polpacci · coordinazione', 'Ginocchio in alto, piede di spinta che si estende. Ritmico e leggero. 2×20 metri bastano come attivazione pre-gara.', 'skip corsa esercizio riscaldamento a-skip tutorial italiano', 13)
ON CONFLICT (category_id, title) DO NOTHING;

-- Tecnica corsa: 4 esercizi in 1 sezione
INSERT INTO exercises (category_id, section_title, title, muscle, tip, yt, sort_order) VALUES
  ('corsa', 'Tecnica e metodo', 'Respirazione nasale durante la corsa', 'Tecnica respiratoria · controllo intensità', 'Cardine del metodo RV: se non riesci a respirare solo dal naso, stai andando troppo forte. Rallenta finché non la mantieni. Migliora l''efficienza aerobica.', 'respirazione nasale corsa metodo tecnica tutorial italiano', 1),
  ('corsa', 'Tecnica e metodo', 'Strides (accelerazioni controllate)', 'Fibre veloci · tecnica di passo', '20 secondi a ritmo gara o leggermente più veloce, poi cammina 60 secondi. Nelle settimane di scarico: tengono vive le fibre veloci senza accumulare fatica.', 'strides accelerazioni corsa tecnica tutorial italiano', 2),
  ('corsa', 'Tecnica e metodo', 'Tecnica di corsa in salita', 'Postura · braccia · frequenza passi', 'Busto leggermente in avanti, passi più corti, braccia che pompano. Non tentare di mantenere la stessa velocità in piano.', 'tecnica corsa salita tutorial italiano montagna', 3),
  ('corsa', 'Tecnica e metodo', 'Run/walk — strategia gara', 'Gestione fatica · tattica', '8'' corsa + 2'' cammino: strategia valida se non si arriva al Lv 10. Il cammino non è fallimento — è tattica. Spesso si finisce più veloci che correndo tutto di fila al limite.', 'run walk strategia gara 10km tutorial italiano', 4)
ON CONFLICT (category_id, title) DO NOTHING;
