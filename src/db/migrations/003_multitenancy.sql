BEGIN;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_tenant_id TEXT NOT NULL,
  parent_platform_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  plan_code TEXT NOT NULL DEFAULT 'trial',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_platform_id, parent_tenant_id)
);

CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'reviewer', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, auth_user_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES tenant_users(id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

CREATE TABLE IF NOT EXISTS tenant_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  display_name TEXT,
  ciphertext BYTEA NOT NULL,
  encryption_key_id TEXT NOT NULL,
  nonce BYTEA NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_reauth', 'expired', 'revoked')),
  last_used_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, account_id)
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id UUID REFERENCES automation_runs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  payload JSONB NOT NULL,
  context JSONB,
  policy_snapshot JSONB,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  requested_by TEXT NOT NULL,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  resolution_edits JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_tenant_pending
  ON approval_requests(tenant_id, state)
  WHERE state = 'pending';

INSERT INTO tenants (id, parent_tenant_id, parent_platform_id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'legacy',
  'internal',
  'Legacy BeatBand Tenant',
  'legacy-beatband'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE brands ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE brand_plans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE profile_setups ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE competitor_posts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE seo_articles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE video_assets ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE automation_run_steps ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS callback_url TEXT;

UPDATE brands SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE brand_plans SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE campaigns SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE artifacts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE profile_setups SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE competitor_posts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE seo_clusters SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE seo_articles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE video_assets SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE automation_runs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

UPDATE automation_run_steps s
SET tenant_id = r.tenant_id
FROM automation_runs r
WHERE s.tenant_id IS NULL
  AND s.run_id = r.id;

UPDATE automation_run_steps
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE brands ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE brand_plans ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE campaigns ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE artifacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE profile_setups ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE competitor_posts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE seo_clusters ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE seo_articles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE video_assets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE automation_runs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE automation_run_steps ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brands_tenant ON brands(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brand_plans_tenant ON brand_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_tenant ON artifacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profile_setups_tenant ON profile_setups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_competitor_posts_tenant ON competitor_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seo_clusters_tenant ON seo_clusters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seo_articles_tenant ON seo_articles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_tenant ON video_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant ON automation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_run_steps_tenant ON automation_run_steps(tenant_id);
DROP INDEX IF EXISTS idx_automation_runs_brand_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_runs_tenant_idempotency
  ON automation_runs(tenant_id, idempotency_key);

DROP POLICY IF EXISTS "Enable all access for brands" ON brands;
DROP POLICY IF EXISTS "Enable all access for brand_plans" ON brand_plans;
DROP POLICY IF EXISTS "Enable all access for campaigns" ON campaigns;
DROP POLICY IF EXISTS "Enable all access for artifacts" ON artifacts;
DROP POLICY IF EXISTS "Enable all access for profile_setups" ON profile_setups;
DROP POLICY IF EXISTS "Enable all access for competitor_posts" ON competitor_posts;
DROP POLICY IF EXISTS "Enable all access for seo_clusters" ON seo_clusters;
DROP POLICY IF EXISTS "Enable all access for seo_articles" ON seo_articles;
DROP POLICY IF EXISTS "Enable all access for video_assets" ON video_assets;
DROP POLICY IF EXISTS "Enable all access for automation_runs" ON automation_runs;
DROP POLICY IF EXISTS "Enable all access for automation_run_steps" ON automation_run_steps;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_users_self_select ON tenant_users
  FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY tenant_users_admin_manage ON tenant_users
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM tenant_users tu
      WHERE tu.auth_user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

CREATE POLICY tenants_members_select ON tenants
  FOR SELECT
  USING (
    id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY api_keys_tenant_isolation ON api_keys
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY tenant_credentials_tenant_isolation ON tenant_credentials
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY approval_requests_tenant_isolation ON approval_requests
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

CREATE POLICY brands_tenant_isolation ON brands
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY brand_plans_tenant_isolation ON brand_plans
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY campaigns_tenant_isolation ON campaigns
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY artifacts_tenant_isolation ON artifacts
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY profile_setups_tenant_isolation ON profile_setups
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY competitor_posts_tenant_isolation ON competitor_posts
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY seo_clusters_tenant_isolation ON seo_clusters
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY seo_articles_tenant_isolation ON seo_articles
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY video_assets_tenant_isolation ON video_assets
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator')
    )
  );

CREATE POLICY automation_runs_tenant_isolation ON automation_runs
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

CREATE POLICY automation_run_steps_tenant_isolation ON automation_run_steps
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'operator', 'reviewer')
    )
  );

-- Legacy compatibility policy: keep existing unauthenticated dashboard working
-- while still isolating all non-legacy tenants.
CREATE POLICY brands_legacy_public_access ON brands
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY brand_plans_legacy_public_access ON brand_plans
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY campaigns_legacy_public_access ON campaigns
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY artifacts_legacy_public_access ON artifacts
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY profile_setups_legacy_public_access ON profile_setups
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY competitor_posts_legacy_public_access ON competitor_posts
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY seo_clusters_legacy_public_access ON seo_clusters
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY seo_articles_legacy_public_access ON seo_articles
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY video_assets_legacy_public_access ON video_assets
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY automation_runs_legacy_public_access ON automation_runs
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY automation_run_steps_legacy_public_access ON automation_run_steps
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

COMMIT;