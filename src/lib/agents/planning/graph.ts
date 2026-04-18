import 'server-only';
import {
  createPlanAndSeedCampaigns,
  type PlanningInput,
  type PlanningOptions,
  type PlanningOutput,
} from '@/lib/planning-service';
import { retrieveWithPolicy } from '@/lib/intelligence/retriever';
import { RETRIEVAL_POLICIES } from '@/lib/intelligence/retrieval-policies';
import { runResearchAgent } from '@/lib/agents/research/graph';
import { saveAgentCheckpoint } from '@/lib/agents/checkpoints';

function buildEnrichedDescription(params: {
  input: PlanningInput;
  retrievalSummary: string;
  researchBrief: string;
}): string {
  const blocks = [params.input.description];
  if (params.retrievalSummary) {
    blocks.push(`Brand retrieval context: ${params.retrievalSummary}`);
  }
  if (params.researchBrief) {
    blocks.push(`Market research brief: ${params.researchBrief}`);
  }
  return blocks.join('\n\n');
}

export async function runPlanningAgent(params: {
  tenantId: string;
  runId?: string;
  input: PlanningInput;
  options?: PlanningOptions;
}): Promise<PlanningOutput> {
  await saveAgentCheckpoint({
    tenantId: params.tenantId,
    runId: params.runId,
    agentName: 'planning',
    stateKey: 'understand_goal',
    checkpoint: {
      product_name: params.input.productName,
      at: new Date().toISOString(),
    },
  });

  const retrieval = await retrieveWithPolicy({
    tenantId: params.tenantId,
    text: `${params.input.productName} ${params.input.description}`,
    policy: RETRIEVAL_POLICIES.seo_article,
  });

  const retrievalSummary = retrieval.chunks
    .slice(0, 8)
    .map((chunk) => chunk.content)
    .join('\n\n');

  await saveAgentCheckpoint({
    tenantId: params.tenantId,
    runId: params.runId,
    agentName: 'planning',
    stateKey: 'fetch_brand_context',
    checkpoint: {
      chunk_count: retrieval.chunks.length,
      winners_count: retrieval.winners.length,
      at: new Date().toISOString(),
    },
  });

  const research = await runResearchAgent({
    tenantId: params.tenantId,
    runId: params.runId,
    question: `${params.input.productName} marketing strategy competitor trends`,
  });

  await saveAgentCheckpoint({
    tenantId: params.tenantId,
    runId: params.runId,
    agentName: 'planning',
    stateKey: 'fetch_market_context',
    checkpoint: {
      source_count: research.sources.length,
      at: new Date().toISOString(),
    },
  });

  const enrichedInput: PlanningInput = {
    ...params.input,
    description: buildEnrichedDescription({
      input: params.input,
      retrievalSummary,
      researchBrief: research.brief,
    }),
  };

  const output = await createPlanAndSeedCampaigns(enrichedInput, params.options || {});

  await saveAgentCheckpoint({
    tenantId: params.tenantId,
    runId: params.runId,
    agentName: 'planning',
    stateKey: 'return_draft',
    checkpoint: {
      plan_id: output.plan.id,
      at: new Date().toISOString(),
    },
  });

  return output;
}
