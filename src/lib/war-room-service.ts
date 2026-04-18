import { generateText } from './gemini';

export interface DebateMessage {
  agent_name: 'Skeptical Auditor' | 'Creative Director' | 'Data Analyst';
  avatar_icon: string;
  message: string;
  focus: string;
}

export async function runStrategyDebate(brandPlan: {
    product_name: string;
    product_description: string;
    target_audience: string;
    strategy_overview: string;
}) {
  const prompt = `
  You are conducting a "Strategic War Room" debate for the brand: ${brandPlan.product_name}.
  
  CONTEXT:
  - Description: ${brandPlan.product_description}
  - Audience: ${brandPlan.target_audience}
  - Current Strategy: ${brandPlan.strategy_overview}
  
  TASK:
  Generate a 3-turn debate where these three agents analyze and critique the branding and identity. 
  Each agent MUST stay in character:
  
  1. "Skeptical Auditor": Be brutally honest about why this might fail or lose money.
  2. "Creative Director": Defend the emotional pulse and the "vibe" of the brand.
  3. "Data Analyst": Focus on the technical conversion paths and SEO viability.
  
  Return a JSON array of 6 messages (each agent speaks twice) in this format:
  [
    {
      "agent_name": "Skeptical Auditor",
      "avatar_icon": "ShieldAlert",
      "message": "Direct, slightly pessimistic critique...",
      "focus": "Risk & ROI"
    },
    ...
  ]
  `;

  return await generateText(prompt) as DebateMessage[];
}
