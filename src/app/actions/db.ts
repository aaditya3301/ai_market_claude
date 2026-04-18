'use server';

import { createServiceRoleClient } from '@/lib/supabase';

function db() {
  return createServiceRoleClient();
}

// Planning Actions
export async function getBrandPlansAction(brandId: string) {
  const { data, error } = await db()
    .from('brand_plans')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getBrandPlanByIdAction(id: string) {
  const { data, error } = await db()
    .from('brand_plans')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Campaign Actions
export async function getCampaignsAction(brandId: string) {
  const { data, error } = await db()
    .from('campaigns')
    .select(`*, brand_plans ( product_name, duration )`)
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCampaignAction(id: string) {
  const { error } = await db().from('campaigns').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

// Workspace Actions
export async function getCampaignWorkspaceAction(campaignId: string) {
  const [campRes, artRes] = await Promise.all([
    db().from('campaigns').select('*, brand_plans(product_name)').eq('id', campaignId).single(),
    db().from('artifacts').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false })
  ]);
  if (campRes.error) throw new Error(campRes.error.message);
  return { campaign: campRes.data, artifacts: artRes.data || [] };
}

// Artifact Actions
export async function updateArtifactTextAction(id: string, text_content: string) {
  const { error } = await db().from('artifacts').update({ text_content }).eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function publishArtifactAction(id: string) {
  const { error } = await db().from('artifacts').update({ status: 'published' }).eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

