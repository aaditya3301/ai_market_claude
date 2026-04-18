import { createAndGenerateCampaign } from '@/lib/campaign-service';

interface CampaignConfigInput {
  campaignName?: string;
  objective?: string;
  platforms?: string[];
}

export interface CampaignLaunchStepInput {
  tenantId: string;
  brandId: string;
  brandPlanId: string;
  productName: string;
  firstCampaignIdea?: {
    name?: string;
    objective?: string;
    artifacts?: Array<{ platform?: string }>;
  } | null;
}

export interface CampaignLaunchStepOutput {
  campaignId: string;
  artifactsCount: number;
  campaignName: string;
  objective: string;
  platforms: string[];
}

function normalizePlatforms(platforms: string[] | undefined, fallback: string[]): string[] {
  const normalized = (platforms || [])
    .map((p) => p?.toLowerCase().trim())
    .filter((p): p is string => !!p);

  const allowed = new Set(['instagram', 'twitter', 'linkedin', 'facebook', 'reddit']);
  const filtered = normalized.filter((p) => allowed.has(p));
  return filtered.length > 0 ? filtered : fallback;
}

export async function executeCampaignLaunchStep(
  planningOutput: CampaignLaunchStepInput,
  inputPayload: Record<string, unknown>
): Promise<CampaignLaunchStepOutput> {
  const campaignInput = (inputPayload.campaign || {}) as CampaignConfigInput;

  const suggestedPlatforms =
    planningOutput.firstCampaignIdea?.artifacts
      ?.map((a) => (a.platform || '').toLowerCase().trim())
      .filter((p): p is string => !!p) || [];

  const fallbackPlatforms = suggestedPlatforms.length > 0 ? suggestedPlatforms : ['instagram', 'twitter', 'linkedin'];
  const platforms = normalizePlatforms(campaignInput.platforms, fallbackPlatforms);

  const campaignName =
    (campaignInput.campaignName || '').trim() ||
    (planningOutput.firstCampaignIdea?.name || '').trim() ||
    `${planningOutput.productName} Launch Campaign`;

  const objective =
    (campaignInput.objective || '').trim() ||
    (planningOutput.firstCampaignIdea?.objective || '').trim() ||
    `Drive awareness and qualified engagement for ${planningOutput.productName}.`;

  const result = await createAndGenerateCampaign({
    tenantId: planningOutput.tenantId,
    brandId: planningOutput.brandId,
    brandPlanId: planningOutput.brandPlanId,
    campaignName,
    objective,
    platforms,
  });

  return {
    campaignId: result.campaignId,
    artifactsCount: result.artifactsCount,
    campaignName,
    objective,
    platforms,
  };
}
