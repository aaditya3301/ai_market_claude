import 'server-only';
import { llmRouter } from '@/lib/llm/router';
import { scrapeUrl } from '@/lib/scraper-service';
import { saveAgentCheckpoint } from '@/lib/agents/checkpoints';

export interface ResearchSource {
  url: string;
  title?: string;
  excerpt: string;
}

export interface ResearchAgentOutput {
  brief: string;
  critique: string;
  sources: ResearchSource[];
}

export async function runResearchAgent(params: {
  tenantId: string;
  runId?: string;
  question: string;
}): Promise<ResearchAgentOutput> {
  await saveAgentCheckpoint({
    tenantId: params.tenantId,
    runId: params.runId,
    agentName: 'research',
    stateKey: 'plan_sources',
    checkpoint: {
      question: params.question,
      at: new Date().toISOString(),
    },
  });

  const sourceUrls = [
    `https://www.google.com/search?q=${encodeURIComponent(params.question)}`,
    `https://www.reddit.com/search/?q=${encodeURIComponent(params.question)}`,
    `https://trends.google.com/trends/explore?q=${encodeURIComponent(params.question)}`,
  ];

  const scraped = await Promise.all(sourceUrls.map((url) => scrapeUrl(url)));

  const sources: ResearchSource[] = scraped
    .map((result, idx) => ({
      url: sourceUrls[idx],
      title: result.title,
      excerpt: result.text.slice(0, 1200),
    }))
    .filter((item) => item.excerpt.length > 20);

  await saveAgentCheckpoint({
    tenantId: params.tenantId,
    runId: params.runId,
    agentName: 'research',
    stateKey: 'fetch_in_parallel',
    checkpoint: {
      source_count: sources.length,
      at: new Date().toISOString(),
    },
  });

  const synthesis = await llmRouter.call<{ brief: string }>({
    tenantId: params.tenantId,
    runId: params.runId,
    task: 'summarization',
    responseFormat: 'json',
    messages: [
      {
        role: 'system',
        content: 'Create a concise research brief from these sources. Return JSON with key brief.',
      },
      {
        role: 'user',
        content: `Question: ${params.question}\nSources: ${JSON.stringify(sources)}`,
      },
    ],
  });

  const critique = await llmRouter.call<{ critique: string }>({
    tenantId: params.tenantId,
    runId: params.runId,
    task: 'classification',
    responseFormat: 'json',
    messages: [
      {
        role: 'system',
        content: 'Critique this brief quality in 2-3 lines. Return JSON with key critique.',
      },
      {
        role: 'user',
        content: String(synthesis.data?.brief || ''),
      },
    ],
  });

  await saveAgentCheckpoint({
    tenantId: params.tenantId,
    runId: params.runId,
    agentName: 'research',
    stateKey: 'return',
    checkpoint: {
      completed: true,
      at: new Date().toISOString(),
    },
  });

  return {
    brief: String(synthesis.data?.brief || ''),
    critique: String(critique.data?.critique || ''),
    sources,
  };
}
