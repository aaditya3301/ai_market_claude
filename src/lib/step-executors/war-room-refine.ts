import { createServiceRoleClient } from '@/lib/supabase';
import { runGroundedWarRoomAgent } from '@/lib/agents/war-room/graph';

export interface WarRoomRefineStepInput {
  tenantId: string;
  brandPlanId: string;
  productName: string;
  runId?: string;
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

  const strategy = (plan.ai_research_result as Record<string, unknown> | null) || {};

  const grounded = await runGroundedWarRoomAgent({
    tenantId: planningOutput.tenantId,
    runId: planningOutput.runId,
    planSnapshot: {
      product_name: planningOutput.productName || plan.product_name || 'Brand',
      product_description: plan.product_description || '',
      strategy,
      brand_plan_id: planningOutput.brandPlanId,
    },
  });

  const warRoomInsights =
    grounded.warRoomInsights ||
    'Use data-led positioning, tighten audience-message fit, and prioritize repeatable creative testing.';

  const updatedResearch = {
    ...(plan.ai_research_result || {}),
    war_room_insights: warRoomInsights,
    war_room_output: grounded.output,
    war_room_transcript: grounded.transcript,
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
    messageCount: grounded.transcript.length,
    warRoomInsights,
  };
}
