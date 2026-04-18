import { generateText } from './gemini';

export interface VideoScript {
  title: string;
  hook: string;
  duration: string;
  music_tone: string;
  voiceover_style: string;
  scenes: {
    visual_description: string;
    script_text: string;
    overlay_text?: string;
    duration_seconds: number;
  }[];
}

export async function generateVideoScript(context: {
  productName: string;
  description: string;
  objective: string;
  targetAudience: string;
}) {
  const prompt = `
  You are an expert Video Ad Creative Director specializing in high-converting short-form video (TikTok, Reels, YouTube Shorts).
  
  TASK:
  Generate a detailed video ad script for: ${context.productName}
  Product Description: ${context.description}
  Campaign Objective: ${context.objective}
  Target Audience: ${context.targetAudience}
  
  REQUIREMENTS:
  - Create a "Hook-Body-CTA" structure.
  - The script should be optimized for AI Video Generators (Sora, OpusClip, HeyGen).
  - Include specific "Visual Descriptions" that an AI image/video generator can interpret.
  
  Return a JSON object with this structure:
  {
    "title": "A catchy production title",
    "hook": "The first 3 seconds to grab attention",
    "duration": "15s | 30s | 60s",
    "music_tone": "e.g. Energetic Lo-fi, Cinematic Orchestral, Minimalist Tech",
    "voiceover_style": "e.g. Calm and trust-building, Fast-paced and hype, Professional Corporate",
    "scenes": [
      {
        "visual_description": "Precise cinematic description for AI video generation (e.g. 'Close up of hands typing on a glowing keyboard, blue morning light')",
        "script_text": "The actual words the AI voiceover should say",
        "overlay_text": "Text to appear on screen",
        "duration_seconds": 3
      }
    ]
  }
  
  Generate exactly 5-6 scenes for a 30s-45s video.
  `;

  return await generateText(prompt) as VideoScript;
}
