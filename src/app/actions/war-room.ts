'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { runGroundedWarRoomAgent } from '@/lib/agents/war-room/graph';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

export async function runWarRoomAction(brandPlan: {
    id?: string;
    product_name: string;
    product_description: string;
    target_audience: string;
    strategy_overview: string;
}) {
  try {
    const tenantId = LEGACY_TENANT_ID;
    const grounded = await runGroundedWarRoomAgent({
      tenantId,
      planSnapshot: {
        product_name: brandPlan.product_name,
        product_description: brandPlan.product_description,
        target_audience: brandPlan.target_audience,
        strategy_overview: brandPlan.strategy_overview,
      },
    });

    const messages = grounded.transcript
      .filter((item) => item.persona !== 'facilitator')
      .map((item) => {
        const mapping: Record<string, { agent_name: string; focus: string; avatar_icon: string }> = {
          auditor: {
            agent_name: 'Skeptical Auditor',
            focus: 'Risk & ROI',
            avatar_icon: 'ShieldAlert',
          },
          creative: {
            agent_name: 'Creative Director',
            focus: 'Creative Differentiation',
            avatar_icon: 'Paintbrush',
          },
          analyst: {
            agent_name: 'Data Analyst',
            focus: 'Data & Trends',
            avatar_icon: 'Binary',
          },
        };

        const mapped = mapping[item.persona] || mapping.analyst;
        return {
          ...mapped,
          message: item.content,
        };
      });
    
    if (brandPlan.id) {
      try {
        console.log('[War Room] Saving insights to db...');
        const db = createServiceRoleClient();
        const { data } = await db
          .from('brand_plans')
          .select('ai_research_result')
          .eq('tenant_id', tenantId)
          .eq('id', brandPlan.id)
          .single();
        if (data) {
          const updatedJson = {
            ...data.ai_research_result,
            war_room_insights: grounded.warRoomInsights,
            war_room_output: grounded.output,
            war_room_transcript: grounded.transcript,
          };
          await db
            .from('brand_plans')
            .update({ ai_research_result: updatedJson })
            .eq('tenant_id', tenantId)
            .eq('id', brandPlan.id);
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
