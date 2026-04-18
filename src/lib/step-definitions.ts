export const AUTOMATION_STEP_ORDER = [
  'planning_create',
  'war_room_refine',
  'campaign_launch',
  'first_publish_schedule',
  'ads_setup',
  'seo_cluster',
  'seo_draft_batch',
  'video_generate',
  'run_finalize',
] as const;

export type AutomationStepName = (typeof AUTOMATION_STEP_ORDER)[number];

export const SPEND_BEARING_STEPS: ReadonlyArray<AutomationStepName> = [
  'ads_setup',
];

export function isAutomationStepName(value: string): value is AutomationStepName {
  return (AUTOMATION_STEP_ORDER as readonly string[]).includes(value);
}

export function getFirstAutomationStep(): AutomationStepName {
  return AUTOMATION_STEP_ORDER[0];
}

export function getNextAutomationStep(step: AutomationStepName): AutomationStepName | null {
  const idx = AUTOMATION_STEP_ORDER.indexOf(step);
  if (idx === -1 || idx === AUTOMATION_STEP_ORDER.length - 1) {
    return null;
  }
  return AUTOMATION_STEP_ORDER[idx + 1];
}
