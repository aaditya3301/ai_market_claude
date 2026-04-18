import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase';
import { llmRouter } from '@/lib/llm/router';
import type { RetrievalPolicy } from '@/lib/intelligence/retrieval-policies';

export type RetrievalQuery = {
  tenantId: string;
  text: string;
  sourceTypes?: string[];
  k?: number;
  filters?: {
    platform?: string;
    minPerformance?: number;
  };
};

export type RetrievedChunk = {
  id: string;
  source_type: string;
  source_id: string;
  source_url: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type WinnerArtifact = {
  artifact_id: string;
  platform: string;
  percentile: number;
  score: number;
  text_content: string | null;
};

export type RetrievalResult = {
  chunks: RetrievedChunk[];
  winners: WinnerArtifact[];
};

async function fetchTopWinners(
  tenantId: string,
  policy: RetrievalPolicy | undefined,
  limit: number
): Promise<WinnerArtifact[]> {
  if (!policy?.includeTopWinners || policy.includeTopWinners <= 0) {
    return [];
  }

  const supabase = createServiceRoleClient();
  const desiredLimit = Math.min(Math.max(limit, 1), 25);

  const { data, error } = await supabase
    .from('artifact_scores')
    .select('artifact_id, platform, percentile, score, artifacts(text_content)')
    .eq('tenant_id', tenantId)
    .eq('label', 'winner')
    .order('percentile', { ascending: false })
    .limit(desiredLimit);

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const artifact = row.artifacts as { text_content?: string } | null;
    return {
      artifact_id: String(row.artifact_id),
      platform: String(row.platform),
      percentile: Number(row.percentile || 0),
      score: Number(row.score || 0),
      text_content: artifact?.text_content || null,
    };
  });
}

export async function retrieve(q: RetrievalQuery): Promise<RetrievedChunk[]> {
  const embedding = await llmRouter.embed({ tenantId: q.tenantId, text: q.text });
  const vector = Array.isArray(embedding) && typeof embedding[0] === 'number'
    ? embedding
    : [];

  if (vector.length === 0) {
    return [];
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    p_tenant_id: q.tenantId,
    p_embedding: vector,
    p_source_types: q.sourceTypes || null,
    p_k: q.k || 12,
  });

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  return ((data || []) as RetrievedChunk[]).filter((row) => {
    if (q.filters?.platform) {
      return row.metadata?.platform === q.filters.platform;
    }
    return true;
  });
}

export async function retrieveWithPolicy(params: {
  tenantId: string;
  text: string;
  policy?: RetrievalPolicy;
}): Promise<RetrievalResult> {
  const chunks = await retrieve({
    tenantId: params.tenantId,
    text: params.text,
    sourceTypes: params.policy?.sourceTypes,
    k: params.policy?.k,
    filters: params.policy?.filters,
  });

  const winners = await fetchTopWinners(
    params.tenantId,
    params.policy,
    params.policy?.includeTopWinners || 0
  );

  return {
    chunks,
    winners,
  };
}
