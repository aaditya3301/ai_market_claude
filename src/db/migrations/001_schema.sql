-- ============================================================
-- AADI MARKET — Complete Database Schema
-- ============================================================

-- 1. Brands (Multi-tenancy)
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  brand_voice JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for brands" ON brands FOR ALL USING (true);

-- 2. Brand Plans (AI Research Output)
CREATE TABLE IF NOT EXISTS brand_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  brand_id TEXT REFERENCES brands(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_description TEXT NOT NULL,
  product_price TEXT,
  duration TEXT DEFAULT '3 months',
  ai_research_result JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE brand_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for brand_plans" ON brand_plans FOR ALL USING (true);

-- 3. Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  brand_plan_id UUID REFERENCES brand_plans(id) ON DELETE CASCADE NOT NULL,
  brand_id TEXT,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  social_platforms TEXT[] DEFAULT '{}',
  ad_budget TEXT,
  ad_targeting JSONB DEFAULT '{}'::jsonb,
  ad_status TEXT DEFAULT 'none' CHECK (ad_status IN ('none', 'draft', 'running', 'paused', 'completed')),
  instagram_url TEXT,
  twitter_url TEXT,
  linkedin_url TEXT,
  facebook_url TEXT
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for campaigns" ON campaigns FOR ALL USING (true);

-- 4. Artifacts (Generated Content)
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'post',
  text_content TEXT,
  image_prompt TEXT,
  media_url TEXT,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'scheduled', 'published')),
  is_ad BOOLEAN DEFAULT false,
  ad_headline TEXT,
  ad_cta TEXT,
  metrics JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for artifacts" ON artifacts FOR ALL USING (true);

-- 5. Profile Setups
CREATE TABLE IF NOT EXISTS profile_setups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  brand_id TEXT,
  platform TEXT NOT NULL,
  bio TEXT,
  tagline TEXT,
  handle_suggestions TEXT[] DEFAULT '{}',
  dp_prompt TEXT,
  dp_url TEXT,
  cover_prompt TEXT,
  cover_url TEXT
);

ALTER TABLE profile_setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for profile_setups" ON profile_setups FOR ALL USING (true);

-- 6. Competitor Posts (Analytics)
CREATE TABLE IF NOT EXISTS competitor_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'instagram',
  url TEXT,
  owner_username TEXT,
  caption TEXT,
  media_url TEXT,
  media_type TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT competitor_posts_ext_id_campaign_key UNIQUE (external_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_competitor_posts_external_id ON competitor_posts(external_id);
CREATE INDEX IF NOT EXISTS idx_competitor_posts_username ON competitor_posts(owner_username);

ALTER TABLE competitor_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for competitor_posts" ON competitor_posts FOR ALL USING (true);

-- 7. SEO Topic Clusters
CREATE TABLE IF NOT EXISTS seo_clusters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  brand_id TEXT,
  seed_keyword TEXT NOT NULL,
  hub_topic TEXT,
  cluster_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'writing', 'completed'))
);

ALTER TABLE seo_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for seo_clusters" ON seo_clusters FOR ALL USING (true);

-- 8. SEO Articles
CREATE TABLE IF NOT EXISTS seo_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  cluster_id UUID REFERENCES seo_clusters(id) ON DELETE CASCADE NOT NULL,
  spoke_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  target_keyword TEXT,
  meta_description TEXT,
  content TEXT,
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'drafted', 'published'))
);

ALTER TABLE seo_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for seo_articles" ON seo_articles FOR ALL USING (true);

-- 9. Video Assets
CREATE TABLE IF NOT EXISTS video_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL,
  script_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'rendered', 'published')),
  video_url TEXT
);

ALTER TABLE video_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for video_assets" ON video_assets FOR ALL USING (true);
