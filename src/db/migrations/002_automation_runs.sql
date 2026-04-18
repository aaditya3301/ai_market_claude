-- ============================================================
-- AADI MARKET — Automation Run State Schema
-- ============================================================

-- 10. Automation Runs
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  brand_id TEXT REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('full', 'guided', 'simulation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'canceled')),
  idempotency_key TEXT NOT NULL,
  input_payload JSONB DEFAULT '{}'::jsonb,
  output_payload JSONB DEFAULT '{}'::jsonb,
  error_summary TEXT,
  current_step TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_runs_brand_idempotency
  ON automation_runs(brand_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_automation_runs_brand_created
  ON automation_runs(brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_status
  ON automation_runs(status);

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for automation_runs" ON automation_runs FOR ALL USING (true);

-- 11. Automation Run Steps
CREATE TABLE IF NOT EXISTS automation_run_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  run_id UUID REFERENCES automation_runs(id) ON DELETE CASCADE NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'awaiting_approval')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lock_token TEXT,
  locked_until TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  error_detail TEXT,
  output_payload JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_steps_run_step
  ON automation_run_steps(run_id, step_name);

CREATE INDEX IF NOT EXISTS idx_automation_steps_status
  ON automation_run_steps(status);

CREATE INDEX IF NOT EXISTS idx_automation_steps_lock_window
  ON automation_run_steps(locked_until);

ALTER TABLE automation_run_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for automation_run_steps" ON automation_run_steps FOR ALL USING (true);
