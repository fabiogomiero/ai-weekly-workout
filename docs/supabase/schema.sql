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
