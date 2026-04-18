import { createServiceRoleClient } from '@/lib/supabase';
import { generateText, generateImage } from '@/lib/gemini';
import { scrapeMultipleUrls } from '@/lib/scraper-service';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

export interface PlanningInput {
  tenantId?: string;
  brandId?: string;
  productName: string;
  description: string;
  websiteUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  imageBase64?: string | null;
}

export interface PlanningOptions {
  createSeedCampaigns?: boolean;
}

export interface PlanningOutput {
  plan: any;
  firstCampaignIdea: {
    name?: string;
    objective?: string;
    artifacts?: Array<{
      platform?: string;
      type?: string;
      text_content?: string;
      image_prompt?: string;
    }>;
  } | null;
  activeBrandId: string;
}

function parseImageParts(imageBase64?: string | null) {
  if (!imageBase64) return undefined;
  const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return undefined;
  return [{ data: matches[2], mimeType: matches[1] }];
}

export async function createPlanAndSeedCampaigns(
  input: PlanningInput,
  options: PlanningOptions = {}
): Promise<PlanningOutput> {
  const {
    tenantId,
    brandId,
    productName,
    description,
    websiteUrl,
    instagramUrl,
    linkedinUrl,
    twitterUrl,
    imageBase64,
  } = input;

  if (!productName || !description) {
    throw new Error('Product name and description are required.');
  }

  const activeTenantId = tenantId || LEGACY_TENANT_ID;
  const activeBrandId = brandId || process.env.NEXT_PUBLIC_DEFAULT_BRAND_ID || 'brand_001';
  const createSeedCampaigns = options.createSeedCampaigns !== false;
  const db = createServiceRoleClient();

  const { data: existingBrand } = await db
    .from('brands')
    .select('id')
    .eq('tenant_id', activeTenantId)
    .eq('id', activeBrandId)
    .single();

  if (!existingBrand) {
    await db.from('brands').insert([
      {
        tenant_id: activeTenantId,
        id: activeBrandId,
        name: 'My Brand',
        industry: 'General',
      },
    ]);
  }

  const imageParts = parseImageParts(imageBase64);

  let scrapedContext = '';
  const urlsToScrape = [
    { label: 'Website', url: websiteUrl },
    { label: 'Instagram', url: instagramUrl },
    { label: 'LinkedIn', url: linkedinUrl },
    { label: 'Twitter', url: twitterUrl },
  ].filter((u) => u.url && u.url.trim() !== '');

  if (urlsToScrape.length > 0) {
    scrapedContext = await scrapeMultipleUrls(urlsToScrape as Array<{ label: string; url: string }>);
  }

  const prompt = `
You are a world-class Chief Marketing Officer (CMO).

CONTEXT:
Product: ${productName}
Description: ${description}
Website: ${websiteUrl || 'Not provided'}
Instagram Handle: ${instagramUrl || 'Not provided'}
LinkedIn Handle: ${linkedinUrl || 'Not provided'}
Twitter Handle: ${twitterUrl || 'Not provided'}

${scrapedContext ? `REAL-TIME SCRAPED BRAND INTELLIGENCE:
The following is REAL content scraped directly from the brand's live web presence. Use this as the PRIMARY source of truth for tone, audience, and strategy.
${scrapedContext}

CRITICAL: Base your ICP, brand voice, content pillars, and strategies on the ACTUAL scraped data above, NOT generic assumptions.` : (websiteUrl || instagramUrl || linkedinUrl ? 'NOTE: URL scraping was attempted but returned no data. Base your analysis on the product description provided.' : '')}

${imageBase64 ? '\nCRITICAL IMAGE CONTEXT:\nAn image of the product/brand has been provided. Analyze it visually and incorporate its features, aesthetic, and target audience vibe into your strategies.' : ''}

TASK:
1. Generate a strategic marketing plan (Analysis, ICP, Strategies).
2. Create 1 distinct marketing campaign.
3. Generate EXACTLY 3 content artifacts for this campaign: one for linkedin, one for twitter (X), and one for instagram.

CRITICAL RESTRICTIONS:
- Generate ONLY standard feed posts (Text + Image Prompt) or short tweets.
- DO NOT generate Stories, Reels, TikToks, or Video Scripts.
- The content must be ready-to-post text.
- Do NOT use Markdown formatting inside the JSON values.

JSON Structure:
{
  "ideal_customer_profile": {
    "summary": "3-4 sentence comprehensive overview.",
    "demographics": ["Age range", "Role/Occupation", "Location", "Income Level"],
    "pain_points": ["Pain 1", "Pain 2", "Pain 3", "Pain 4"],
    "psychographics": ["Values", "Interests", "Behaviors"],
    "objections": ["Common reason 1 they won't buy", "Common reason 2"]
  },
  "brand_voice_guidelines": {
    "tone": "Describe the core tone (e.g. Professional yet witty)",
    "keywords": ["Word 1", "Word 2", "Word 3"],
    "dos_and_donts": ["DO: Speak clearly", "DONT: Use jargon"]
  },
  "content_pillars": [
    { "name": "Pillar 1", "description": "What this covers and why it matters" },
    { "name": "Pillar 2", "description": "What this covers and why it matters" },
    { "name": "Pillar 3", "description": "What this covers and why it matters" }
  ],
  "market_analysis": {
    "competitors": [
      { "name": "Competitor A", "strategy": "Their strategy..." },
      { "name": "Competitor B", "strategy": "Their strategy..." }
    ],
    "marketing_channels": ["Channel 1", "Channel 2"],
    "market_gaps": ["Gap 1", "Gap 2"],
    "unique_selling_propositions": ["USP 1", "USP 2"]
  },
  "suggested_strategies": [
    { "title": "Strategy Name", "description": "Explanation..." }
  ],
  "roadmap_30_days": [
    { "week": "Week 1", "focus": "What to do first..." },
    { "week": "Week 2", "focus": "Next steps..." },
    { "week": "Week 3", "focus": "Scaling up..." },
    { "week": "Week 4", "focus": "Analyzing and iterating..." }
  ],
  "campaign_ideas": [
    {
      "name": "Campaign Name",
      "objective": "Campaign objective",
      "artifacts": [
        {
          "platform": "linkedin",
          "type": "post",
          "text_content": "Full professional LinkedIn post with hashtags...",
          "image_prompt": "Detailed, photorealistic image description..."
        },
        {
          "platform": "twitter",
          "type": "post",
          "text_content": "A compelling tweet under 280 characters...",
          "image_prompt": "Image description..."
        },
        {
          "platform": "instagram",
          "type": "post",
          "text_content": "Engaging Instagram caption with 10-15 hashtags...",
          "image_prompt": "Striking visual image description..."
        }
      ]
    }
  ]
}
`;

  const aiData = await generateText(prompt, imageParts);

  const { data: planData, error: planError } = await db
    .from('brand_plans')
    .insert([
      {
        tenant_id: activeTenantId,
        product_name: productName,
        product_description: description,
        brand_id: activeBrandId,
        ai_research_result: {
          ideal_customer_profile: aiData.ideal_customer_profile,
          market_analysis: aiData.market_analysis,
          suggested_strategies: aiData.suggested_strategies,
          brand_voice_guidelines: aiData.brand_voice_guidelines,
          content_pillars: aiData.content_pillars,
          roadmap_30_days: aiData.roadmap_30_days,
          urls: {
            website: websiteUrl,
            instagram: instagramUrl,
            linkedin: linkedinUrl,
            twitter: twitterUrl,
          },
        },
      },
    ])
    .select()
    .single();

  if (planError) throw new Error(`Plan creation failed: ${planError.message}`);
  const planId = planData.id;

  if (createSeedCampaigns && aiData.campaign_ideas && Array.isArray(aiData.campaign_ideas)) {
    for (const campaign of aiData.campaign_ideas) {
      const { data: campData, error: campError } = await db
        .from('campaigns')
        .insert([
          {
            tenant_id: activeTenantId,
            brand_plan_id: planId,
            brand_id: activeBrandId,
            name: campaign.name,
            objective: campaign.objective,
            status: 'active',
            social_platforms: campaign.artifacts?.map((a: any) => a.platform) || [],
            instagram_url: instagramUrl,
            linkedin_url: linkedinUrl,
            twitter_url: twitterUrl,
          },
        ])
        .select()
        .single();

      if (campError) {
        console.error('Campaign insert error:', campError);
        continue;
      }

      const campId = campData.id;

      if (campaign.artifacts && Array.isArray(campaign.artifacts)) {
        const artifactsToInsert = await Promise.all(
          campaign.artifacts.map(async (art: any) => {
            let mediaUrl: string | null = null;
            let cleanText = art.text_content;

            if (cleanText) {
              cleanText = cleanText.replace(/\*\*/g, '');
            }

            if (art.image_prompt) {
              try {
                mediaUrl = await generateImage(art.image_prompt);
              } catch (imgErr) {
                console.error(`[Ghost Planner] Image generation failed for ${art.platform}:`, imgErr);
              }
            }

            return {
              campaign_id: campId,
              platform: art.platform,
              type: art.type || 'post',
              text_content: cleanText,
              image_prompt: art.image_prompt,
              media_url: mediaUrl,
              status: 'generated',
            };
          })
        );

        const tenantArtifacts = artifactsToInsert.map((artifact) => ({
          ...artifact,
          tenant_id: activeTenantId,
        }));

        const { error: artError } = await db.from('artifacts').insert(tenantArtifacts);
        if (artError) console.error('Artifact insert error:', artError);
      }
    }
  }

  const firstCampaignIdea =
    aiData.campaign_ideas && Array.isArray(aiData.campaign_ideas) && aiData.campaign_ideas.length > 0
      ? aiData.campaign_ideas[0]
      : null;

  return {
    plan: planData,
    firstCampaignIdea,
    activeBrandId,
  };
}
