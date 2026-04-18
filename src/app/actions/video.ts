'use server';

import { supabase } from '@/lib/supabase';
import { generateVideoScript } from '@/lib/video-service';

export async function generateVideoAction(campaignId: string, brandId: string) {
  try {
    // Fetch campaign and brand context
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*, brand_plans(product_name, product_description)')
      .eq('id', campaignId)
      .single();

    if (!campaign) throw new Error('Campaign not found');

    const videoData = await generateVideoScript({
      productName: campaign.brand_plans.product_name,
      description: campaign.brand_plans.product_description,
      objective: campaign.objective,
      targetAudience: campaign.ad_targeting?.audience || 'General audience'
    });

    // Save to DB
    const { data, error } = await supabase
      .from('video_assets')
      .insert([{
        campaign_id: campaignId,
        brand_id: brandId,
        title: videoData.title || campaign.brand_plans.product_name + ' Promo',
        script_data: videoData,
        status: 'generated'
      }])
      .select()
      .single();

    if (error) {
      if (error.message.includes('not find the table') || error.code === 'PGRST204') {
        throw new Error('DATABASE_MISSING: The video_assets table does not exist. Please run the migration in Supabase SQL editor.');
      }
      throw new Error(error.message);
    }
    return data;
  } catch (error: any) {
    console.error('Video Generation Error:', error);
    throw new Error(error.message);
  }
}

export async function getVideoAssetsAction(brandId: string) {
  try {
    const { data, error } = await supabase
      .from('video_assets')
      .select('*, campaigns(name)')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message.includes('not find the table')) {
        console.warn('Table video_assets does not exist in the database yet.');
        return [];
      }
      throw new Error(error.message);
    }
    return data || [];
  } catch (err) {
    return []; // Return empty list to prevent crash
  }
}

export async function deleteVideoAssetAction(id: string) {
  const { error } = await supabase.from('video_assets').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}
