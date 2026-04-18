import { createServiceRoleClient } from '@/lib/supabase';
import { generateArtifactContent, generateImage } from '@/lib/gemini';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

export async function createAndGenerateCampaign({
  tenantId,
  brandId,
  brandPlanId,
  campaignName,
  objective,
  platforms,
}: {
  tenantId?: string;
  brandId: string;
  brandPlanId: string;
  campaignName: string;
  objective: string;
  platforms: string[];
}) {
  const activeTenantId = tenantId || LEGACY_TENANT_ID;
  const db = createServiceRoleClient();

  console.log(`[Campaign Service] Starting creation for: ${campaignName}`);

  // Fetch plan info for context
  const { data: plan, error: planError } = await db
    .from('brand_plans')
    .select('product_name, product_description, ai_research_result')
    .eq('tenant_id', activeTenantId)
    .eq('id', brandPlanId)
    .single();

  if (planError || !plan) {
    throw new Error('Brand plan not found');
  }

  // Create Campaign
  const { data: campaign, error: campError } = await db
    .from('campaigns')
    .insert([{
      tenant_id: activeTenantId,
      brand_id: brandId,
      brand_plan_id: brandPlanId,
      name: campaignName,
      objective: objective,
      social_platforms: platforms,
      status: 'active',
    }])
    .select()
    .single();

  if (campError) throw new Error(`Campaign creation failed: ${campError.message}`);

  const campaignId = campaign.id;
  const brandContext = {
    productName: plan.product_name,
    description: plan.product_description,
    objective: objective,
    brandTone: plan.ai_research_result?.suggested_strategies?.[0]?.title || 'Professional',
    warRoomInsights: plan.ai_research_result?.war_room_insights,
  };

  // Generate artifacts for each platform
  // Strategy: We can generate ONE image and share it, OR generate unique per platform.
  // For marketing, a shared visual with tailored text works well. We'll generate one image if platforms > 0.

  let sharedImagePrompt: string | null = null;
  let sharedImageUrl: string | null = null;

  const artifactsToInsert = [];

  for (const platform of platforms) {
    try {
      console.log(`[Campaign Service] Generating text for ${platform}...`);
      const content = await generateArtifactContent(platform, brandContext);

      // Clean markdown bold
      let cleanText = content.text_content;
      if (cleanText) cleanText = cleanText.replace(/\*\*/g, '');

      // Image generation
      let currentImageUrl = null;
      let currentImagePrompt = content.image_prompt;

      if (!sharedImageUrl && currentImagePrompt) {
        console.log(`[Campaign Service] Generating primary image...`);
        sharedImageUrl = await generateImage(currentImagePrompt);
        sharedImagePrompt = currentImagePrompt;
        currentImageUrl = sharedImageUrl;
      } else if (sharedImageUrl) {
        // Reuse the first generated image for consistency
        currentImageUrl = sharedImageUrl;
        currentImagePrompt = sharedImagePrompt!;
      }

      artifactsToInsert.push({
        campaign_id: campaignId,
        platform: platform,
        type: 'post',
        text_content: cleanText,
        image_prompt: currentImagePrompt,
        media_url: currentImageUrl,
        status: 'generated',
      });

    } catch (err: any) {
      console.error(`[Campaign Service] Failed to generate for ${platform}:`, err);
    }
  }

  if (artifactsToInsert.length > 0) {
    const tenantArtifacts = artifactsToInsert.map((artifact) => ({
      ...artifact,
      tenant_id: activeTenantId,
    }));
    const { error: artError } = await db.from('artifacts').insert(tenantArtifacts);
    if (artError) console.error('[Campaign Service] Artifact insert error:', artError);
  }

  console.log(`[Campaign Service] Success! Campaign and ${artifactsToInsert.length} artifacts created.`);
  
  return {
    success: true,
    campaignId: campaignId,
    artifactsCount: artifactsToInsert.length,
  };
}

export async function generateDailyPost(campaignId: string, tenantId: string = LEGACY_TENANT_ID) {
  const db = createServiceRoleClient();

  // 1. Fetch Campaign & Plan
  const { data: campaign, error: cErr } = await db
    .from('campaigns')
    .select('*, brand_plans(product_name, product_description)')
    .eq('tenant_id', tenantId)
    .eq('id', campaignId)
    .single();

  if (cErr || !campaign) throw new Error('Campaign not found');

  const platforms = campaign.social_platforms || ['linkedin', 'twitter', 'instagram'];
  const pIdx = Math.floor(Math.random() * platforms.length);
  const selectedPlatform = platforms[pIdx];

  // 2. Fetch last 5 posts to avoid repetition
  const { data: recentArtifacts } = await db
    .from('artifacts')
    .select('text_content')
    .eq('tenant_id', tenantId)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(5);

  const previousPosts = recentArtifacts?.map(a => a.text_content) || [];

  const brandContext = {
    productName: campaign.brand_plans.product_name,
    description: campaign.brand_plans.product_description,
    objective: campaign.objective,
    brandTone: 'Engaging',
  };

  // 3. Generate New Content
  console.log(`[Daily Post] Generating for ${selectedPlatform}...`);
  const content = await generateArtifactContent(selectedPlatform, brandContext, previousPosts);

  let cleanText = content.text_content;
  if (cleanText) cleanText = cleanText.replace(/\*\*/g, '');

  let mediaUrl = null;
  if (content.image_prompt) {
    console.log(`[Daily Post] Generating image...`);
    mediaUrl = await generateImage(content.image_prompt);
  }

  // 4. Save Artifact
  const { data: newArtifact, error: aErr } = await db
    .from('artifacts')
    .insert([{
      tenant_id: tenantId,
      campaign_id: campaignId,
      platform: selectedPlatform,
      type: 'post',
      text_content: cleanText,
      image_prompt: content.image_prompt,
      media_url: mediaUrl,
      status: 'generated'
    }])
    .select()
    .single();

  if (aErr) throw new Error(`Artifact insert failed: ${aErr.message}`);

  return newArtifact;
}
