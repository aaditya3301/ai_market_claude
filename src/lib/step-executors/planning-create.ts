import { runPlanningAgent } from '@/lib/agents/planning/graph';
import { assertNoImplicitAutomationBrand, getAutomationBrandId } from '@/lib/utils';

export interface PlanningCreateStepOutput {
  tenantId: string;
  brandId: string;
  brandPlanId: string;
  productName: string;
  firstCampaignIdea: {
    name?: string;
    objective?: string;
    artifacts?: Array<{
      platform?: string;
    }>;
  } | null;
}

export async function executePlanningCreateStep(inputPayload: Record<string, unknown>): Promise<PlanningCreateStepOutput> {
  const productName = String(inputPayload.productName || '').trim();
  const description = String(inputPayload.description || '').trim();

  if (!productName || !description) {
    throw new Error('PLANNING_INPUT_INVALID: productName and description are required.');
  }

  const brandId = getAutomationBrandId(inputPayload.brandId as string | undefined);
  const tenantId = String(inputPayload.tenantId || '').trim();
  if (!tenantId) {
    throw new Error('PLANNING_INPUT_INVALID: tenantId is required.');
  }
  assertNoImplicitAutomationBrand(brandId);

  const result = await runPlanningAgent({
    tenantId,
    runId: typeof inputPayload.runId === 'string' ? inputPayload.runId : undefined,
    input: {
      tenantId,
      brandId,
      productName,
      description,
      websiteUrl: (inputPayload.websiteUrl as string | undefined) || '',
      instagramUrl: (inputPayload.instagramUrl as string | undefined) || '',
      linkedinUrl: (inputPayload.linkedinUrl as string | undefined) || '',
      twitterUrl: (inputPayload.twitterUrl as string | undefined) || '',
      imageBase64: (inputPayload.imageBase64 as string | null | undefined) || null,
    },
    options: {
      // In orchestration, campaign launch is handled by the next step.
      createSeedCampaigns: false,
    },
  });

  return {
    tenantId,
    brandId: result.activeBrandId,
    brandPlanId: result.plan.id,
    productName: result.plan.product_name,
    firstCampaignIdea: result.firstCampaignIdea,
  };
}
