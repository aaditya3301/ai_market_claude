import { supabase } from './supabase';
import { generateText, generateImage } from './gemini';
import { launchMetaAd, isMetaAdsConfigured } from './meta-ads-service';
import { launchGoogleAd, isGoogleAdsConfigured } from './google-ads-service';

const VARIANT_ANGLES = [
  {
    name: 'Logical',
    emoji: '🧠',
    instruction: 'Use a data-driven, logical approach. Focus on statistics, ROI, efficiency gains, and rational benefits. Appeal to the analytical mind. Use numbers and percentages.',
    color: 'blue'
  },
  {
    name: 'Emotional',
    emoji: '❤️',
    instruction: 'Use an emotional storytelling approach. Focus on transformation, aspiration, fear of missing out, and personal impact. Paint a vivid picture of the before/after. Use power words that trigger emotion.',
    color: 'pink'
  },
  {
    name: 'Urgent',
    emoji: '⚡',
    instruction: 'Use an urgency and scarcity approach. Focus on limited-time offers, exclusive access, countdown pressure, and immediate action. Create a sense of "act now or lose out".',
    color: 'amber'
  }
];

/**
 * Generate a SINGLE ad variant for a given psychological angle.
 */
async function generateVariant(
  campaign: any,
  targetAudience: string,
  platform: string,
  angle: typeof VARIANT_ANGLES[0]
) {
  let formatInstructions = '';
  if (platform === 'meta') {
    formatInstructions = `
You are an advanced Meta Ads API Integration Agent.
PSYCHOLOGICAL ANGLE: ${angle.name} — ${angle.instruction}

Generate a raw JSON payload that strictly conforms to the Meta Graph API structure for ad creation.
{
  "api_payload": {
    "name": "Campaign_Adset_${angle.name}",
    "optimization_goal": "CONVERSIONS",
    "billing_event": "IMPRESSIONS",
    "bid_amount": 250,
    "targeting": {
      "geo_locations": {"countries": ["US", "GB"]},
      "interests": [{"id": "generate_mock_id", "name": "interest based on target audience"}]
    },
    "creative": {
      "title": "Short headline (Max 40 chars)",
      "body": "The main ad copy. Apply the ${angle.name} angle. No emojis. Professional corporate tone.",
      "call_to_action_type": "LEARN_MORE"
    }
  },
  "image_prompt": "A highly detailed prompt for an AI image generator to create the ad creative. Match the ${angle.name} mood."
}
`;
  } else if (platform === 'google') {
    formatInstructions = `
You are an advanced Google Ads API Integration Agent.
PSYCHOLOGICAL ANGLE: ${angle.name} — ${angle.instruction}

Generate a raw JSON payload that strictly conforms to the Google Ads API structure for a Responsive Search Ad.
{
  "api_payload": {
    "ad_group_ad": {
      "ad": {
        "responsive_search_ad": {
          "headlines": [{"text": "Headline 1"}, {"text": "Headline 2"}, {"text": "Headline 3"}],
          "descriptions": [{"text": "Description 1"}, {"text": "Description 2"}],
          "path1": "promo",
          "path2": "offer"
        }
      },
      "status": "PAUSED"
    }
  },
  "image_prompt": "A highly detailed prompt for a Display Network banner image (1200x628). Match the ${angle.name} tone."
}
`;
  }

  const prompt = `
Create an API Payload for the following product/campaign:
Product: ${campaign.brand_plans?.product_name || 'Product'}
Description: ${campaign.brand_plans?.product_description || 'Description'}
Campaign Objective: ${campaign.objective}
Target Audience: ${targetAudience}
${campaign.brand_plans?.ai_research_result?.war_room_insights ? `CRITICAL WAR ROOM DIRECTIVES FOR THESE ADS:\n${campaign.brand_plans.ai_research_result.war_room_insights}\n` : ''}
HISTORICAL PERFORMANCE DATA:
Assume previous campaigns had a baseline CTR of 1.5% and a ROAS of 2.1x.
Your goal is to increase statistical variance by testing the exact psychological angle requested.

${formatInstructions}
`;

  return await generateText(prompt);
}

/**
 * Create 3 multivariate ad variants for a single campaign.
 */
export async function createMultivariateAds(
  campaignId: string,
  targetAudience: string,
  adBudget: number,
  platform: string = 'meta'
) {
  // 1. Fetch Campaign and Brand Context
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*, brand_plans(*)')
    .eq('id', campaignId)
    .single();

  if (error || !campaign) throw new Error('Campaign not found');

  // 2. Update Campaign with Ad Budget/Targeting
  await supabase
    .from('campaigns')
    .update({
      ad_budget: adBudget,
      ad_targeting: { audience: targetAudience },
      ad_status: 'running'
    })
    .eq('id', campaignId);

  // 3. Generate all 3 variants sequentially
  const variantGroupId = crypto.randomUUID().slice(0, 8);
  const results: any[] = [];

  for (let i = 0; i < VARIANT_ANGLES.length; i++) {
    const angle = VARIANT_ANGLES[i];
    console.log(`[Ads] Generating ${angle.name} variant (${i + 1}/3)...`);

    try {
      const aiResult = await generateVariant(campaign, targetAudience, platform, angle);

      // Generate image
      let mediaUrl = null;
      try {
        mediaUrl = await generateImage(aiResult.image_prompt);
      } catch { /* fallback below */ }

      if (!mediaUrl) {
        const lbl = encodeURIComponent(angle.name + ' Ad');
        mediaUrl = `https://placehold.co/1080x1080/4f46e5/ffffff?font=playfair-display&text=${lbl}`;
      }

      // Format text content directly as formatted JSON payload for the UI
      const combinedContent = JSON.stringify(aiResult.api_payload, null, 2);

      // Assign mock CTR that varies by variant for demo purposes
      const baseCtr = (Math.random() * 3 + 1);
      const mockMetrics = {
        ctr: baseCtr.toFixed(2),
        clicks: Math.floor(baseCtr * 120 + Math.random() * 50),
        spend: (adBudget / 3 * (0.6 + Math.random() * 0.8)).toFixed(2),
        impressions: Math.floor(3000 + Math.random() * 5000),
        variant_angle: angle.name,
        variant_color: angle.color,
        variant_emoji: angle.emoji,
        variant_group: variantGroupId,
        variant_status: 'active' // active | paused | winner
      };

      // Save to artifacts
      const { data: artifact, error: artError } = await supabase
        .from('artifacts')
        .insert([{
          campaign_id: campaignId,
          platform: platform + '_ad',
          text_content: combinedContent,
          image_prompt: aiResult.image_prompt,
          media_url: mediaUrl,
          metrics: mockMetrics
        }])
        .select()
        .single();

      if (artError) {
        console.error(`[Ads] Failed to save ${angle.name} variant:`, artError.message);
      } else {
        results.push(artifact);
      }
    } catch (e: any) {
      console.error(`[Ads] ${angle.name} variant generation failed:`, e.message);
    }
  }

  console.log(`[Ads] Generated ${results.length}/3 variants for group ${variantGroupId}`);

  // === REAL AD LAUNCHING (if APIs are configured) ===
  if (platform === 'meta' && isMetaAdsConfigured()) {
    console.log('[Ads] Meta Ads API configured — launching real ads...');
    for (const artifact of results) {
      try {
        const payload = JSON.parse(artifact.text_content);
        const launchResult = await launchMetaAd(
          payload,
          adBudget / 3, // Split budget across variants
          artifact.media_url
        );
        // Store real ad IDs in metrics
        const updatedMetrics = {
          ...artifact.metrics,
          real_ad_launched: launchResult.success,
          meta_campaign_id: launchResult.campaignId,
          meta_ad_set_id: launchResult.adSetId,
          meta_ad_id: launchResult.adId,
          launch_error: launchResult.error,
        };
        await supabase.from('artifacts').update({ metrics: updatedMetrics }).eq('id', artifact.id);
        console.log(`[Ads] Meta Ad launched: ${launchResult.success ? '✓' : '✗'} (${launchResult.adId || launchResult.error})`);
      } catch (e: any) {
        console.error(`[Ads] Meta launch failed for artifact ${artifact.id}:`, e.message);
      }
    }
  } else if (platform === 'google' && isGoogleAdsConfigured()) {
    console.log('[Ads] Google Ads API configured — launching real ads...');
    for (const artifact of results) {
      try {
        const payload = JSON.parse(artifact.text_content);
        const campaignName = `AI_${variantGroupId}_${artifact.metrics?.variant_angle || 'variant'}`;
        const launchResult = await launchGoogleAd(
          payload,
          campaignName,
          adBudget / 3
        );
        const updatedMetrics = {
          ...artifact.metrics,
          real_ad_launched: launchResult.success,
          google_campaign_id: launchResult.campaignId,
          google_ad_group_id: launchResult.adGroupId,
          google_ad_id: launchResult.adId,
          launch_error: launchResult.error,
        };
        await supabase.from('artifacts').update({ metrics: updatedMetrics }).eq('id', artifact.id);
        console.log(`[Ads] Google Ad launched: ${launchResult.success ? '✓' : '✗'} (${launchResult.adId || launchResult.error})`);
      } catch (e: any) {
        console.error(`[Ads] Google launch failed for artifact ${artifact.id}:`, e.message);
      }
    }
  } else {
    console.log(`[Ads] No real ${platform} API configured — ads saved locally only.`);
  }

  return results;
}

/**
 * LEGACY: Create a single ad campaign (kept for backward compatibility).
 */
export async function createAdCampaign(
  campaignId: string,
  targetAudience: string,
  adBudget: number,
  platform: string = 'meta'
) {
  return createMultivariateAds(campaignId, targetAudience, adBudget, platform);
}

/**
 * Optimizer Agent: Analyze variant performance and pause losers.
 * Called by the cron job daily.
 */
export async function optimizeAdVariants() {
  console.log('[Optimizer Agent] Starting daily optimization pass...');

  // Get all ad artifacts that have variant groups
  const { data: ads, error } = await supabase
    .from('artifacts')
    .select('*')
    .like('platform', '%_ad')
    .not('metrics', 'is', null);

  if (error || !ads) {
    console.error('[Optimizer Agent] Failed to fetch ads:', error?.message);
    return { optimized: 0 };
  }

  // Group by variant_group
  const groups: Record<string, any[]> = {};
  for (const ad of ads) {
    const group = ad.metrics?.variant_group;
    if (!group) continue;
    if (!groups[group]) groups[group] = [];
    groups[group].push(ad);
  }

  let optimizedCount = 0;

  for (const [groupId, variants] of Object.entries(groups)) {
    if (variants.length < 2) continue;

    // Skip already optimized groups
    const hasWinner = variants.some(v => v.metrics?.variant_status === 'winner');
    if (hasWinner) continue;

    // Sort by CTR descending
    const sorted = [...variants].sort((a, b) =>
      parseFloat(b.metrics?.ctr || '0') - parseFloat(a.metrics?.ctr || '0')
    );

    const winner = sorted[0];
    const losers = sorted.slice(1);

    // Mark winner
    const winnerMetrics = { ...winner.metrics, variant_status: 'winner' };
    await supabase
      .from('artifacts')
      .update({ metrics: winnerMetrics })
      .eq('id', winner.id);

    // Pause losers and reallocate their budget to the winner
    let reallocatedBudget = 0;
    for (const loser of losers) {
      reallocatedBudget += parseFloat(loser.metrics?.spend || '0');
      const loserMetrics = { ...loser.metrics, variant_status: 'paused' };
      await supabase
        .from('artifacts')
        .update({ metrics: loserMetrics })
        .eq('id', loser.id);
    }

    // Update winner's budget
    winnerMetrics.spend = (parseFloat(winnerMetrics.spend || '0') + reallocatedBudget).toFixed(2);
    winnerMetrics.reallocated_budget = reallocatedBudget.toFixed(2);
    await supabase
      .from('artifacts')
      .update({ metrics: winnerMetrics })
      .eq('id', winner.id);

    console.log(`[Optimizer Agent] Group ${groupId}: Winner="${winner.metrics?.variant_angle}" (CTR ${winner.metrics?.ctr}%), Paused ${losers.length} losers, Reallocated $${reallocatedBudget.toFixed(2)}`);
    optimizedCount++;
  }

  console.log(`[Optimizer Agent] Optimization complete. ${optimizedCount} groups optimized.`);
  return { optimized: optimizedCount };
}
