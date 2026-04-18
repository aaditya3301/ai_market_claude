export const PHASE1_GOALS = [
  'weekly_planning_cycle',
  'research_only',
  'single_artifact_generation',
] as const;

export type Phase1Goal = (typeof PHASE1_GOALS)[number];

export function isPhase1Goal(value: string): value is Phase1Goal {
  return (PHASE1_GOALS as readonly string[]).includes(value);
}
