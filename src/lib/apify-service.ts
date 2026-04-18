/**
 * Competitor Scraping Service — Real-world competitor intelligence
 * 
 * Primary: Jina Reader (FREE) for scraping competitor social profiles
 * Secondary: Apify actors (if APIFY_API_TOKEN is configured)
 * Fallback: Simulated data for demo mode
 */

import { scrapeSocialProfile } from './scraper-service';
import { generateText } from './gemini';

/**
 * Scrape a competitor's social profile and generate AI insights.
 * Uses real web scraping via Jina Reader, then Gemini for analysis.
 */
export async function scrapeCompetitor(platform: string, handle: string) {
  const apifyKey = process.env.APIFY_API_TOKEN;

  // === TIER 1: Real Apify scraping (if configured) ===
  if (apifyKey && apifyKey !== 'your_apify_api_token') {
    try {
      return await scrapeWithApify(platform, handle, apifyKey);
    } catch (e: any) {
      console.warn(`[Competitor Intel] Apify failed, falling back to Jina:`, e.message);
    }
  }

  // === TIER 2: Jina Reader scraping (FREE) ===
  try {
    console.log(`[Competitor Intel] Scraping @${handle} on ${platform} via Jina Reader...`);
    const { text, success } = await scrapeSocialProfile(platform, handle);

    if (success && text.length > 50) {
      console.log(`[Competitor Intel] Scraped ${text.length} chars. Running AI analysis...`);

      // Use Gemini to analyze the scraped content
      const analysisPrompt = `
      Analyze this scraped social media profile data and extract key business intelligence.
      
      PLATFORM: ${platform}
      HANDLE: @${handle}
      
      SCRAPED CONTENT:
      ${text.substring(0, 6000)}
      
      Return a JSON object with these EXACT keys:
      {
        "handle": "${handle}",
        "platform": "${platform}",
        "followers": <estimated number based on content, or 0 if unknown>,
        "engagement_rate": "<estimated engagement rate like '3.2%', or 'Unknown'>",
        "top_posts": [
          {"type": "<image|video|carousel|text>", "likes": <number>, "comments": <number>, "url": "#", "caption_summary": "<short summary>"}
        ],
        "content_themes": ["<theme 1>", "<theme 2>", "<theme 3>"],
        "posting_frequency": "<e.g. '3-4 times per week'>",
        "insight": "<2-3 sentences of strategic insight: what's working for them, what gaps exist, how to compete>"
      }
      
      If exact numbers aren't available from the scraped data, provide your best estimate based on the content quality and engagement signals visible. Be specific with the strategic insight.
      `;

      const analysis = await generateText(analysisPrompt);
      
      return {
        handle: analysis.handle || handle,
        platform: analysis.platform || platform,
        followers: analysis.followers || 0,
        engagement_rate: analysis.engagement_rate || 'Unknown',
        top_posts: analysis.top_posts || [
          { type: 'post', likes: 0, comments: 0, url: '#', caption_summary: 'Data unavailable' }
        ],
        content_themes: analysis.content_themes || [],
        posting_frequency: analysis.posting_frequency || 'Unknown',
        insight: analysis.insight || 'Could not generate insight from scraped data.',
        source: 'jina_reader',
      };
    }
  } catch (err: any) {
    console.error(`[Competitor Intel] Jina Reader scraping failed:`, err.message);
  }

  // === TIER 3: Simulated data (fallback for demo/local) ===
  console.warn(`[Competitor Intel] No scraping method available. Returning simulated data for ${platform}/${handle}`);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  
  return {
    handle,
    platform,
    followers: Math.floor(Math.random() * 500000) + 10000,
    engagement_rate: ((Math.random() * 5) + 1).toFixed(2) + '%',
    top_posts: [
      { type: 'image', likes: Math.floor(Math.random() * 5000), comments: 120, url: '#' },
      { type: 'video', likes: Math.floor(Math.random() * 8000), comments: 450, url: '#' },
      { type: 'carousel', likes: Math.floor(Math.random() * 3000), comments: 80, url: '#' }
    ],
    insight: 'Simulated data — configure Apify or ensure Jina Reader can access this profile for real intelligence.',
    source: 'simulated',
  };
}

/**
 * Real Apify integration for detailed social media scraping.
 */
async function scrapeWithApify(platform: string, handle: string, apiKey: string) {
  // Actor IDs for different platforms
  const actorMap: Record<string, string> = {
    instagram: 'apify/instagram-profile-scraper',
    twitter: 'apify/twitter-scraper',
    linkedin: 'apify/linkedin-company-scraper',
  };

  const actorId = actorMap[platform.toLowerCase()];
  if (!actorId) {
    throw new Error(`No Apify actor mapping for platform: ${platform}`);
  }

  const inputMap: Record<string, any> = {
    instagram: { usernames: [handle.replace('@', '')] },
    twitter: { handles: [handle.replace('@', '')] },
    linkedin: { urls: [`https://www.linkedin.com/company/${handle.replace('@', '')}/`] },
  };

  console.log(`[Apify] Running actor ${actorId} for @${handle}...`);

  const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...inputMap[platform.toLowerCase()],
      maxItems: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apify API returned ${response.status}`);
  }

  const runData = await response.json();
  const datasetId = runData.data?.defaultDatasetId;

  if (!datasetId) {
    throw new Error('Apify run did not return a dataset ID');
  }

  // Wait for the run to complete (poll every 3 seconds, max 60 seconds)
  let attempts = 0;
  while (attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runData.data.id}?token=${apiKey}`
    );
    const statusData = await statusResponse.json();
    
    if (statusData.data?.status === 'SUCCEEDED') break;
    if (statusData.data?.status === 'FAILED') throw new Error('Apify run failed');
    
    attempts++;
  }

  // Fetch results
  const resultsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=10`
  );
  const items = await resultsResponse.json();

  if (!items || items.length === 0) {
    throw new Error('Apify returned no items');
  }

  // Normalize the data (simplified — actual mapping depends on the actor)
  const profile = items[0];
  return {
    handle,
    platform,
    followers: profile.followersCount || profile.followers || 0,
    engagement_rate: profile.engagement_rate || 'N/A',
    top_posts: (profile.latestPosts || profile.posts || []).slice(0, 3).map((p: any) => ({
      type: p.type || 'post',
      likes: p.likesCount || p.likes || 0,
      comments: p.commentsCount || p.comments || 0,
      url: p.url || '#',
    })),
    insight: `Real Apify data scraped. ${profile.followersCount || 0} followers detected.`,
    source: 'apify',
  };
}
