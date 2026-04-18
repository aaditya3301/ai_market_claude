import 'server-only';
import { createHash } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServiceRoleClient } from '@/lib/supabase';
import { logger } from '@/lib/runtime/logger';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

export type LLMTask =
  | 'post_generation'
  | 'ad_copy_variant'
  | 'ad_hook_ideation'
  | 'war_room_persona'
  | 'war_room_synthesis'
  | 'seo_outline'
  | 'seo_draft'
  | 'classification'
  | 'feature_extraction'
  | 'summarization'
  | 'strategic_plan'
  | 'embedding';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCallInput {
  tenantId?: string;
  runId?: string;
  task: LLMTask;
  messages: LLMMessage[];
  responseFormat?: 'text' | 'json';
  maxTokens?: number;
  temperature?: number;
  costTier?: 'cheap' | 'standard' | 'premium';
  attachments?: Array<{ mimeType: string; data: string }>;
}

export interface LLMCallResult<T> {
  data: T;
  model: string;
  provider: 'google';
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  latencyMs: number;
  rawText: string;
}

const DEFAULT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'text-embedding-004';
const DEFAULT_BUDGET_USD_MONTHLY = Number(process.env.DEFAULT_LLM_BUDGET_USD_MONTHLY || 200);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function normalizeTenantId(tenantId?: string): string {
  return tenantId && tenantId.trim() ? tenantId : LEGACY_TENANT_ID;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function buildPrompt(messages: LLMMessage[]): string {
  return messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
}

function repairJson(raw: string): string {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === '\n') {
        result += '\\n';
        continue;
      }
      if (ch === '\r') {
        continue;
      }
      if (ch === '\t') {
        result += '\\t';
        continue;
      }
      if (ch.charCodeAt(0) < 32) {
        result += ' ';
        continue;
      }
    }

    result += ch;
  }

  return result;
}

function extractJson(text: string): unknown {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const startIdx = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);

  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');
  const endIdx = Math.max(lastBrace, lastBracket);

  const candidate =
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx
      ? text.substring(startIdx, endIdx + 1)
      : text.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(repairJson(candidate));
  }
}

async function getTenantBudgetCents(tenantId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle();

  const settings = (data?.settings || {}) as Record<string, unknown>;
  const budgetFromSettings = Number(settings.llm_budget_usd_monthly);
  const budgetUsd =
    Number.isFinite(budgetFromSettings) && budgetFromSettings > 0
      ? budgetFromSettings
      : DEFAULT_BUDGET_USD_MONTHLY;

  return Math.round(budgetUsd * 100);
}

async function getTenantMonthlySpendCents(tenantId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('llm_calls')
    .select('cost_cents')
    .eq('tenant_id', tenantId)
    .gte('created_at', monthStart.toISOString());

  if (error) {
    logger.warn({ msg: 'llm.budget.read_failed', tenant_id: tenantId, error: error.message });
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + Number(row.cost_cents || 0), 0);
}

async function enforceBudget(tenantId: string) {
  const [budgetCents, spendCents] = await Promise.all([
    getTenantBudgetCents(tenantId),
    getTenantMonthlySpendCents(tenantId),
  ]);

  if (spendCents > Math.round(budgetCents * 1.2)) {
    throw new Error('PLAN_LIMIT_EXCEEDED: Monthly LLM budget exceeded for tenant.');
  }

  return {
    budgetCents,
    spendCents,
    nearLimit: spendCents > Math.round(budgetCents * 0.8),
  };
}

function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const inputRate = Number(process.env.GEMINI_INPUT_COST_PER_1M_TOKENS || 0);
  const outputRate = Number(process.env.GEMINI_OUTPUT_COST_PER_1M_TOKENS || 0);

  const inputCost = (Math.max(0, inputTokens) * inputRate) / 1_000_000;
  const outputCost = (Math.max(0, outputTokens) * outputRate) / 1_000_000;
  return Number(((inputCost + outputCost) * 100).toFixed(4));
}

async function writeCallLog(params: {
  tenantId: string;
  runId?: string;
  task: LLMTask;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  latencyMs: number;
  status: 'success' | 'error' | 'timeout';
  errorCode?: string;
  promptHash: string;
  cached?: boolean;
}) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('llm_calls').insert({
    tenant_id: params.tenantId,
    run_id: params.runId || null,
    task: params.task,
    provider: 'google',
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_cents: params.costCents,
    latency_ms: params.latencyMs,
    status: params.status,
    error_code: params.errorCode || null,
    prompt_hash: params.promptHash,
    cached: params.cached || false,
  });

  if (error) {
    logger.warn({ msg: 'llm.log.write_failed', tenant_id: params.tenantId, error: error.message });
  }
}

async function generateTextInternal(input: LLMCallInput): Promise<LLMCallResult<string | unknown>> {
  const tenantId = normalizeTenantId(input.tenantId);
  const prompt = buildPrompt(input.messages);
  const promptHash = createHash('sha256').update(prompt).digest('hex');
  const startedAt = Date.now();

  await enforceBudget(tenantId);

  const model = genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: {
      responseMimeType: input.responseFormat === 'json' ? 'application/json' : undefined,
      maxOutputTokens: input.maxTokens,
      temperature: input.temperature,
    },
  });

  const contentParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [prompt];
  for (const attachment of input.attachments || []) {
    contentParts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
  }

  try {
    const generation = await model.generateContent(contentParts as never);
    const response = await generation.response;
    const rawText = response.text();
    const usage = (response as unknown as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
    const inputTokens = usage?.promptTokenCount || estimateTokens(prompt);
    const outputTokens = usage?.candidatesTokenCount || estimateTokens(rawText);
    const costCents = estimateCostCents(inputTokens, outputTokens);
    const latencyMs = Date.now() - startedAt;

    await writeCallLog({
      tenantId,
      runId: input.runId,
      task: input.task,
      model: DEFAULT_MODEL,
      inputTokens,
      outputTokens,
      costCents,
      latencyMs,
      status: 'success',
      promptHash,
    });

    return {
      data: input.responseFormat === 'json' ? extractJson(rawText) : rawText,
      model: DEFAULT_MODEL,
      provider: 'google',
      inputTokens,
      outputTokens,
      costCents,
      latencyMs,
      rawText,
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'unknown_error';

    await writeCallLog({
      tenantId,
      runId: input.runId,
      task: input.task,
      model: DEFAULT_MODEL,
      inputTokens: estimateTokens(prompt),
      outputTokens: 0,
      costCents: 0,
      latencyMs,
      status: 'error',
      errorCode: message.slice(0, 120),
      promptHash,
    });

    throw error;
  }
}

async function embedOne(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const embedded = await model.embedContent(text);
  const values = (embedded as unknown as { embedding?: { values?: number[] } }).embedding?.values;
  return Array.isArray(values) ? values : [];
}

export const llmRouter = {
  async call<T = string>(input: LLMCallInput): Promise<LLMCallResult<T>> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required for llmRouter.call');
    }

    const result = await generateTextInternal(input);
    return result as LLMCallResult<T>;
  },

  async *stream(input: LLMCallInput): AsyncGenerator<string> {
    const result = await this.call<string>({
      ...input,
      responseFormat: 'text',
    });
    yield result.data;
  },

  async embed(input: { tenantId?: string; text: string | string[]; runId?: string }): Promise<number[] | number[][]> {
    const tenantId = normalizeTenantId(input.tenantId);
    const startedAt = Date.now();

    await enforceBudget(tenantId);

    if (Array.isArray(input.text)) {
      const vectors = await Promise.all(input.text.map((item) => embedOne(item)));
      const promptHash = createHash('sha256').update(input.text.join('\n')).digest('hex');
      const inputTokens = input.text.reduce((sum, item) => sum + estimateTokens(item), 0);
      const outputTokens = vectors.reduce((sum, item) => sum + item.length, 0);
      const costCents = estimateCostCents(inputTokens, 0);

      await writeCallLog({
        tenantId,
        runId: input.runId,
        task: 'embedding',
        model: EMBED_MODEL,
        inputTokens,
        outputTokens,
        costCents,
        latencyMs: Date.now() - startedAt,
        status: 'success',
        promptHash,
      });

      return vectors;
    }

    const vector = await embedOne(input.text);
    const inputTokens = estimateTokens(input.text);
    const costCents = estimateCostCents(inputTokens, 0);

    await writeCallLog({
      tenantId,
      runId: input.runId,
      task: 'embedding',
      model: EMBED_MODEL,
      inputTokens,
      outputTokens: vector.length,
      costCents,
      latencyMs: Date.now() - startedAt,
      status: 'success',
      promptHash: createHash('sha256').update(input.text).digest('hex'),
    });

    return vector;
  },
};
