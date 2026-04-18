import { inngest } from '@/lib/events/client';
import { getRunById, listRunSteps, setRunStatus, type AutomationRunRow } from '@/lib/run-store';
import { AUTOMATION_STEP_ORDER, type AutomationStepName } from '@/lib/step-definitions';

export function getFirstFailedPhase2Step(
  steps: Array<{ step_name: string; status: string }>
): AutomationStepName | null {
  for (const stepName of AUTOMATION_STEP_ORDER) {
    const step = steps.find((s) => s.step_name === stepName);
    if (step?.status === 'failed') {
      return stepName;
    }
  }
  return null;
}

export async function getRunStatusView(runId: string, tenantId?: string) {
  const run = await getRunById(runId, tenantId);
  if (!run) return null;

  const steps = await listRunSteps(runId, run.tenant_id);
  return { run, steps };
}

export async function retryFailedStep(
  runId: string,
  tenantId: string,
  stepName: AutomationStepName
): Promise<{ run: AutomationRunRow }> {
  void stepName;

  const run = await getRunById(runId, tenantId);
  if (!run) {
    throw new Error('RUN_NOT_FOUND');
  }

  if (run.status !== 'failed') {
    throw new Error(`RUN_NOT_RETRYABLE:${run.status}`);
  }

  const updated = await setRunStatus({
    tenantId,
    runId,
    status: 'pending',
    currentStep: null,
    errorSummary: null,
  });

  await inngest.send({
    name: 'run.requested',
    data: {
      tenant_id: tenantId,
      run_id: runId,
      goal: String(updated.goal || 'weekly_planning_cycle'),
      mode: updated.mode,
      inputs: (updated.input_payload || {}) as Record<string, unknown>,
    },
  });

  return { run: updated };
}
