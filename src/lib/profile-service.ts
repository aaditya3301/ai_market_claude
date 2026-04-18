import { supabase } from './supabase';
import { generateText, generateImage } from './gemini';

export async function optimizeProfile(
  brandId: string,
  platform: string,
  brandContext: { name: string; industry: string; voice: string; website?: string }
) {
  // 1. Fetch the Global Brand Context Brain (latest brand plan)
  const { data: latestPlan } = await supabase
    .from('brand_plans')
    .select('ai_research_result, product_name')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const globalContext = latestPlan?.ai_research_result || {};
  const voice = globalContext?.brand_voice_guidelines?.tone || brandContext.voice;
  const icp = globalContext?.ideal_customer_profile?.summary || 'General audience';
  const urls = globalContext?.urls || {};

  // 2. Generate Profile Text (Bio, handles, prompts)
  let platformRequirements = '';
  let formatInstructions = '';

  if (platform.toLowerCase() === 'twitter') {
    platformRequirements = '- X (Twitter) API Payload: Display Name (Max 50), Handle (Max 15), Bio (Max 160), Location (Max 30), Website Idea (Max 100).';
    formatInstructions = `
Generate a JSON object with strictly these keys:
{
  "display_name": "A strong Display Name (Max 50)",
  "handle": "@A_catchy_handle (Max 15)",
  "bio": "The exact optimized X bio text (Max 160, extremely professional tone, NO emojis)",
  "location": "A smart location or status (Max 30)",
  "website_idea": "A short, conversion-focused link idea",
  "dp_image_prompt": "A prompt to generate a highly professional and minimal profile picture / logo for this brand. Should be clean, centered, and memorable."
}`;
  } else if (platform.toLowerCase() === 'instagram') {
    platformRequirements = '- Instagram API Payload: Name (Max 30), Username (Max 30), Bio (Max 150). Use line breaks. DO NOT use emojis.';
    formatInstructions = `
Generate a JSON object with strictly these keys:
{
  "name": "Bold Name Field capturing keywords (Max 30)",
  "username": "@clean_username (Max 30)",
  "bio": "A multi-line professional corporate IG bio (Max 150. NO emojis)",
  "link_idea": "A suggested link-in-bio call to action",
  "dp_image_prompt": "A prompt to generate a highly professional and minimal profile picture / logo for this brand. Should be clean, centered, and memorable."
}`;
  } else if (platform.toLowerCase() === 'linkedin') {
    platformRequirements = '- LinkedIn Company Page API Payload: Company Name (Max 100), Tagline (Max 120), About (Max 2000), Specialties (Max 256).';
    formatInstructions = `
Generate a JSON object with strictly these keys:
{
  "name": "Official Company Name (Max 100)",
  "tagline": "A powerful 1-liner tagline (Max 120)",
  "about": "A comprehensive, professional 'About Us' section detailing mission, vision, and value proposition (Max 2000)",
  "specialties": ["Specialty 1", "Specialty 2", "Specialty 3"],
  "dp_image_prompt": "A prompt to generate a highly professional and minimal profile picture / logo for this brand. Should be clean, centered, and memorable."
}`;
  } else {
    platformRequirements = '- Generic: Bio, tagline, handles';
    formatInstructions = `
Generate a JSON object with strictly these keys:
{
  "bio": "The exact optimized bio text",
  "tagline": "A short, punchy 3-5 word tagline for this brand",
  "handle_suggestions": ["@best_handle1", "@handle2", "handle3_official"],
  "dp_image_prompt": "A prompt to generate a highly professional and minimal profile picture / logo logo avatar for this brand. Should be clean, centered, and memorable."
}`;
  }

  const prompt = `
You are a world-class social media strategist and API integration agent.
I need you to generate an optimized profile setup JSON payload to automatically update a brand on ${platform}.

GLOBAL BRAND CONTEXT (From Planning Brain):
- Brand Name: ${latestPlan?.product_name || brandContext.name}
- Industry: ${brandContext.industry}
- Brand Voice/Tone: ${voice}
- Ideal Customer Profile: ${icp}
- Existing Website: ${urls.website || 'N/A'}
- Existing ${platform} Handle: ${urls[platform.toLowerCase()] || 'N/A'}

REQUIREMENTS FOR ${platform.toUpperCase()} API PAYLOAD:
${platformRequirements}

CRITICAL: Do not just invent generic bios. Deeply integrate the Ideal Customer Profile and Brand Voice provided above into the bio copy.

${formatInstructions}
`;

  const aiResult = await generateText(prompt);

  // 3. Generate Profile Picture (DP) using Imagen fallback logic
  let dpUrl = null;
  if (aiResult?.dp_image_prompt) {
    try {
      dpUrl = await generateImage(aiResult.dp_image_prompt);
    } catch (e) {
      console.warn('DP Image generation failed, falling back to placeholder');
    }
  }

  // Fallback to placeholder if image failed (paywall/quota exhausted)
  if (!dpUrl) {
    const encodedName = encodeURIComponent(brandContext.name + ' DP');
    dpUrl = `https://placehold.co/400x400/1e293b/a855f7?font=playfair-display&text=${encodedName}`;
  }

  // Extract correct text fields based on platform variation
  let mainBio = aiResult.bio;
  if (platform.toLowerCase() === 'linkedin') mainBio = aiResult.about;

  let allHandles = aiResult.handle_suggestions || [];
  if (aiResult.handle) allHandles = [aiResult.handle];
  if (aiResult.username) allHandles = [aiResult.username];

  // 4. Save to Supabase (simulating API publish to social networks)
  const profileSetup = {
    brand_id: brandId,
    platform: platform.toLowerCase(),
    bio: mainBio || '',
    dp_url: dpUrl,
    handle_suggestions: allHandles,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('profile_setups')
    .insert([profileSetup])
    .select()
    .single();

  if (error) {
    throw new Error('Failed to save profile setup: ' + error.message);
  }

  return { ...data, ai_metadata: aiResult };
}
