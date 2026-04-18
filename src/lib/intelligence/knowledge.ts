import 'server-only';
import { createHash } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase';
import { llmRouter } from '@/lib/llm/router';
import { logger } from '@/lib/runtime/logger';
import { getTenantSettings } from '@/lib/intelligence/tenants';

export interface KnowledgePack {
  brand?: Record<string, unknown>;
  products?: Array<Record<string, unknown>>;
  audience_personas?: Array<Record<string, unknown>>;
  voice_examples?: Array<Record<string, unknown>>;
  style_rules?: Record<string, unknown>;
  past_content?: Array<Record<string, unknown>>;
}

interface KnowledgeChunkInsert {
  tenant_id: string;
  brand_id: string | null;
  source_type: string;
  source_id: string;
  source_url: string | null;
  content: string;
  content_hash: string;
  metadata: Record<string, unknown>;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function pushChunk(chunks: KnowledgeChunkInsert[], chunk: Omit<KnowledgeChunkInsert, 'content_hash'>) {
  const content = cleanText(chunk.content);
  if (!content) return;

  chunks.push({
    ...chunk,
    content,
    content_hash: hashContent(content),
  });
}

function normalizeKnowledgePack(params: {
  tenantId: string;
  brandId: string | null;
  pack: KnowledgePack;
}): KnowledgeChunkInsert[] {
  const chunks: KnowledgeChunkInsert[] = [];
  const base = {
    tenant_id: params.tenantId,
    brand_id: params.brandId,
  };

  if (params.pack.brand) {
    pushChunk(chunks, {
      ...base,
      source_type: 'brand_profile',
      source_id: 'brand:core',
      source_url: null,
      content: JSON.stringify(params.pack.brand),
      metadata: {
        category: 'brand',
      },
    });
  }

  (params.pack.voice_examples || []).forEach((item, index) => {
    pushChunk(chunks, {
      ...base,
      source_type: 'voice_example',
      source_id: String(item.id || `voice_${index}`),
      source_url: cleanText(item.source_url) || null,
      content: cleanText(item.text) || JSON.stringify(item),
      metadata: {
        type: item.type || 'unknown',
        date: item.date || null,
      },
    });
  });

  (params.pack.past_content || []).forEach((item, index) => {
    pushChunk(chunks, {
      ...base,
      source_type: 'past_post',
      source_id: String(item.id || item.url || `post_${index}`),
      source_url: cleanText(item.url) || null,
      content: cleanText(item.text) || JSON.stringify(item),
      metadata: {
        platform: item.platform || 'unknown',
        posted_at: item.posted_at || null,
        metrics: item.metrics || {},
      },
    });
  });

  (params.pack.products || []).forEach((item, index) => {
    pushChunk(chunks, {
      ...base,
      source_type: 'product',
      source_id: String(item.id || `product_${index}`),
      source_url: cleanText(item.url) || null,
      content: cleanText(item.description || item.name) || JSON.stringify(item),
      metadata: item,
    });
  });

  (params.pack.audience_personas || []).forEach((item, index) => {
    pushChunk(chunks, {
      ...base,
      source_type: 'persona',
      source_id: String(item.id || `persona_${index}`),
      source_url: null,
      content: cleanText(item.summary || item.description || item.name) || JSON.stringify(item),
      metadata: item,
    });
  });

  if (params.pack.style_rules) {
    pushChunk(chunks, {
      ...base,
      source_type: 'style_rule',
      source_id: 'style:rules',
      source_url: null,
      content: JSON.stringify(params.pack.style_rules),
      metadata: params.pack.style_rules,
    });
  }

  const dedup = new Map<string, KnowledgeChunkInsert>();
  for (const chunk of chunks) {
    dedup.set(`${chunk.source_type}:${chunk.source_id}:${chunk.content_hash}`, chunk);
  }

  return Array.from(dedup.values());
}

async function resolveKnowledgePackSource(tenantId: string): Promise<{ url: string | null; token: string | null }> {
  const settings = await getTenantSettings(tenantId);
  const connector = (settings.connector as Record<string, unknown> | undefined) || {};

  const urlFromSettings = cleanText(connector.knowledge_pack_url);
  if (urlFromSettings) {
    return {
      url: urlFromSettings,
      token: cleanText(connector.api_token) || null,
    };
  }

  const baseUrl = cleanText(process.env.PARENT_PLATFORM_BASE_URL);
  if (!baseUrl) {
    return { url: null, token: null };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/tenants/${tenantId}/knowledge-pack`;
  return {
    url,
    token: cleanText(process.env.PARENT_PLATFORM_API_KEY) || null,
  };
}

export async function syncKnowledgePackForTenant(params: {
  tenantId: string;
  brandId?: string | null;
}): Promise<{ synced: number; source: string }> {
  const source = await resolveKnowledgePackSource(params.tenantId);

  if (!source.url) {
    logger.warn({ msg: 'knowledge.sync.skipped', tenant_id: params.tenantId, reason: 'no_source_url' });
    return { synced: 0, source: 'none' };
  }

  const response = await fetch(source.url, {
    headers: source.token
      ? {
          Authorization: `Bearer ${source.token}`,
        }
      : undefined,
  });

  if (!response.ok) {
    throw new Error(`Knowledge sync failed (${response.status}) for tenant ${params.tenantId}`);
  }

  const pack = (await response.json()) as KnowledgePack;
  const chunks = normalizeKnowledgePack({
    tenantId: params.tenantId,
    brandId: params.brandId || null,
    pack,
  });

  if (chunks.length === 0) {
    return { synced: 0, source: source.url };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('knowledge_chunks')
    .upsert(chunks, {
      onConflict: 'tenant_id,source_type,source_id,content_hash',
    });

  if (error) {
    throw new Error(error.message);
  }

  logger.info({
    msg: 'knowledge.sync.completed',
    tenant_id: params.tenantId,
    count: chunks.length,
    source: source.url,
  });

  return {
    synced: chunks.length,
    source: source.url,
  };
}

function vectorLiteral(values: number[]): string {
  const normalized = values.map((v) => (Number.isFinite(v) ? Number(v) : 0));
  return `[${normalized.join(',')}]`;
}

export async function embedPendingKnowledgeChunks(params: {
  tenantId: string;
  limit?: number;
}): Promise<{ embedded: number }> {
  const supabase = createServiceRoleClient();
  const limit = Math.max(1, Math.min(params.limit || 128, 256));

  const { data: rows, error } = await supabase
    .from('knowledge_chunks')
    .select('id,content,metadata')
    .eq('tenant_id', params.tenantId)
    .is('embedding', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { embedded: 0 };

  const contents = rows.map((row) => String(row.content || ''));
  const embeddings = await llmRouter.embed({
    tenantId: params.tenantId,
    text: contents,
  });

  const vectors = embeddings as number[][];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const vector = vectors[index] || [];
    if (!Array.isArray(vector) || vector.length === 0) continue;

    const metadata = ((row.metadata as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const { error: updateError } = await supabase
      .from('knowledge_chunks')
      .update({
        embedding: vectorLiteral(vector),
        metadata: {
          ...metadata,
          embedding_model: process.env.GEMINI_EMBED_MODEL || 'text-embedding-004',
          embedded_at: new Date().toISOString(),
        },
      })
      .eq('tenant_id', params.tenantId)
      .eq('id', row.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return {
    embedded: rows.length,
  };
}
