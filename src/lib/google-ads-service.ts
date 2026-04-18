/**
 * Google Ads Service — Real Google Search & Display Ad Launching
 * 
 * Uses the Google Ads REST API to create responsive search ads.
 * The JSON payloads from ads-service.ts can now be pushed live.
 * 
 * Prerequisites:
 * 1. Create a Google Cloud project at https://console.cloud.google.com
 * 2. Enable the Google Ads API
 * 3. Create OAuth2 credentials (client ID + secret)
 * 4. Get a developer token from https://ads.google.com/aw/apicenter
 * 5. Generate a refresh token using the OAuth2 playground
 * 6. Set all GOOGLE_ADS_* vars in .env
 */

const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com';
const GOOGLE_ADS_API_VERSION = 'v17';

interface GoogleAdPayload {
  ad_group_ad: {
    ad: {
      responsive_search_ad: {
        headlines: { text: string }[];
        descriptions: { text: string }[];
        path1?: string;
        path2?: string;
      };
    };
    status: string;
  };
}

interface GoogleAdsResponse {
  success: boolean;
  campaignId?: string;
  adGroupId?: string;
  adId?: string;
  error?: string;
}

/**
 * Check if Google Ads integration is configured.
 */
export function isGoogleAdsConfigured(): boolean {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  return !!(
    devToken && devToken !== 'your_developer_token' &&
    refreshToken && refreshToken !== 'your_refresh_token' &&
    clientId && clientId !== 'your_google_client_id'
  );
}

/**
 * Get a fresh access token from the refresh token.
 */
async function getGoogleAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken!,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (data.access_token) {
      return data.access_token;
    }

    console.error('[Google Ads] Token refresh failed:', data);
    return null;
  } catch (error: any) {
    console.error('[Google Ads] Token refresh error:', error.message);
    return null;
  }
}

/**
 * Make an authenticated request to the Google Ads API.
 */
async function googleAdsRequest(
  endpoint: string,
  method: string = 'POST',
  body?: any
): Promise<any> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error('Failed to get Google Ads access token');

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, '');
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  const url = `${GOOGLE_ADS_BASE}/${GOOGLE_ADS_API_VERSION}/customers/${customerId}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': devToken!,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (data.error) {
    console.error('[Google Ads] API Error:', data.error);
    throw new Error(data.error.message || 'Google Ads API error');
  }

  return data;
}

/**
 * Create a Google Ads campaign.
 */
async function createGoogleCampaign(
  name: string,
  dailyBudget: number
): Promise<string | null> {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, '');

  try {
    // First create a campaign budget
    const budgetResult = await googleAdsRequest('/campaignBudgets:mutate', 'POST', {
      operations: [{
        create: {
          name: `${name}_Budget_${Date.now()}`,
          amountMicros: String(Math.round(dailyBudget * 1_000_000)), // Budget in micros
          deliveryMethod: 'STANDARD',
        },
      }],
    });

    const budgetResourceName = budgetResult.results?.[0]?.resourceName;
    if (!budgetResourceName) {
      console.error('[Google Ads] Budget creation failed');
      return null;
    }

    // Then create the campaign
    const campaignResult = await googleAdsRequest('/campaigns:mutate', 'POST', {
      operations: [{
        create: {
          name,
          advertisingChannelType: 'SEARCH',
          status: 'PAUSED', // Start paused for safety
          campaignBudget: budgetResourceName,
          manualCpc: {}, // Manual CPC bidding
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: true,
          },
        },
      }],
    });

    const campaignResourceName = campaignResult.results?.[0]?.resourceName;
    console.log(`[Google Ads] Campaign created: ${campaignResourceName}`);
    return campaignResourceName;
  } catch (error: any) {
    console.error('[Google Ads] Campaign creation failed:', error.message);
    return null;
  }
}

/**
 * Create an ad group under a campaign.
 */
async function createAdGroup(
  campaignResourceName: string,
  name: string
): Promise<string | null> {
  try {
    const result = await googleAdsRequest('/adGroups:mutate', 'POST', {
      operations: [{
        create: {
          name: `${name}_AdGroup`,
          campaign: campaignResourceName,
          status: 'ENABLED',
          type: 'SEARCH_STANDARD',
          cpcBidMicros: '500000', // $0.50 default CPC
        },
      }],
    });

    const resourceName = result.results?.[0]?.resourceName;
    console.log(`[Google Ads] Ad Group created: ${resourceName}`);
    return resourceName;
  } catch (error: any) {
    console.error('[Google Ads] Ad Group creation failed:', error.message);
    return null;
  }
}

/**
 * Create a responsive search ad.
 */
async function createResponsiveSearchAd(
  adGroupResourceName: string,
  payload: GoogleAdPayload
): Promise<string | null> {
  try {
    const rsa = payload.ad_group_ad.ad.responsive_search_ad;

    // Ensure we have the right number of headlines (min 3, max 15) and descriptions (min 2, max 4)
    const headlines = rsa.headlines.slice(0, 15).map((h, i) => ({
      text: h.text.substring(0, 30), // Max 30 chars per headline
      pinnedField: i === 0 ? 'HEADLINE_1' : undefined,
    }));

    const descriptions = rsa.descriptions.slice(0, 4).map(d => ({
      text: d.text.substring(0, 90), // Max 90 chars per description
    }));

    const result = await googleAdsRequest('/adGroupAds:mutate', 'POST', {
      operations: [{
        create: {
          adGroup: adGroupResourceName,
          status: 'PAUSED',
          ad: {
            responsiveSearchAd: {
              headlines,
              descriptions,
              path1: rsa.path1?.substring(0, 15) || '',
              path2: rsa.path2?.substring(0, 15) || '',
            },
            finalUrls: [process.env.NEXT_PUBLIC_APP_URL || 'https://example.com'],
          },
        },
      }],
    });

    const resourceName = result.results?.[0]?.resourceName;
    console.log(`[Google Ads] Responsive Search Ad created: ${resourceName}`);
    return resourceName;
  } catch (error: any) {
    console.error('[Google Ads] Ad creation failed:', error.message);
    return null;
  }
}

/**
 * Main entry point: Launch a full Google Search ad.
 * Creates Campaign → Ad Group → Responsive Search Ad.
 */
export async function launchGoogleAd(
  payload: GoogleAdPayload,
  campaignName: string,
  dailyBudget: number
): Promise<GoogleAdsResponse> {
  if (!isGoogleAdsConfigured()) {
    return {
      success: false,
      error: 'Google Ads not configured. Set all GOOGLE_ADS_* vars in .env',
    };
  }

  try {
    // Step 1: Campaign
    const campaignResource = await createGoogleCampaign(campaignName, dailyBudget);
    if (!campaignResource) return { success: false, error: 'Failed to create Google campaign' };

    // Step 2: Ad Group
    const adGroupResource = await createAdGroup(campaignResource, campaignName);
    if (!adGroupResource) return { success: false, error: 'Failed to create Google ad group' };

    // Step 3: Responsive Search Ad
    const adResource = await createResponsiveSearchAd(adGroupResource, payload);
    if (!adResource) return { success: false, error: 'Failed to create Google ad' };

    return {
      success: true,
      campaignId: campaignResource,
      adGroupId: adGroupResource,
      adId: adResource,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
