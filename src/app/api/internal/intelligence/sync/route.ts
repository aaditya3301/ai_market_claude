import { NextResponse } from 'next/server';
import { syncKnowledgePackForTenant, embedPendingKnowledgeChunks } from '@/lib/intelligence/knowledge';
import {
  extractWinnerFeaturesForTenant,
  refreshArtifactMetricsForTenant,
  scoreArtifactsForTenant,
} from '@/lib/intelligence/metrics';
import { scanCompetitorsForTenant } from '@/lib/intelligence/competitors';
import { detectTrendSignalsForTenant } from '@/lib/intelligence/trends';

function assertBootstrapToken(req: Request) {
  const token = req.headers.get('x-bootstrap-token') || '';
  const expected = process.env.INTERNAL_BOOTSTRAP_TOKEN || '';
  if (!expected || token !== expected) {
    throw new Error('UNAUTHORIZED');
  }
}

const ALL_TASKS = [
  'knowledge_sync',
  'knowledge_embed',
  'metrics_refresh',
  'metrics_score',
  'features_extract',
  'competitors_scan',
  'trends_detect',
] as const;

type TaskName = (typeof ALL_TASKS)[number];

function normalizeTasks(raw: unknown): TaskName[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...ALL_TASKS];
  }

  const requested = raw.map((item) => String(item || '').trim().toLowerCase());
  return ALL_TASKS.filter((task) => requested.includes(task));
}

export async function POST(req: Request) {
  try {
    assertBootstrapToken(req);

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenant_id || '').trim();
    const brandId = String(body.brand_id || '').trim() || undefined;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    const tasks = normalizeTasks(body.tasks);
    const result: Record<string, unknown> = {
      tenant_id: tenantId,
      tasks,
    };

    if (tasks.includes('knowledge_sync')) {
      result.knowledge_sync = await syncKnowledgePackForTenant({ tenantId, brandId });
    }

    if (tasks.includes('knowledge_embed')) {
      result.knowledge_embed = await embedPendingKnowledgeChunks({ tenantId, limit: 128 });
    }

    if (tasks.includes('metrics_refresh')) {
      result.metrics_refresh = await refreshArtifactMetricsForTenant(tenantId);
    }

    if (tasks.includes('metrics_score')) {
      result.metrics_score = await scoreArtifactsForTenant(tenantId);
    }

    if (tasks.includes('features_extract')) {
      result.features_extract = await extractWinnerFeaturesForTenant(tenantId);
    }

    if (tasks.includes('competitors_scan')) {
      result.competitors_scan = await scanCompetitorsForTenant(tenantId);
    }

    if (tasks.includes('trends_detect')) {
      result.trends_detect = await detectTrendSignalsForTenant(tenantId);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
