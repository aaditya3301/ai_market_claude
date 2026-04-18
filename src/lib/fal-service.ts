/**
 * Fal.ai Image Generation Service — Real-world AI image generation
 * 
 * Uses Fal.ai's Flux models for ultra-realistic, fast image generation.
 * Falls back to Google Imagen if Fal.ai key is not configured.
 * 
 * Pricing: Fractions of a cent per image (~$0.003 per image)
 * Sign up: https://fal.ai
 */

const FAL_API_BASE = 'https://queue.fal.run';

interface FalImageResult {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

/**
 * Generate an image using Fal.ai Flux model.
 * Returns a CDN URL of the generated image.
 */
export async function generateImageWithFal(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    model?: string;
  } = {}
): Promise<string | null> {
  const apiKey = process.env.FAL_KEY;
  
  if (!apiKey || apiKey === 'your_fal_api_key') {
    console.log('[Fal.ai] No API key configured, skipping.');
    return null;
  }

  const model = options.model || 'fal-ai/flux/schnell'; // Fast + free tier friendly
  const aspectRatio = options.aspectRatio || '1:1';

  // Map aspect ratios to pixel dimensions
  const sizeMap: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720, height: 1280 },
    '4:3': { width: 1024, height: 768 },
    '3:4': { width: 768, height: 1024 },
  };
  const size = sizeMap[aspectRatio] || sizeMap['1:1'];

  try {
    console.log(`[Fal.ai] Generating image with ${model}...`);
    
    // Submit to Fal.ai queue
    const response = await fetch(`${FAL_API_BASE}/${model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: prompt,
        image_size: {
          width: size.width,
          height: size.height,
        },
        num_inference_steps: 4, // Schnell is optimized for 4 steps
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Fal.ai] API Error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    
    // Extract the image URL from the response
    const images = data.images || data.output?.images || [];
    if (images.length > 0) {
      const imageUrl = images[0].url || images[0];
      console.log(`[Fal.ai] Image generated successfully: ${imageUrl.substring(0, 80)}...`);
      return imageUrl;
    }

    // Handle queued responses (for pro models)
    if (data.request_id) {
      console.log(`[Fal.ai] Request queued: ${data.request_id}, polling for result...`);
      return await pollFalResult(data.request_id, model, apiKey);
    }

    console.warn('[Fal.ai] No images in response:', JSON.stringify(data).substring(0, 200));
    return null;
  } catch (error: any) {
    console.error('[Fal.ai] Generation failed:', error.message);
    return null;
  }
}

/**
 * Poll Fal.ai for queued results (used by Pro models that return a request_id)
 */
async function pollFalResult(requestId: string, model: string, apiKey: string): Promise<string | null> {
  const maxAttempts = 30;
  const pollInterval = 2000; // 2 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      const statusResponse = await fetch(
        `${FAL_API_BASE}/${model}/requests/${requestId}/status`,
        {
          headers: { 'Authorization': `Key ${apiKey}` },
        }
      );

      const statusData = await statusResponse.json();
      
      if (statusData.status === 'COMPLETED') {
        // Fetch the result
        const resultResponse = await fetch(
          `${FAL_API_BASE}/${model}/requests/${requestId}`,
          {
            headers: { 'Authorization': `Key ${apiKey}` },
          }
        );
        const resultData = await resultResponse.json();
        const images = resultData.images || resultData.output?.images || [];
        if (images.length > 0) {
          return images[0].url || images[0];
        }
        return null;
      }

      if (statusData.status === 'FAILED') {
        console.error('[Fal.ai] Request failed:', statusData);
        return null;
      }

      // Still IN_QUEUE or IN_PROGRESS — continue polling
    } catch (error: any) {
      console.error(`[Fal.ai] Poll attempt ${attempt + 1} failed:`, error.message);
    }
  }

  console.error('[Fal.ai] Polling timed out after 60 seconds');
  return null;
}

/**
 * Generate a high-quality ad banner image.
 * Uses Flux Pro for higher quality if available, otherwise Schnell.
 */
export async function generateAdBanner(
  prompt: string,
  format: 'feed' | 'story' | 'banner' = 'feed'
): Promise<string | null> {
  const aspectMap: Record<string, '1:1' | '16:9' | '9:16'> = {
    feed: '1:1',
    story: '9:16',
    banner: '16:9',
  };

  // Try Flux Pro first for ad quality, fall back to Schnell
  const proKey = process.env.FAL_KEY;
  if (proKey && proKey !== 'your_fal_api_key') {
    return generateImageWithFal(prompt, {
      aspectRatio: aspectMap[format],
      model: 'fal-ai/flux/schnell', // Use schnell for speed; upgrade to 'fal-ai/flux-pro' for quality
    });
  }

  return null;
}
