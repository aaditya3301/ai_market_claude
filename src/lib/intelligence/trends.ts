import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase';
import { llmRouter } from '@/lib/llm/router';
import { scrapeUrl } from '@/lib/scraper-service';
import { getTenantSettings } from '@/lib/intelligence/tenants';

function normalizeTopicList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 1)
    .slice(0, 20);
}

async function deriveTopicsFromPlans(tenantId: string): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('brand_plans')
    .select('product_name,product_description,ai_research_result')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(3);

  const topics = new Set<string>();

  for (const row of data || []) {
    const productName = String(row.product_name || '').trim();
    if (productName) topics.add(productName);

    const ai = (row.ai_research_result as Record<string, unknown> | null) || {};
    const pillars = Array.isArray(ai.content_pillars) ? ai.content_pillars : [];

    for (const pillar of pillars) {
      const pillarName = String((pillar as Record<string, unknown>).name || '').trim();
      if (pillarName) topics.add(pillarName);
    }
  }

  return Array.from(topics).slice(0, 10);
}

async function analyzeTrendSignal(params: {
  tenantId: string;
  term: string;
  source: string;
  evidence: string;
}): Promise<{ magnitude: number; relatedTerms: string[]; score: number; summary: string }> {
  const response = await llmRouter.call<Record<string, unknown>>({
    tenantId: params.tenantId,
    task: 'classification',
    responseFormat: 'json',
    messages: [
      {
        role: 'system',
        content:
          'Extract trend signal from evidence and return JSON keys: magnitude(0-100), related_terms(string[]), score(0-1), summary.',
      },
      {
        role: 'user',
        content: `Term: ${params.term}\nSource: ${params.source}\nEvidence:\n${params.evidence.slice(0, 5000)}`,
      },
    ],
  });

  const data = response.data || {};
  return {
    magnitude: Number(data.magnitude || 0),
    relatedTerms: Array.isArray(data.related_terms) ? data.related_terms.map(String).slice(0, 10) : [],
    score: Number(data.score || 0),
    summary: String(data.summary || ''),
  };
}

export async function detectTrendSignalsForTenant(tenantId: string): Promise<{ inserted: number }> {
  const settings = await getTenantSettings(tenantId);
  const fromSettings = normalizeTopicList((settings.trend_topics as unknown) || []);
  const topics = fromSettings.length > 0 ? fromSettings : await deriveTopicsFromPlans(tenantId);

  if (topics.length === 0) {
    return { inserted: 0 };
  }

  const supabase = createServiceRoleClient();
  let inserted = 0;

  for (const topic of topics.slice(0, 10)) {
    const trendUrl = `https://trends.google.com/trends/explore?q=${encodeURIComponent(topic)}`;
    const redditUrl = `https://www.reddit.com/search/?q=${encodeURIComponent(topic)}`;

    const [google, reddit] = await Promise.all([scrapeUrl(trendUrl), scrapeUrl(redditUrl)]);

    const sources = [
      { source: 'google_trends', text: google.text },
      { source: 'reddit', text: reddit.text },
    ].filter((item) => item.text && item.text.length > 40);

    for (const source of sources) {
      const analyzed = await analyzeTrendSignal({
        tenantId,
        term: topic,
        source: source.source,
        evidence: source.text,
      });

      if (!Number.isFinite(analyzed.score) || analyzed.score <= 0) {
        continue;
      }

      const now = new Date();
      const windowStart = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();

      const { error } = await supabase
        .from('trend_signals')
        .insert({
          tenant_id: tenantId,
          source: source.source,
          term: topic,
          magnitude: analyzed.magnitude,
          window_start: windowStart,
          window_end: now.toISOString(),
          related_terms: analyzed.relatedTerms,
          sample_evidence: {
            summary: analyzed.summary,
          },
          score: analyzed.score,
        });

      if (!error) inserted += 1;
    }
  }

  return { inserted };
}
