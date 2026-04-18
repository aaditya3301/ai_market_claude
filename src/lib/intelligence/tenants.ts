import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase';

export interface TenantRow {
  id: string;
  parent_tenant_id: string;
  parent_platform_id: string;
  settings: Record<string, unknown>;
}

export async function listActiveTenants(limit: number = 200): Promise<TenantRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('id,parent_tenant_id,parent_platform_id,settings')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 1000)));

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: String(row.id),
    parent_tenant_id: String(row.parent_tenant_id || ''),
    parent_platform_id: String(row.parent_platform_id || ''),
    settings: (row.settings as Record<string, unknown> | null) || {},
  }));
}

export async function getTenantSettings(tenantId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (data?.settings as Record<string, unknown> | null) || {};
}
