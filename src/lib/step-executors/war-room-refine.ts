import { createServiceRoleClient } from '@/lib/supabase';
import { generateText } from '@/lib/gemini';
import { runStrategyDebate } from '@/lib/war-room-service';

export interface WarRoomRefineStepInput {
  tenantId: string;
  brandPlanId: string;
  productName: string;
}

export interface WarRoomRefineStepOutput {
  brandPlanId: string;
  messageCount: number;
  warRoomInsights: string;
}

export async function executeWarRoomRefineStep(
  planningOutput: WarRoomRefineStepInput
): Promise<WarRoomRefineStepOutput> {
  const db = createServiceRoleClient();
  const { data: plan, error: planError } = await db
    .from('brand_plans')
    .select('*')
    .eq('tenant_id', planningOutput.tenantId)
    .eq('id', planningOutput.brandPlanId)
    .single();

  if (planError || !plan) {
    throw new Error('WAR_ROOM_PLAN_NOT_FOUND: Unable to load brand plan for war room step.');
  }

  const strategy = plan.ai_research_result || {};
  const debateMessages = await runStrategyDebate({
    product_name: planningOutput.productName || plan.product_name || 'Brand',
    product_description: plan.product_description || '',
    target_audience:
      strategy?.ideal_customer_profile?.summary || strategy?.target_audience || 'General audience',
    strategy_overview:
      strategy?.suggested_strategies?.[0]?.description || strategy?.strategy_summary || 'Strategy TBD',
  });

  const summaryPrompt = `Summarize the following War Room debate into 3 critical strategic directives (1 paragraph) for our future marketing campaigns:\n\n${JSON.stringify(
    debateMessages
  )}\n\nReturn JSON: {"war_room_insights": "string"}`;

  const summaryObj = await generateText(summaryPrompt);
  const warRoomInsights =
    (summaryObj?.war_room_insights as string | undefined) ||
    'Use data-led positioning, tighten audience-message fit, and prioritize repeatable creative testing.';

  const updatedResearch = {
    ...(plan.ai_research_result || {}),
    war_room_insights: warRoomInsights,
  };

  const { error: updateError } = await db
    .from('brand_plans')
    .update({ ai_research_result: updatedResearch })
    .eq('tenant_id', planningOutput.tenantId)
    .eq('id', planningOutput.brandPlanId);

  if (updateError) {
    throw new Error(`WAR_ROOM_SAVE_FAILED: ${updateError.message}`);
  }

  return {
    brandPlanId: planningOutput.brandPlanId,
    messageCount: Array.isArray(debateMessages) ? debateMessages.length : 0,
    warRoomInsights,
  };
}
