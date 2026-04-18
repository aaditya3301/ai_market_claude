import { createServiceRoleClient } from '@/lib/supabase';

const DEFAULT_FLAGS: Record<string, boolean> = {
  v1_connector: true,
  legacy_planning_api: true,
  legacy_campaign_api: true,
};

export async function isFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const settings = (data?.settings as Record<string, unknown> | undefined) || {};
  const flags = (settings.feature_flags as Record<string, unknown> | undefined) || {};

  if (flags[feature] === true) return true;
  if (flags[feature] === false) return false;
  return DEFAULT_FLAGS[feature] ?? false;
}
