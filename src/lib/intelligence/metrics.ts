import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase';
import { llmRouter } from '@/lib/llm/router';
import { logger } from '@/lib/runtime/logger';

interface ArtifactMetricRow {
  artifact_id: string;
  platform: string;
  impressions: number;
  engagements: number;
  clicks: number;
  saves: number;
  measured_at: string;
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeRawScore(row: ArtifactMetricRow): number {
  const impressions = Math.max(1, row.impressions);
  const er = row.engagements / impressions;
  const ctr = row.clicks / impressions;
  const saveRate = row.saves / impressions;

  const weights = row.platform === 'linkedin'
    ? { er: 0.5, ctr: 0.35, save: 0.15 }
    : row.platform === 'instagram'
      ? { er: 0.55, ctr: 0.2, save: 0.25 }
      : { er: 0.45, ctr: 0.4, save: 0.15 };

  return weights.er * er + weights.ctr * ctr + weights.save * saveRate;
}

function percentileFor(sortedValues: number[], value: number): number {
  if (sortedValues.length === 0) return 0;
  const index = sortedValues.findIndex((item) => item >= value);
  const rank = index === -1 ? sortedValues.length : index + 1;
  return rank / sortedValues.length;
}

export async function refreshArtifactMetricsForTenant(tenantId: string): Promise<{ inserted: number }> {
  const supabase = createServiceRoleClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data: recentRows } = await supabase
    .from('artifact_metrics')
    .select('artifact_id')
    .eq('tenant_id', tenantId)
    .gte('measured_at', since);

  const recentArtifactIds = new Set((recentRows || []).map((row) => String(row.artifact_id)));

  const { data: artifacts, error } = await supabase
    .from('artifacts')
    .select('id,platform,metrics')
    .eq('tenant_id', tenantId)
    .not('metrics', 'is', null)
    .limit(500);

  if (error) throw new Error(error.message);

  const now = new Date().toISOString();
  const inserts = (artifacts || [])
    .filter((artifact) => !recentArtifactIds.has(String(artifact.id)))
    .map((artifact) => {
      const metrics = (artifact.metrics as Record<string, unknown> | null) || {};
      return {
        tenant_id: tenantId,
        artifact_id: artifact.id,
        platform: String(artifact.platform || 'unknown'),
        measured_at: now,
        impressions: asNumber(metrics.impressions),
        reach: asNumber(metrics.reach),
        engagements: asNumber(metrics.engagements),
        clicks: asNumber(metrics.clicks),
        saves: asNumber(metrics.saves),
        shares: asNumber(metrics.shares),
        comments: asNumber(metrics.comments),
        video_completions: asNumber(metrics.video_completions),
        conversions: asNumber(metrics.conversions),
        revenue_cents: asNumber(metrics.revenue_cents),
        raw: metrics,
        source: 'artifact_snapshot',
        is_simulated: true,
      };
    })
    .filter((row) => row.impressions > 0 || row.engagements > 0 || row.clicks > 0 || row.saves > 0);

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from('artifact_metrics').insert(inserts);
    if (insertError) throw new Error(insertError.message);
  }

  return { inserted: inserts.length };
}

export async function scoreArtifactsForTenant(tenantId: string): Promise<{ scored: number }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('artifact_metrics')
    .select('artifact_id,platform,impressions,engagements,clicks,saves,measured_at')
    .eq('tenant_id', tenantId)
    .order('measured_at', { ascending: false })
    .limit(1000);

  if (error) throw new Error(error.message);

  const latestMap = new Map<string, ArtifactMetricRow>();

  for (const row of data || []) {
    const key = `${row.artifact_id}:${row.platform}`;
    if (latestMap.has(key)) continue;
    latestMap.set(key, {
      artifact_id: String(row.artifact_id),
      platform: String(row.platform),
      impressions: asNumber(row.impressions),
      engagements: asNumber(row.engagements),
      clicks: asNumber(row.clicks),
      saves: asNumber(row.saves),
      measured_at: String(row.measured_at),
    });
  }

  const rows = Array.from(latestMap.values());
  if (rows.length === 0) return { scored: 0 };

  const rawScores = rows.map(computeRawScore);
  const sorted = [...rawScores].sort((a, b) => a - b);

  const upserts = rows.map((row, index) => {
    const score = rawScores[index];
    const percentile = percentileFor(sorted, score);
    const label = percentile >= 0.8 ? 'winner' : percentile <= 0.2 ? 'loser' : 'neutral';

    return {
      tenant_id: tenantId,
      artifact_id: row.artifact_id,
      platform: row.platform,
      score,
      percentile,
      label,
      model_version: 'phase2_v1',
      computed_at: new Date().toISOString(),
    };
  });

  const { error: upsertError } = await supabase
    .from('artifact_scores')
    .upsert(upserts, { onConflict: 'tenant_id,artifact_id,platform' });

  if (upsertError) throw new Error(upsertError.message);

  return { scored: upserts.length };
}

export async function extractWinnerFeaturesForTenant(tenantId: string): Promise<{ extracted: number }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('artifact_scores')
    .select('artifact_id,platform,percentile,artifacts(text_content,image_prompt)')
    .eq('tenant_id', tenantId)
    .eq('label', 'winner')
    .order('percentile', { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return { extracted: 0 };

  let extracted = 0;

  for (const row of data) {
    const artifact = row.artifacts as { text_content?: string; image_prompt?: string } | null;
    const text = (artifact?.text_content || '').slice(0, 3000);

    if (!text) continue;

    const result = await llmRouter.call<Record<string, unknown>>({
      tenantId,
      task: 'feature_extraction',
      responseFormat: 'json',
      messages: [
        {
          role: 'system',
          content:
            'Extract concise marketing features for this post and return only JSON with keys: hook_type, structure, tone_markers, topics, cta_present, cta_style, length_bucket, uses_emoji, uses_hashtags, visual_style.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
    });

    const payload = result.data || {};

    const { error: upsertError } = await supabase
      .from('artifact_features')
      .upsert(
        {
          tenant_id: tenantId,
          artifact_id: row.artifact_id,
          hook_type: String(payload.hook_type || ''),
          structure: String(payload.structure || ''),
          tone_markers: Array.isArray(payload.tone_markers) ? payload.tone_markers : [],
          topics: Array.isArray(payload.topics) ? payload.topics : [],
          cta_present: Boolean(payload.cta_present),
          cta_style: String(payload.cta_style || ''),
          length_bucket: String(payload.length_bucket || ''),
          uses_emoji: Boolean(payload.uses_emoji),
          uses_hashtags: Boolean(payload.uses_hashtags),
          visual_style: String(payload.visual_style || ''),
          extraction_model: result.model,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,artifact_id' }
      );

    if (upsertError) {
      logger.warn({ msg: 'features.extract.failed', tenant_id: tenantId, artifact_id: row.artifact_id, error: upsertError.message });
      continue;
    }

    extracted += 1;
  }

  return { extracted };
}
