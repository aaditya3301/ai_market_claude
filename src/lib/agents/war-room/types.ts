export interface WarRoomDecision {
  id: string;
  statement: string;
  confidence: 'low' | 'medium' | 'high';
  evidence_chunk_ids: string[];
  evidence_trend_ids?: string[];
  evidence_competitor_ids?: string[];
  dissenting_personas?: string[];
}

export interface WarRoomChange {
  target: string;
  change_type: 'replace' | 'remove' | 'add' | 'reprioritize';
  new_value?: unknown;
  rationale: string;
}

export interface WarRoomRisk {
  risk: string;
  mitigation: string;
  owner: 'system' | 'human';
}

export interface WarRoomExperiment {
  hypothesis: string;
  test_design: string;
  success_metric: string;
}

export interface WarRoomOutput {
  decisions: WarRoomDecision[];
  changes_to_plan: WarRoomChange[];
  risks: WarRoomRisk[];
  experiments: WarRoomExperiment[];
}

export interface WarRoomTranscriptEntry {
  persona: 'auditor' | 'creative' | 'analyst' | 'facilitator';
  content: string;
  evidence_ids?: string[];
}
