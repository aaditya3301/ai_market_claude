/**
 * Postiz Social Media Scheduling Service — Real Publishing
 * 
 * Postiz is an open-source social media scheduling tool.
 * Self-host it via Docker: docker-compose up postiz
 * Then connect your Twitter, LinkedIn, Instagram, Reddit accounts in Postiz.
 * This service sends posts from our Autopublisher cron to Postiz,
 * which handles the complex OAuth2 flows with each social network.
 * 
 * When POSTIZ_API_URL and NEXT_PUBLIC_POSTIZ_KEY are configured,
 * posts are REALLY published. Otherwise, they are simulated.
 */

interface PostizResult {
  success: boolean;
  postId: string;
  message: string;
  isSimulated: boolean;
}

/**
 * Check if Postiz is configured and available.
 */
export function isPostizConfigured(): boolean {
  const apiUrl = process.env.POSTIZ_API_URL;
  const apiKey = process.env.POSTIZ_API_KEY || process.env.NEXT_PUBLIC_POSTIZ_KEY;
  return !!(
    apiUrl && apiUrl !== 'your_postiz_url' && apiUrl.startsWith('http') &&
    apiKey && apiKey !== 'your_postiz_api_key'
  );
}

/**
 * Schedule or publish a post via Postiz.
 * 
 * When Postiz is configured: Sends a real POST request to Postiz API.
 * Postiz then pushes it to the connected social network (Twitter, LinkedIn, etc.)
 * 
 * When Postiz is NOT configured: Simulates the scheduling (for local dev).
 */
export async function schedulePostToPostiz(
  platform: string,
  content: string,
  mediaUrl: string | null,
  scheduleTime: Date
): Promise<PostizResult> {
  const apiUrl = process.env.POSTIZ_API_URL;
  const apiKey = process.env.POSTIZ_API_KEY || process.env.NEXT_PUBLIC_POSTIZ_KEY;

  // === SIMULATED MODE (no Postiz configured) ===
  if (!apiUrl || apiUrl === 'your_postiz_url' || !apiUrl.startsWith('http') || !apiKey || apiKey === 'your_postiz_api_key') {
    console.warn(`[Postiz] API not configured. Simulating ${platform} post scheduling.`);
    return {
      success: true,
      postId: `sim_${Date.now()}_${platform}`,
      message: `Simulated: ${platform} post would be published at ${scheduleTime.toISOString()}`,
      isSimulated: true,
    };
  }

  // === REAL POSTIZ PUBLISHING ===
  try {
    console.log(`[Postiz] Publishing to ${platform} via ${apiUrl}...`);

    // Map our platform names to Postiz's expected format
    const platformMap: Record<string, string> = {
      'twitter': 'twitter',
      'x': 'twitter',
      'linkedin': 'linkedin',
      'instagram': 'instagram',
      'facebook': 'facebook',
      'reddit': 'reddit',
    };

    const postizPlatform = platformMap[platform.toLowerCase()] || platform.toLowerCase();

    // Build the payload
    const payload: any = {
      content,
      platforms: [postizPlatform],
      scheduledAt: scheduleTime.toISOString(),
      status: scheduleTime > new Date() ? 'scheduled' : 'published',
    };

    // Attach media if available (must be a publicly accessible URL)
    if (mediaUrl && mediaUrl.startsWith('http')) {
      payload.media = [mediaUrl];
    }

    const response = await fetch(`${apiUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Postiz] API Error ${response.status}:`, errorData);
      
      // Don't throw — return failure to let the cron continue
      return {
        success: false,
        postId: '',
        message: `Postiz API returned ${response.status}: ${errorData.substring(0, 200)}`,
        isSimulated: false,
      };
    }

    const data = await response.json();
    console.log(`[Postiz] ✓ Post published to ${platform}. Post ID: ${data.id || 'N/A'}`);
    
    return {
      success: true,
      postId: data.id || data.postId || `postiz_${Date.now()}`,
      message: `Successfully ${payload.status} on ${platform}`,
      isSimulated: false,
    };
  } catch (error: any) {
    console.error(`[Postiz] Publishing failed:`, error.message);
    
    // Network errors (Postiz down, Docker not running, etc.)
    return {
      success: false,
      postId: '',
      message: `Postiz connection failed: ${error.message}. Is Postiz running? (docker-compose up postiz)`,
      isSimulated: false,
    };
  }
}

/**
 * Publish immediately (convenience wrapper).
 */
export async function publishNowToPostiz(
  platform: string,
  content: string,
  mediaUrl: string | null
): Promise<PostizResult> {
  return schedulePostToPostiz(platform, content, mediaUrl, new Date());
}
