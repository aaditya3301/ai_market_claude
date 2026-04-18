import 'server-only';
import { createHash } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase';
import { llmRouter } from '@/lib/llm/router';
import { scrapeCompetitor } from '@/lib/apify-service';
import { getTenantSettings } from '@/lib/intelligence/tenants';

function buildExternalId(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

function normalizeHandles(raw: unknown): Array<{ source: string; handle: string }> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];

  const entries = Object.entries(raw as Record<string, unknown>);
  return entries
    .map(([source, value]) => ({ source, handle: String(value || '').trim() }))
    .filter((row) => row.handle.length > 0);
}

async function classifyObservation(params: {
  tenantId: string;
  competitorName: string;
  source: string;
  content: string;
}): Promise<{ alertType: string; severity: 'low' | 'medium' | 'high'; title: string; summary: string }> {
  const result = await llmRouter.call<Record<string, unknown>>({
    tenantId: params.tenantId,
    task: 'classification',
    responseFormat: 'json',
    messages: [
      {
        role: 'system',
        content:
          'Classify competitor observation novelty. Return JSON keys: alert_type, severity(low|medium|high), title, summary.',
      },
      {
        role: 'user',
        content: `Competitor: ${params.competitorName}\nSource: ${params.source}\nObservation:\n${params.content.slice(0, 3000)}`,
      },
    ],
  });

  const data = result.data || {};

  const severityRaw = String(data.severity || 'low').toLowerCase();
  const severity = severityRaw === 'high' || severityRaw === 'medium' ? severityRaw : 'low';

  return {
    alertType: String(data.alert_type || 'content_shift'),
    severity,
    title: String(data.title || `${params.competitorName} update on ${params.source}`),
    summary: String(data.summary || 'New competitor content detected.'),
  };
}

export async function scanCompetitorsForTenant(tenantId: string): Promise<{ observations: number; alerts: number }> {
  const settings = await getTenantSettings(tenantId);
  const maxCompetitors = Number((settings.competitor_policy as Record<string, unknown> | undefined)?.max_competitors || 10);

  const supabase = createServiceRoleClient();
  const { data: competitors, error } = await supabase
    .from('competitors')
    .select('id,name,website,handles')
    .eq('tenant_id', tenantId)
    .eq('monitoring_enabled', true)
    .limit(Math.max(1, Math.min(maxCompetitors, 25)));

  if (error) throw new Error(error.message);
  if (!competitors || competitors.length === 0) return { observations: 0, alerts: 0 };

  let observations = 0;
  let alerts = 0;

  for (const competitor of competitors) {
    const handles = normalizeHandles(competitor.handles);
    const targets = handles.length > 0 ? handles : [{ source: 'website', handle: String(competitor.website || '').trim() }];

    for (const target of targets) {
      if (!target.handle) continue;

      const snapshot = await scrapeCompetitor(target.source, target.handle);
      const content = JSON.stringify(snapshot);
      const externalId = buildExternalId([
        String(competitor.id),
        target.source,
        target.handle,
        content.slice(0, 1000),
      ]);

      const embeddingRaw = await llmRouter.embed({ tenantId, text: content.slice(0, 7000) });
      const embedding = Array.isArray(embeddingRaw) ? embeddingRaw : [];
      const embeddingLiteral = embedding.length > 0 ? `[${embedding.join(',')}]` : null;

      const { data: row, error: upsertError } = await supabase
        .from('competitor_observations')
        .upsert(
          {
            tenant_id: tenantId,
            competitor_id: competitor.id,
            observation_type: 'post',
            source: target.source,
            external_id: externalId,
            content,
            metadata: {
              handle: target.handle,
              source_payload: snapshot,
            },
            detected_at: new Date().toISOString(),
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            embedding: embeddingLiteral,
          },
          { onConflict: 'competitor_id,source,external_id' }
        )
        .select('id')
        .maybeSingle();

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      observations += 1;

      const classification = await classifyObservation({
        tenantId,
        competitorName: String(competitor.name || 'competitor'),
        source: target.source,
        content,
      });

      if (classification.severity === 'medium' || classification.severity === 'high') {
        const { error: alertError } = await supabase
          .from('competitor_alerts')
          .insert({
            tenant_id: tenantId,
            competitor_id: competitor.id,
            alert_type: classification.alertType,
            severity: classification.severity,
            title: classification.title,
            summary: classification.summary,
            evidence_ids: row?.id ? [row.id] : [],
          });

        if (!alertError) {
          alerts += 1;
        }
      }
    }

    await supabase
      .from('competitors')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', competitor.id);
  }

  return {
    observations,
    alerts,
  };
}
