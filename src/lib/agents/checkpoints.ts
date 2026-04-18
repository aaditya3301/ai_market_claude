import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase';

export async function saveAgentCheckpoint(params: {
  tenantId: string;
  runId?: string;
  agentName: string;
  stateKey: string;
  checkpoint: Record<string, unknown>;
}) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('agent_checkpoints')
    .upsert(
      {
        tenant_id: params.tenantId,
        run_id: params.runId || null,
        agent_name: params.agentName,
        state_key: params.stateKey,
        checkpoint: params.checkpoint,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,run_id,agent_name,state_key' }
    );

  if (error) throw new Error(error.message);
}

export async function loadAgentCheckpoint(params: {
  tenantId: string;
  runId?: string;
  agentName: string;
  stateKey: string;
}): Promise<Record<string, unknown> | null> {
  const supabase = createServiceRoleClient();
  const query = supabase
    .from('agent_checkpoints')
    .select('checkpoint')
    .eq('tenant_id', params.tenantId)
    .eq('agent_name', params.agentName)
    .eq('state_key', params.stateKey);

  const { data, error } = params.runId
    ? await query.eq('run_id', params.runId).maybeSingle()
    : await query.is('run_id', null).maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.checkpoint as Record<string, unknown> | undefined) || null;
}
