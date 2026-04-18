'use server';

import { runStrategyDebate } from '@/lib/war-room-service';

import { supabase } from '@/lib/supabase';
import { generateText } from '@/lib/gemini';

export async function runWarRoomAction(brandPlan: {
    id?: string;
    product_name: string;
    product_description: string;
    target_audience: string;
    strategy_overview: string;
}) {
  try {
    const messages = await runStrategyDebate(brandPlan);
    
    if (brandPlan.id) {
      try {
        console.log('[War Room] Saving insights to db...');
        const summaryPrompt = `Summarize the following War Room debate into 3 critical strategic directives (1 paragraph) for our future marketing campaigns:\n\n${JSON.stringify(messages)}\n\nReturn JSON: {"war_room_insights": "string"}`;
        const summaryObj = await generateText(summaryPrompt);
        
        const { data } = await supabase.from('brand_plans').select('ai_research_result').eq('id', brandPlan.id).single();
        if (data) {
          const updatedJson = { ...data.ai_research_result, war_room_insights: summaryObj.war_room_insights || summaryObj.toString() };
          await supabase.from('brand_plans').update({ ai_research_result: updatedJson }).eq('id', brandPlan.id);
        }
      } catch (e: any) {
        console.error('[War Room] Failed to save insights:', e.message);
      }
    }
    
    return messages;
  } catch (error: any) {
    console.error('War Room Action Error:', error);
    throw new Error(error.message);
  }
}
