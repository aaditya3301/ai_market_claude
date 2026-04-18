import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase';
import { llmRouter } from '@/lib/llm/router';
import { saveAgentCheckpoint } from '@/lib/agents/checkpoints';
import { retrieveWithPolicy } from '@/lib/intelligence/retriever';
import { RETRIEVAL_POLICIES } from '@/lib/intelligence/retrieval-policies';
import type { WarRoomOutput, WarRoomTranscriptEntry } from '@/lib/agents/war-room/types';

async function personaCritique(params: {
  tenantId: string;
  runId?: string;
  persona: 'auditor' | 'creative' | 'analyst';
  planJson: string;
  evidence: Array<{ id: string; content: string }>;
}): Promise<{ critique: string; evidenceIds: string[] }> {
  const evidenceBlock = params.evidence
    .map((item) => `(${item.id}) ${item.content}`)
    .join('\n\n')
    .slice(0, 12000);

  const result = await llmRouter.call<{ critique: string; evidence_ids: string[] }>({
    tenantId: params.tenantId,
    runId: params.runId,
    task: 'war_room_persona',
    responseFormat: 'json',
    messages: [
      {
        role: 'system',
        content: `You are the ${params.persona} in a grounded war room. Provide concise critique with evidence ids. Return JSON: { critique: string, evidence_ids: string[] }`,
      },
      {
        role: 'user',
        content: `Plan:\n${params.planJson}\n\nEvidence:\n${evidenceBlock}`,
      },
    ],
  });

  return {
    critique: String(result.data?.critique || ''),
    evidenceIds: Array.isArray(result.data?.evidence_ids) ? result.data.evidence_ids.map(String) : [],
  };
}

function buildInsights(output: WarRoomOutput): string {
  const decisionLines = output.decisions.slice(0, 3).map((item) => `- ${item.statement}`);
  return decisionLines.join('\n');
}

export async function runGroundedWarRoomAgent(params: {
  tenantId: string;
  runId?: string;
  planSnapshot: Record<string, unknown>;
}): Promise<{ output: WarRoomOutput; transcript: WarRoomTranscriptEntry[]; warRoomInsights: string }> {
  const planJson = JSON.stringify(params.planSnapshot);

  const [auditorEvidence, creativeEvidence, analystEvidence] = await Promise.all([
    retrieveWithPolicy({
      tenantId: params.tenantId,
      text: `Audit plan risks and performance gaps ${planJson}`,
      policy: RETRIEVAL_POLICIES.war_room_auditor,
    }),
    retrieveWithPolicy({
      tenantId: params.tenantId,
      text: `Creative improvement opportunities ${planJson}`,
      policy: RETRIEVAL_POLICIES.war_room_creative,
    }),
    retrieveWithPolicy({
      tenantId: params.tenantId,
      text: `Analyst market and trend review ${planJson}`,
      policy: RETRIEVAL_POLICIES.war_room_analyst,
    }),
  ]);

  await saveAgentCheckpoint({
    tenantId: params.tenantId,
    runId: params.runId,
    agentName: 'war_room',
    stateKey: 'parallel_retrieval',
    checkpoint: {
      auditor_chunks: auditorEvidence.chunks.length,
      creative_chunks: creativeEvidence.chunks.length,
      analyst_chunks: analystEvidence.chunks.length,
      at: new Date().toISOString(),
    },
  });

  const [auditor, creative, analyst] = await Promise.all([
    personaCritique({
      tenantId: params.tenantId,
      runId: params.runId,
      persona: 'auditor',
      planJson,
      evidence: auditorEvidence.chunks.slice(0, 10).map((item) => ({ id: item.id, content: item.content })),
    }),
    personaCritique({
      tenantId: params.tenantId,
      runId: params.runId,
      persona: 'creative',
      planJson,
      evidence: creativeEvidence.chunks.slice(0, 10).map((item) => ({ id: item.id, content: item.content })),
    }),
    personaCritique({
      tenantId: params.tenantId,
      runId: params.runId,
      persona: 'analyst',
      planJson,
      evidence: analystEvidence.chunks.slice(0, 10).map((item) => ({ id: item.id, content: item.content })),
    }),
  ]);

  const transcript: WarRoomTranscriptEntry[] = [
    { persona: 'auditor', content: auditor.critique, evidence_ids: auditor.evidenceIds },
    { persona: 'creative', content: creative.critique, evidence_ids: creative.evidenceIds },
    { persona: 'analyst', content: analyst.critique, evidence_ids: analyst.evidenceIds },
  ];

  const synthesis = await llmRouter.call<WarRoomOutput>({
    tenantId: params.tenantId,
    runId: params.runId,
    task: 'war_room_synthesis',
    responseFormat: 'json',
    messages: [
      {
        role: 'system',
        content:
          'Synthesize these critiques into grounded decisions. Return JSON with keys: decisions, changes_to_plan, risks, experiments. Every decision must include evidence_chunk_ids.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          plan: params.planSnapshot,
          critiques: {
            auditor,
            creative,
            analyst,
          },
        }),
      },
    ],
  });

  const output = synthesis.data || {
    decisions: [],
    changes_to_plan: [],
    risks: [],
    experiments: [],
  };

  transcript.push({
    persona: 'facilitator',
    content: JSON.stringify(output).slice(0, 3000),
  });

  const warRoomInsights = buildInsights(output);

  await saveAgentCheckpoint({
    tenantId: params.tenantId,
    runId: params.runId,
    agentName: 'war_room',
    stateKey: 'return',
    checkpoint: {
      decisions: Array.isArray(output.decisions) ? output.decisions.length : 0,
      at: new Date().toISOString(),
    },
  });

  const supabase = createServiceRoleClient();
  await supabase.from('war_room_sessions').insert({
    tenant_id: params.tenantId,
    run_id: params.runId || null,
    plan_snapshot: params.planSnapshot,
    output,
    transcript,
    evidence_refs: {
      auditor: auditorEvidence.chunks.map((item) => item.id),
      creative: creativeEvidence.chunks.map((item) => item.id),
      analyst: analystEvidence.chunks.map((item) => item.id),
    },
  });

  return {
    output,
    transcript,
    warRoomInsights,
  };
}
