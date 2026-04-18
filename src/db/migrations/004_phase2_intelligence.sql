BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id TEXT REFERENCES brands(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_type, source_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tenant_source
  ON knowledge_chunks(tenant_id, source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tenant_created
  ON knowledge_chunks(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  p_tenant_id UUID,
  p_embedding VECTOR(768),
  p_source_types TEXT[] DEFAULT NULL,
  p_k INTEGER DEFAULT 12
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id TEXT,
  source_url TEXT,
  content TEXT,
  metadata JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    kc.id,
    kc.source_type,
    kc.source_id,
    kc.source_url,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> p_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.tenant_id = p_tenant_id
    AND kc.embedding IS NOT NULL
    AND (p_source_types IS NULL OR kc.source_type = ANY(p_source_types))
  ORDER BY kc.embedding <=> p_embedding
  LIMIT GREATEST(1, LEAST(COALESCE(p_k, 12), 50));
$$;

CREATE TABLE IF NOT EXISTS artifact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL,
  impressions BIGINT,
  reach BIGINT,
  engagements BIGINT,
  clicks BIGINT,
  saves BIGINT,
  shares BIGINT,
  comments BIGINT,
  video_completions BIGINT,
  conversions BIGINT,
  revenue_cents BIGINT,
  raw JSONB,
  source TEXT NOT NULL,
  is_simulated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifact_metrics_artifact_time
  ON artifact_metrics(artifact_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_metrics_tenant_platform
  ON artifact_metrics(tenant_id, platform, measured_at DESC);

CREATE TABLE IF NOT EXISTS artifact_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  score NUMERIC NOT NULL,
  percentile NUMERIC NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('winner', 'neutral', 'loser')),
  model_version TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, artifact_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_artifact_scores_tenant_platform
  ON artifact_scores(tenant_id, platform, percentile DESC);

CREATE TABLE IF NOT EXISTS artifact_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  hook_type TEXT,
  structure TEXT,
  tone_markers TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  cta_present BOOLEAN,
  cta_style TEXT,
  length_bucket TEXT,
  uses_emoji BOOLEAN,
  uses_hashtags BOOLEAN,
  visual_style TEXT,
  extraction_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_artifact_features_tenant_topics
  ON artifact_features(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  website TEXT,
  handles JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta_ad_library_id TEXT,
  monitoring_enabled BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitors_tenant
  ON competitors(tenant_id, monitoring_enabled);

CREATE TABLE IF NOT EXISTS competitor_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  observation_type TEXT NOT NULL,
  source TEXT NOT NULL,
  external_id TEXT,
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_competitor_observations_tenant_source
  ON competitor_observations(tenant_id, source, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_observations_embedding
  ON competitor_observations USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS competitor_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_ids UUID[] NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'acknowledged', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitor_alerts_tenant_state
  ON competitor_alerts(tenant_id, state, created_at DESC);

CREATE TABLE IF NOT EXISTS trend_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  term TEXT NOT NULL,
  magnitude NUMERIC NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  related_terms TEXT[] DEFAULT '{}',
  sample_evidence JSONB,
  score NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trend_signals_tenant_score
  ON trend_signals(tenant_id, score DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS llm_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id UUID REFERENCES automation_runs(id) ON DELETE SET NULL,
  task TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_cents NUMERIC(12,4) NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_code TEXT,
  prompt_hash TEXT,
  cached BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_tenant_month
  ON llm_calls(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_calls_tenant_task
  ON llm_calls(tenant_id, task, created_at DESC);

CREATE TABLE IF NOT EXISTS war_room_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id UUID REFERENCES automation_runs(id) ON DELETE SET NULL,
  plan_snapshot JSONB NOT NULL,
  output JSONB NOT NULL,
  transcript JSONB NOT NULL,
  evidence_refs JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_war_room_sessions_tenant
  ON war_room_sessions(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id UUID REFERENCES automation_runs(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  state_key TEXT NOT NULL,
  checkpoint JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, run_id, agent_name, state_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_tenant
  ON agent_checkpoints(tenant_id, agent_name, created_at DESC);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_room_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_chunks_tenant_isolation ON knowledge_chunks
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY artifact_metrics_tenant_isolation ON artifact_metrics
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY artifact_scores_tenant_isolation ON artifact_scores
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY artifact_features_tenant_isolation ON artifact_features
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY competitors_tenant_isolation ON competitors
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

CREATE POLICY competitor_observations_tenant_isolation ON competitor_observations
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

CREATE POLICY competitor_alerts_tenant_isolation ON competitor_alerts
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

CREATE POLICY trend_signals_tenant_isolation ON trend_signals
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

CREATE POLICY llm_calls_tenant_isolation ON llm_calls
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

CREATE POLICY war_room_sessions_tenant_isolation ON war_room_sessions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

CREATE POLICY agent_checkpoints_tenant_isolation ON agent_checkpoints
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

COMMIT;
