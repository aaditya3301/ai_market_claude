import 'server-only';
import { runResearchAgent } from '@/lib/agents/research/graph';
import { runGroundedWarRoomAgent } from '@/lib/agents/war-room/graph';

export interface AgentEvalSummary {
  pass: boolean;
  checks: Array<{
    id: string;
    pass: boolean;
    details: Record<string, unknown>;
  }>;
}

export async function runAgentGoldenSuite(params: {
  tenantId: string;
  runId?: string;
  samplePlan: Record<string, unknown>;
}): Promise<AgentEvalSummary> {
  const checks: AgentEvalSummary['checks'] = [];

  const research = await runResearchAgent({
    tenantId: params.tenantId,
    runId: params.runId,
    question: 'What content angles are rising this week for sleep wellness products?',
  });

  checks.push({
    id: 'research_sources_minimum',
    pass: research.sources.length >= 3,
    details: {
      sourceCount: research.sources.length,
    },
  });

  checks.push({
    id: 'research_brief_not_empty',
    pass: research.brief.trim().length >= 120,
    details: {
      briefLength: research.brief.trim().length,
    },
  });

  const warRoom = await runGroundedWarRoomAgent({
    tenantId: params.tenantId,
    runId: params.runId,
    planSnapshot: params.samplePlan,
  });

  const decisions = Array.isArray(warRoom.output.decisions) ? warRoom.output.decisions : [];
  const decisionsWithEvidence = decisions.filter(
    (item) => Array.isArray(item.evidence_chunk_ids) && item.evidence_chunk_ids.length > 0
  );

  checks.push({
    id: 'war_room_decisions_minimum',
    pass: decisions.length >= 3,
    details: {
      decisionCount: decisions.length,
    },
  });

  checks.push({
    id: 'war_room_evidence_required',
    pass: decisionsWithEvidence.length === decisions.length && decisions.length > 0,
    details: {
      decisionsWithEvidence: decisionsWithEvidence.length,
      decisionCount: decisions.length,
    },
  });

  checks.push({
    id: 'war_room_transcript_minimum',
    pass: warRoom.transcript.length >= 4,
    details: {
      transcriptCount: warRoom.transcript.length,
    },
  });

  return {
    pass: checks.every((item) => item.pass),
    checks,
  };
}
