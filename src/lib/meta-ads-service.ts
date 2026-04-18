/**
 * Meta Ads Service — Real Facebook & Instagram Ad Launching
 * 
 * Uses the Meta Graph API to create real campaigns, ad sets, and ads.
 * The JSON payloads we already generate in ads-service.ts can now be
 * sent directly to Meta's API.
 * 
 * Prerequisites:
 * 1. Create a Meta Business App at https://developers.facebook.com
 * 2. Get an Ad Account ID from Business Manager
 * 3. Generate a long-lived access token with ads_management permission
 * 4. Set META_ACCESS_TOKEN, META_AD_ACCOUNT_ID in .env
 */

const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaAdPayload {
  name: string;
  optimization_goal: string;
  billing_event: string;
  bid_amount?: number;
  targeting?: {
    geo_locations?: { countries?: string[] };
    interests?: { id: string; name: string }[];
    age_min?: number;
    age_max?: number;
  };
  creative?: {
    title: string;
    body: string;
    call_to_action_type: string;
    image_url?: string;
    link_url?: string;
  };
}

interface MetaApiResponse {
  success: boolean;
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  error?: string;
  rawResponse?: any;
}

/**
 * Check if Meta Ads integration is configured.
 */
export function isMetaAdsConfigured(): boolean {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  return !!(token && token !== 'your_meta_access_token' && accountId && accountId !== 'act_your_ad_account_id');
}

/**
 * Create a real Meta Ads campaign.
 * This creates the campaign shell — ad sets and ads are created separately.
 */
async function createMetaCampaign(
  name: string,
  objective: string = 'OUTCOME_TRAFFIC',
  dailyBudget: number
): Promise<{ id: string } | null> {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  try {
    const response = await fetch(`${META_BASE_URL}/${accountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        objective,
        status: 'PAUSED', // Start paused for safety — user can activate
        special_ad_categories: [],
        access_token: accessToken,
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('[Meta Ads] Campaign creation failed:', data.error.message);
      return null;
    }

    console.log(`[Meta Ads] Campaign created: ${data.id}`);
    return { id: data.id };
  } catch (error: any) {
    console.error('[Meta Ads] Campaign creation error:', error.message);
    return null;
  }
}

/**
 * Create a real Meta Ad Set (targeting + budget).
 */
async function createMetaAdSet(
  campaignId: string,
  payload: MetaAdPayload,
  dailyBudget: number
): Promise<{ id: string } | null> {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  try {
    const response = await fetch(`${META_BASE_URL}/${accountId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name || 'AI-Generated Ad Set',
        campaign_id: campaignId,
        optimization_goal: payload.optimization_goal || 'LINK_CLICKS',
        billing_event: payload.billing_event || 'IMPRESSIONS',
        bid_amount: payload.bid_amount || 250,
        daily_budget: Math.round(dailyBudget * 100), // Meta expects cents
        targeting: payload.targeting || {
          geo_locations: { countries: ['US'] },
        },
        status: 'PAUSED',
        access_token: accessToken,
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('[Meta Ads] Ad Set creation failed:', data.error.message);
      return null;
    }

    console.log(`[Meta Ads] Ad Set created: ${data.id}`);
    return { id: data.id };
  } catch (error: any) {
    console.error('[Meta Ads] Ad Set creation error:', error.message);
    return null;
  }
}

/**
 * Create a real Meta Ad Creative + Ad.
 */
async function createMetaAd(
  adSetId: string,
  creative: MetaAdPayload['creative'],
  imageUrl?: string
): Promise<{ id: string } | null> {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  try {
    // First: create the ad creative
    const creativePayload: any = {
      name: creative?.title || 'AI Creative',
      object_story_spec: {
        link_data: {
          message: creative?.body || '',
          name: creative?.title || '',
          call_to_action: {
            type: creative?.call_to_action_type || 'LEARN_MORE',
          },
        },
      },
      access_token: accessToken,
    };

    // If we have an image URL, attach it
    if (imageUrl && imageUrl.startsWith('http')) {
      creativePayload.object_story_spec.link_data.picture = imageUrl;
    }

    const creativeResponse = await fetch(`${META_BASE_URL}/${accountId}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creativePayload),
    });

    const creativeData = await creativeResponse.json();
    if (creativeData.error) {
      console.error('[Meta Ads] Creative creation failed:', creativeData.error.message);
      return null;
    }

    // Then: create the actual ad linking to the creative and ad set
    const adResponse = await fetch(`${META_BASE_URL}/${accountId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: creative?.title || 'AI-Generated Ad',
        adset_id: adSetId,
        creative: { creative_id: creativeData.id },
        status: 'PAUSED',
        access_token: accessToken,
      }),
    });

    const adData = await adResponse.json();
    if (adData.error) {
      console.error('[Meta Ads] Ad creation failed:', adData.error.message);
      return null;
    }

    console.log(`[Meta Ads] Ad created: ${adData.id} (Creative: ${creativeData.id})`);
    return { id: adData.id };
  } catch (error: any) {
    console.error('[Meta Ads] Ad creation error:', error.message);
    return null;
  }
}

/**
 * Main entry point: Launch a full Meta ad (Campaign → Ad Set → Ad).
 * Takes the JSON payload from our ads-service and pushes it to Meta.
 */
export async function launchMetaAd(
  payload: MetaAdPayload,
  dailyBudget: number,
  imageUrl?: string
): Promise<MetaApiResponse> {
  if (!isMetaAdsConfigured()) {
    return {
      success: false,
      error: 'Meta Ads not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in .env',
    };
  }

  try {
    // Step 1: Create Campaign
    const campaign = await createMetaCampaign(payload.name || 'AI Campaign', 'OUTCOME_TRAFFIC', dailyBudget);
    if (!campaign) return { success: false, error: 'Failed to create Meta campaign' };

    // Step 2: Create Ad Set
    const adSet = await createMetaAdSet(campaign.id, payload, dailyBudget);
    if (!adSet) return { success: false, error: 'Failed to create Meta ad set' };

    // Step 3: Create Ad
    const ad = await createMetaAd(adSet.id, payload.creative, imageUrl);
    if (!ad) return { success: false, error: 'Failed to create Meta ad' };

    return {
      success: true,
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get real performance metrics from Meta for a given ad.
 */
export async function getMetaAdInsights(adId: string): Promise<any> {
  if (!isMetaAdsConfigured()) return null;

  const accessToken = process.env.META_ACCESS_TOKEN;

  try {
    const response = await fetch(
      `${META_BASE_URL}/${adId}/insights?fields=impressions,clicks,ctr,spend,actions&access_token=${accessToken}`
    );
    const data = await response.json();
    return data.data?.[0] || null;
  } catch (error: any) {
    console.error('[Meta Ads] Insights fetch failed:', error.message);
    return null;
  }
}
