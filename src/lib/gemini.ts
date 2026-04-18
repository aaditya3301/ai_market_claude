import { llmRouter, type LLMTask } from '@/lib/llm/router';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

/**
 * Generate text using Gemini 2.5 Flash with JSON output
 */
export async function generateText(
  prompt: string,
  imageParts?: { data: string; mimeType: string }[],
  options?: { tenantId?: string; runId?: string; task?: LLMTask }
): Promise<any> {
  const response = await llmRouter.call<any>({
    tenantId: options?.tenantId || LEGACY_TENANT_ID,
    runId: options?.runId,
    task: options?.task || 'feature_extraction',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    responseFormat: 'json',
    attachments: (imageParts || []).map((img) => ({
      mimeType: img.mimeType,
      data: img.data,
    })),
  });

  return response.data;
}

/**
 * Generate platform-specific social media content
 */
export async function generateArtifactContent(
  platform: string,
  brandContext: { productName: string; description: string; objective: string; brandTone: string; warRoomInsights?: string },
  previousPosts?: string[]
): Promise<{ text_content: string; image_prompt: string }> {
  const platformGuides: Record<string, string> = {
    linkedin: 'Professional, thought leadership tone. 1-2 paragraphs. Include 3-5 relevant hashtags at the end.',
    twitter: 'Punchy, concise. MUST be under 280 characters total. Witty and engaging. 1-2 hashtags max.',
    instagram: 'Visual-first, engaging caption. Use a professional corporate tone without emojis. Include 10-15 relevant hashtags at the end.',
    facebook: 'Community-focused, conversational. 2-3 paragraphs. Encourage engagement with a question at the end.',
    reddit: 'Authentic, informative, no marketing fluff. Sound like a real human sharing value. No hashtags.',
  };

  const guide = platformGuides[platform.toLowerCase()] || platformGuides.linkedin;
  const dedupeContext = previousPosts?.length
    ? `\n\nIMPORTANT: Here are recent posts. Create DIFFERENT content:\n${previousPosts.map((p, i) => `${i + 1}. ${p.substring(0, 100)}...`).join('\n')}`
    : '';

  const prompt = `
You are a world-class social media copywriter.

PRODUCT: ${brandContext.productName}
DESCRIPTION: ${brandContext.description}
OBJECTIVE: ${brandContext.objective}
BRAND TONE: ${brandContext.brandTone}
${brandContext.warRoomInsights ? `CRITICAL WAR ROOM DIRECTIVES (FOLLOW THESE STRATEGIC RULES):\n${brandContext.warRoomInsights}` : ''}
PLATFORM: ${platform}
PLATFORM GUIDE: ${guide}
${dedupeContext}

Generate ONE social media post for ${platform}. Return JSON:
{
  "text_content": "The full post text, ready to publish.",
  "image_prompt": "A detailed prompt to generate a compelling image for this post. Describe the style, colors, composition, and mood. Make it photorealistic and professional."
}
`;

  return await generateText(prompt);
}

/**
 * Generate an image using a 3-tier pipeline:
 * 1. Fal.ai Flux (real AI images, fast and cheap)
 * 2. Google Imagen (via Gemini API)
 * 3. Placeholder (fallback for free tier / no keys)
 */
export async function generateImage(prompt: string, options?: { aspectRatio?: '1:1' | '16:9' | '9:16' }): Promise<string | null> {
  // === TIER 1: Try Fal.ai Flux first (primary engine) ===
  try {
    const { generateImageWithFal } = await import('./fal-service');
    const falResult = await generateImageWithFal(prompt, { aspectRatio: options?.aspectRatio || '1:1' });
    if (falResult) {
      console.log('[Image Gen] Fal.ai Flux succeeded ✓');
      return falResult;
    }
  } catch (e: any) {
    console.warn('[Image Gen] Fal.ai unavailable, trying Imagen...', e.message);
  }

  // === TIER 2: Try Google Imagen (via Gemini API) ===
  const apiKey = process.env.GEMINI_API_KEY_IMAGE || process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: options?.aspectRatio || '1:1',
              safetyFilterLevel: 'BLOCK_MEDIUM_AND_ABOVE',
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.predictions && data.predictions.length > 0) {
          const base64 = data.predictions[0].bytesBase64Encoded;
          console.log('[Image Gen] Google Imagen succeeded ✓');
          return `data:image/png;base64,${base64}`;
        }
      } else {
        const errorText = await response.text();
        console.warn('[Image Gen] Imagen API Error:', response.status, errorText.substring(0, 200));
      }
    } catch (error: any) {
      console.warn('[Image Gen] Imagen failed:', error.message);
    }
  }

  // === TIER 3: Placeholder fallback (no cost, no API key needed) ===
  console.log('[Image Gen] All image engines exhausted, using placeholder.');
  const encodedPrompt = encodeURIComponent(prompt.substring(0, 30).trim() + '...');
  return `https://placehold.co/600x600/1F2937/10B981?font=playfair-display&text=${encodedPrompt}`;
}
