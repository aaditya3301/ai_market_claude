import { inngest } from '@/lib/events/client';
import {
  cancelRun,
  createRun,
  findRunByIdempotencyKey,
  getRunById,
  listRuns,
  listRunSteps,
  type AutomationMode,
} from '@/lib/run-store';
import { isPhase1Goal, type Phase1Goal } from '@/lib/runs/goals';

export interface StartRunInput {
  tenantId: string;
  brandId: string;
  goal: string;
  mode: AutomationMode;
  idempotencyKey: string;
  inputs: Record<string, unknown>;
  callbackUrl?: string;
}

export async function startRun(input: StartRunInput) {
  if (!isPhase1Goal(input.goal)) {
    throw new Error(`VALIDATION_FAILED: unsupported goal ${input.goal}`);
  }

  const existing = await findRunByIdempotencyKey(input.tenantId, input.idempotencyKey);
  if (existing) {
    return {
      run: existing,
      reused: true,
    };
  }

  const run = await createRun({
    tenantId: input.tenantId,
    brandId: input.brandId,
    goal: input.goal,
    mode: input.mode,
    idempotencyKey: input.idempotencyKey,
    inputPayload: input.inputs,
    callbackUrl: input.callbackUrl,
  });

  await inngest.send({
    name: 'run.requested',
    data: {
      tenant_id: input.tenantId,
      run_id: run.id,
      goal: input.goal,
      mode: input.mode,
      inputs: input.inputs,
    },
  });

  return {
    run,
    reused: false,
  };
}

export async function getRunStatus(tenantId: string, runId: string) {
  const run = await getRunById(runId, tenantId);
  if (!run) return null;

  const steps = await listRunSteps(runId, tenantId);
  return { run, steps };
}

export async function listTenantRuns(tenantId: string, limit?: number) {
  return listRuns({ tenantId, limit });
}

export async function cancelTenantRun(tenantId: string, runId: string) {
  const run = await cancelRun({ tenantId, runId });
  await inngest.send({
    name: 'run.cancelled',
    data: {
      tenant_id: tenantId,
      run_id: run.id,
    },
  });
  return run;
}

export function normalizeMode(value: unknown): AutomationMode {
  const mode = String(value || 'guided').toLowerCase();
  if (mode === 'full' || mode === 'guided' || mode === 'simulation') {
    return mode;
  }
  return 'guided';
}

export function assertGoal(goal: string): Phase1Goal {
  if (!isPhase1Goal(goal)) {
    throw new Error(`VALIDATION_FAILED: goal must be one of ${['weekly_planning_cycle', 'research_only', 'single_artifact_generation'].join(', ')}`);
  }
  return goal;
}
