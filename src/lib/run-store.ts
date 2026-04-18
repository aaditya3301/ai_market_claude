import { createServiceRoleClient } from '@/lib/supabase';
import { type AutomationStepName } from '@/lib/step-definitions';

export type AutomationMode = 'full' | 'guided' | 'simulation';
export type AutomationRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
export type AutomationStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'awaiting_approval';

export interface AutomationRunRow {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  brand_id: string;
  goal?: string | null;
  callback_url?: string | null;
  mode: AutomationMode;
  status: AutomationRunStatus;
  idempotency_key: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  error_summary: string | null;
  current_step: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface AutomationStepRow {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  run_id: string;
  step_name: AutomationStepName;
  status: AutomationStepStatus;
  attempt_count: number;
  lock_token: string | null;
  locked_until: string | null;
  started_at: string | null;
  ended_at: string | null;
  last_heartbeat_at: string | null;
  error_detail: string | null;
  output_payload: Record<string, unknown>;
}

type JsonRecord = Record<string, unknown>;

function db() {
  return createServiceRoleClient();
}

function nowIso(): string {
  return new Date().toISOString();
}

function plusSecondsIso(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function findRunByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string
): Promise<AutomationRunRow | null> {
  const { data, error } = await db()
    .from('automation_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('idempotency_key', idempotencyKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as AutomationRunRow | null) ?? null;
}

export async function getRunById(runId: string, tenantId?: string): Promise<AutomationRunRow | null> {
  let query = db()
    .from('automation_runs')
    .select('*')
    .eq('id', runId);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return (data as AutomationRunRow | null) ?? null;
}

export async function listRuns(params: {
  tenantId: string;
  limit?: number;
}): Promise<AutomationRunRow[]> {
  const limit = Math.min(Math.max(params?.limit ?? 20, 1), 200);

  const { data, error } = await db()
    .from('automation_runs')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data as AutomationRunRow[]) || [];
}

export async function createRun(params: {
  tenantId: string;
  brandId: string;
  goal?: string;
  mode: AutomationMode;
  idempotencyKey: string;
  inputPayload?: JsonRecord;
  callbackUrl?: string;
}): Promise<AutomationRunRow> {
  const existing = await findRunByIdempotencyKey(params.tenantId, params.idempotencyKey);
  if (existing) return existing;

  const timestamp = nowIso();
  const { data, error } = await db()
    .from('automation_runs')
    .insert([
      {
        tenant_id: params.tenantId,
        brand_id: params.brandId,
        goal: params.goal || null,
        callback_url: params.callbackUrl || null,
        mode: params.mode,
        status: 'pending',
        idempotency_key: params.idempotencyKey,
        input_payload: params.inputPayload || {},
        output_payload: {},
        started_at: timestamp,
        updated_at: timestamp,
      },
    ])
    .select('*')
    .single();

  if (error) {
    const fallback = await findRunByIdempotencyKey(params.tenantId, params.idempotencyKey);
    if (fallback) return fallback;
    throw new Error(error.message);
  }

  return data as AutomationRunRow;
}

export async function listRunSteps(runId: string, tenantId: string): Promise<AutomationStepRow[]> {
  const { data, error } = await db()
    .from('automation_run_steps')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as AutomationStepRow[]) || [];
}

export async function getStep(
  runId: string,
  tenantId: string,
  stepName: AutomationStepName
): Promise<AutomationStepRow | null> {
  const { data, error } = await db()
    .from('automation_run_steps')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('run_id', runId)
    .eq('step_name', stepName)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as AutomationStepRow | null) ?? null;
}

export async function upsertStep(params: {
  tenantId: string;
  runId: string;
  stepName: AutomationStepName;
  status?: AutomationStepStatus;
  outputPayload?: JsonRecord;
  errorDetail?: string | null;
}): Promise<AutomationStepRow> {
  const timestamp = nowIso();
  const payload = {
    tenant_id: params.tenantId,
    run_id: params.runId,
    step_name: params.stepName,
    status: params.status || 'pending',
    updated_at: timestamp,
    output_payload: params.outputPayload || {},
    error_detail: params.errorDetail ?? null,
  };

  const { data, error } = await db()
    .from('automation_run_steps')
    .upsert(payload, { onConflict: 'run_id,step_name' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as AutomationStepRow;
}

export async function setRunStatus(params: {
  tenantId: string;
  runId: string;
  status: AutomationRunStatus;
  currentStep?: AutomationStepName | null;
  errorSummary?: string | null;
  outputPayload?: JsonRecord;
}): Promise<AutomationRunRow> {
  const timestamp = nowIso();

  const updatePayload: Record<string, unknown> = {
    status: params.status,
    updated_at: timestamp,
  };

  if (params.currentStep !== undefined) updatePayload.current_step = params.currentStep;
  if (params.errorSummary !== undefined) updatePayload.error_summary = params.errorSummary;
  if (params.outputPayload !== undefined) updatePayload.output_payload = params.outputPayload;

  if (params.status === 'running') {
    updatePayload.started_at = timestamp;
    updatePayload.ended_at = null;
  }

  if (params.status === 'completed' || params.status === 'failed' || params.status === 'canceled') {
    updatePayload.ended_at = timestamp;
  }

  const { data, error } = await db()
    .from('automation_runs')
    .update(updatePayload)
    .eq('tenant_id', params.tenantId)
    .eq('id', params.runId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as AutomationRunRow;
}

export async function acquireStepLock(params: {
  tenantId: string;
  runId: string;
  stepName: AutomationStepName;
  lockToken: string;
  lockTtlSeconds?: number;
}): Promise<boolean> {
  const lockTtl = params.lockTtlSeconds ?? 120;
  const timestamp = nowIso();
  const lockUntil = plusSecondsIso(lockTtl);

  await upsertStep({
    tenantId: params.tenantId,
    runId: params.runId,
    stepName: params.stepName,
    status: 'pending',
  });

  const { data, error } = await db()
    .from('automation_run_steps')
    .update({
      status: 'running',
      lock_token: params.lockToken,
      locked_until: lockUntil,
      started_at: timestamp,
      last_heartbeat_at: timestamp,
      updated_at: timestamp,
    })
    .eq('tenant_id', params.tenantId)
    .eq('run_id', params.runId)
    .eq('step_name', params.stepName)
    .in('status', ['pending', 'running', 'failed', 'awaiting_approval'])
    .or(`locked_until.is.null,locked_until.lt.${timestamp},lock_token.eq.${params.lockToken}`)
    .select('id');

  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    return false;
  }

  const current = await getStep(params.runId, params.tenantId, params.stepName);
  if (!current) {
    throw new Error('Failed to read step after lock acquisition');
  }

  const nextAttemptCount = (current.attempt_count || 0) + 1;
  const { error: attemptError } = await db()
    .from('automation_run_steps')
    .update({
      attempt_count: nextAttemptCount,
      updated_at: nowIso(),
    })
    .eq('tenant_id', params.tenantId)
    .eq('id', current.id);

  if (attemptError) throw new Error(attemptError.message);
  return true;
}

export async function renewStepLock(params: {
  tenantId: string;
  runId: string;
  stepName: AutomationStepName;
  lockToken: string;
  lockTtlSeconds?: number;
}): Promise<boolean> {
  const lockTtl = params.lockTtlSeconds ?? 120;
  const { data, error } = await db()
    .from('automation_run_steps')
    .update({
      locked_until: plusSecondsIso(lockTtl),
      last_heartbeat_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('tenant_id', params.tenantId)
    .eq('run_id', params.runId)
    .eq('step_name', params.stepName)
    .eq('lock_token', params.lockToken)
    .select('id');

  if (error) throw new Error(error.message);
  return !!data && data.length > 0;
}

export async function completeStep(params: {
  tenantId: string;
  runId: string;
  stepName: AutomationStepName;
  lockToken?: string;
  outputPayload?: JsonRecord;
}): Promise<AutomationStepRow> {
  const timestamp = nowIso();
  let query = db()
    .from('automation_run_steps')
    .update({
      status: 'completed',
      output_payload: params.outputPayload || {},
      ended_at: timestamp,
      updated_at: timestamp,
      lock_token: null,
      locked_until: null,
    })
    .eq('tenant_id', params.tenantId)
    .eq('run_id', params.runId)
    .eq('step_name', params.stepName);

  if (params.lockToken) {
    query = query.eq('lock_token', params.lockToken);
  }

  const { data, error } = await query.select('*').single();
  if (error) throw new Error(error.message);
  return data as AutomationStepRow;
}

export async function failStep(params: {
  tenantId: string;
  runId: string;
  stepName: AutomationStepName;
  errorDetail: string;
  lockToken?: string;
  outputPayload?: JsonRecord;
}): Promise<AutomationStepRow> {
  const timestamp = nowIso();
  let query = db()
    .from('automation_run_steps')
    .update({
      status: 'failed',
      error_detail: params.errorDetail,
      output_payload: params.outputPayload || {},
      ended_at: timestamp,
      updated_at: timestamp,
      lock_token: null,
      locked_until: null,
    })
    .eq('tenant_id', params.tenantId)
    .eq('run_id', params.runId)
    .eq('step_name', params.stepName);

  if (params.lockToken) {
    query = query.eq('lock_token', params.lockToken);
  }

  const { data, error } = await query.select('*').single();
  if (error) throw new Error(error.message);
  return data as AutomationStepRow;
}

export async function cancelRun(params: {
  tenantId: string;
  runId: string;
  reason?: string;
}): Promise<AutomationRunRow> {
  const { data, error } = await db()
    .from('automation_runs')
    .update({
      status: 'canceled',
      error_summary: params.reason || 'Canceled by caller',
      ended_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('tenant_id', params.tenantId)
    .eq('id', params.runId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as AutomationRunRow;
}
