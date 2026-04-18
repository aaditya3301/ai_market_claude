import { createServiceRoleClient } from '@/lib/supabase';

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface CreateApprovalInput {
  tenantId: string;
  runId?: string;
  kind: string;
  title: string;
  summary?: string;
  payload: Record<string, unknown>;
  context?: Record<string, unknown>;
  policySnapshot?: Record<string, unknown>;
  requestedBy: string;
  expiresInHours?: number;
}

export interface ResolveApprovalInput {
  approvalId: string;
  tenantId: string;
  decision: 'approved' | 'rejected';
  actor: string;
  edits?: Record<string, unknown>;
  note?: string;
}

export async function createApproval(input: CreateApprovalInput) {
  const supabase = createServiceRoleClient();
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 3600_000).toISOString();

  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      tenant_id: input.tenantId,
      run_id: input.runId || null,
      kind: input.kind,
      title: input.title,
      summary: input.summary || null,
      payload: input.payload,
      context: input.context || null,
      policy_snapshot: input.policySnapshot || null,
      requested_by: input.requestedBy,
      expires_at: expiresAt,
      state: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listApprovals(tenantId: string, state?: ApprovalState) {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from('approval_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (state) query = query.eq('state', state);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getApproval(tenantId: string, approvalId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', approvalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function resolveApproval(input: ResolveApprovalInput) {
  const supabase = createServiceRoleClient();
  const existing = await getApproval(input.tenantId, input.approvalId);
  if (!existing) {
    throw new Error('APPROVAL_NOT_FOUND');
  }
  if (existing.state !== 'pending') {
    throw new Error('APPROVAL_ALREADY_RESOLVED');
  }

  const { data, error } = await supabase
    .from('approval_requests')
    .update({
      state: input.decision,
      resolved_at: new Date().toISOString(),
      resolved_by: input.actor,
      resolution_edits: input.edits || null,
      resolution_note: input.note || null,
    })
    .eq('tenant_id', input.tenantId)
    .eq('id', input.approvalId)
    .eq('state', 'pending')
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function expirePendingApprovals(nowIso: string = new Date().toISOString()) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('approval_requests')
    .update({
      state: 'expired',
      resolved_at: nowIso,
      resolved_by: 'system:auto-expiry',
      resolution_note: 'auto-expired',
    })
    .eq('state', 'pending')
    .lt('expires_at', nowIso)
    .select('*');

  if (error) throw new Error(error.message);
  return data || [];
}
