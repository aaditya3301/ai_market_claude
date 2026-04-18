'use server';

import { supabase } from '@/lib/supabase';
import { createAdCampaign, optimizeAdVariants } from '@/lib/ads-service';
import { launchMetaAd, isMetaAdsConfigured, getMetaAdInsights } from '@/lib/meta-ads-service';
import { launchGoogleAd, isGoogleAdsConfigured } from '@/lib/google-ads-service';

export async function createAdCampaignAction(campaignId: string, targetAudience: string, adBudget: number, platform: string) {
  return await createAdCampaign(campaignId, targetAudience, adBudget, platform);
}

export async function optimizeAdsAction() {
  return await optimizeAdVariants();
}

export async function getAdArtifactsAction(brandId: string) {
  const { data: campaigns } = await supabase.from('campaigns').select('id').eq('brand_id', brandId);
  const campaignIds = campaigns?.map((c: any) => c.id) || [];
  
  if (campaignIds.length === 0) return [];

  const { data, error } = await supabase
    .from('artifacts')
    .select('*, campaigns(name)')
    .in('campaign_id', campaignIds)
    .like('platform', '%_ad')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getEligibleCampaignsAction(brandId: string) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Get the current integration status for ad platforms.
 */
export async function getAdPlatformStatusAction() {
  return {
    meta: {
      configured: isMetaAdsConfigured(),
      label: 'Meta Ads (Facebook/Instagram)',
    },
    google: {
      configured: isGoogleAdsConfigured(),
      label: 'Google Ads (Search/Display)',
    },
  };
}

/**
 * Manually launch a single ad artifact to its real ad platform.
 * Useful if auto-launch failed during generation.
 */
export async function manualLaunchAdAction(artifactId: string, dailyBudget: number) {
  const { data: artifact, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('id', artifactId)
    .single();

  if (error || !artifact) throw new Error('Artifact not found');

  const platform = artifact.platform?.replace('_ad', ''); // 'meta_ad' -> 'meta'
  const payload = JSON.parse(artifact.text_content || '{}');

  let result: any;
  if (platform === 'meta' && isMetaAdsConfigured()) {
    result = await launchMetaAd(payload, dailyBudget, artifact.media_url);
  } else if (platform === 'google' && isGoogleAdsConfigured()) {
    result = await launchGoogleAd(payload, `Manual_${artifactId.slice(0, 8)}`, dailyBudget);
  } else {
    throw new Error(`${platform} Ads API not configured. Check your .env file.`);
  }

  // Update artifact metrics with launch result
  const updatedMetrics = {
    ...artifact.metrics,
    real_ad_launched: result.success,
    ...(platform === 'meta' ? {
      meta_campaign_id: result.campaignId,
      meta_ad_set_id: result.adSetId,
      meta_ad_id: result.adId,
    } : {
      google_campaign_id: result.campaignId,
      google_ad_group_id: result.adGroupId,
      google_ad_id: result.adId,
    }),
    launch_error: result.error,
    launched_at: new Date().toISOString(),
  };

  await supabase.from('artifacts').update({ metrics: updatedMetrics }).eq('id', artifactId);

  return result;
}

/**
 * Fetch real performance metrics from Meta for a specific ad.
 */
export async function fetchRealAdMetricsAction(artifactId: string) {
  const { data: artifact } = await supabase
    .from('artifacts')
    .select('metrics')
    .eq('id', artifactId)
    .single();

  if (!artifact?.metrics?.meta_ad_id) {
    throw new Error('No Meta Ad ID found for this artifact');
  }

  const insights = await getMetaAdInsights(artifact.metrics.meta_ad_id);
  if (!insights) throw new Error('Failed to fetch Meta insights');

  // Update the artifact with real metrics
  const updatedMetrics = {
    ...artifact.metrics,
    real_impressions: parseInt(insights.impressions || '0'),
    real_clicks: parseInt(insights.clicks || '0'),
    real_ctr: insights.ctr || '0',
    real_spend: insights.spend || '0',
    metrics_updated_at: new Date().toISOString(),
  };

  await supabase.from('artifacts').update({ metrics: updatedMetrics }).eq('id', artifactId);

  return insights;
}
