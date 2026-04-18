import { inngest } from '@/lib/events/client';
import {
  acquireStepLock,
  completeStep,
  failStep,
  getRunById,
  setRunStatus,
  upsertStep,
} from '@/lib/run-store';
import { executePlanningCreateStep } from '@/lib/step-executors/planning-create';
import { executeWarRoomRefineStep } from '@/lib/step-executors/war-room-refine';
import { executeCampaignLaunchStep } from '@/lib/step-executors/campaign-launch';
import { createApproval } from '@/lib/approvals/service';
import { isPhase1Goal } from '@/lib/runs/goals';

interface PlanningOutput {
  tenantId: string;
  brandId: string;
  brandPlanId: string;
  productName: string;
  firstCampaignIdea: {
    name?: string;
    objective?: string;
    artifacts?: Array<{ platform?: string }>;
  } | null;
}

interface CampaignOutput {
  campaignId: string;
  artifactsCount: number;
}

async function runLockedStep<T>(params: {
  tenantId: string;
  runId: string;
  stepName: 'planning_create' | 'war_room_refine' | 'campaign_launch';
  work: () => Promise<T>;
}) {
  const lockToken = crypto.randomUUID();
  const acquired = await acquireStepLock({
    tenantId: params.tenantId,
    runId: params.runId,
    stepName: params.stepName,
    lockToken,
    lockTtlSeconds: 300,
  });

  if (!acquired) {
    throw new Error(`STEP_LOCK_UNAVAILABLE:${params.stepName}`);
  }

  try {
    const output = await params.work();
    await completeStep({
      tenantId: params.tenantId,
      runId: params.runId,
      stepName: params.stepName,
      lockToken,
      outputPayload: (output || {}) as Record<string, unknown>,
    });

    await inngest.send({
      name: 'run.step.completed',
      data: {
        tenant_id: params.tenantId,
        run_id: params.runId,
        step: params.stepName,
      },
    });

    return output;
  } catch (error: unknown) {
    await failStep({
      tenantId: params.tenantId,
      runId: params.runId,
      stepName: params.stepName,
      lockToken,
      errorDetail: error instanceof Error ? error.message : 'Unknown step failure',
    });
    throw error;
  }
}

export const weeklyPlanningCycle = inngest.createFunction(
  {
    id: 'weekly-planning-cycle',
    triggers: { event: 'run.requested' },
    concurrency: [
      { scope: 'env', key: 'global', limit: 50 },
      { scope: 'fn', key: 'event.data.tenant_id', limit: 2 },
    ],
    retries: 3,
  },
  async ({ event, step }) => {
    const { run_id: runId, tenant_id: tenantId, mode, goal, inputs } = event.data;

    const run = await getRunById(runId, tenantId);
    if (!run) {
      return { status: 'missing' };
    }

    if (!isPhase1Goal(goal)) {
      await setRunStatus({
        tenantId,
        runId,
        status: 'failed',
        errorSummary: `Unsupported goal: ${goal}`,
      });
      return { status: 'failed', reason: 'unsupported_goal' };
    }

    await setRunStatus({ tenantId, runId, status: 'running', currentStep: 'planning_create' });

    const planning = (await step.run('planning-create', async () =>
      runLockedStep({
        tenantId,
        runId,
        stepName: 'planning_create',
        work: () => executePlanningCreateStep({ ...inputs, tenantId, runId }),
      })
    )) as PlanningOutput;

    if (goal === 'research_only') {
      await setRunStatus({
        tenantId,
        runId,
        status: 'completed',
        currentStep: null,
        outputPayload: {
          steps: {
            planning_create: planning,
          },
        },
      });
      return { status: 'complete' };
    }

    await setRunStatus({ tenantId, runId, status: 'running', currentStep: 'war_room_refine' });
    const warRoom = await step.run('war-room-refine', async () =>
      runLockedStep({
        tenantId,
        runId,
        stepName: 'war_room_refine',
        work: () =>
          executeWarRoomRefineStep({
            tenantId,
            brandPlanId: planning.brandPlanId,
            productName: planning.productName,
            runId,
          }),
      })
    );

    await setRunStatus({ tenantId, runId, status: 'running', currentStep: 'campaign_launch' });
    const campaigns = (await step.run('campaign-launch', async () =>
      runLockedStep({
        tenantId,
        runId,
        stepName: 'campaign_launch',
        work: () =>
          executeCampaignLaunchStep(
            {
              tenantId,
              brandId: planning.brandId,
              brandPlanId: planning.brandPlanId,
              productName: planning.productName,
              firstCampaignIdea: planning.firstCampaignIdea || null,
            },
            { ...inputs, tenantId }
          ),
      })
    )) as CampaignOutput;

    if (goal !== 'single_artifact_generation' && mode !== 'simulation') {
      await setRunStatus({ tenantId, runId, status: 'running', currentStep: 'first_publish_schedule' });
      const approval = await step.run('create-approval', async () => {
        const created = await createApproval({
          tenantId,
          runId,
          kind: 'publish_artifacts',
          title: 'Approve campaign publishing',
          summary: 'Campaign artifacts are ready. Approve publishing to continue.',
          payload: {
            planning,
            warRoom,
            campaigns,
          },
          requestedBy: 'system',
          policySnapshot: {
            mode,
            reason: 'public_side_effect',
          },
        });

        await upsertStep({
          tenantId,
          runId,
          stepName: 'first_publish_schedule',
          status: 'awaiting_approval',
          outputPayload: {
            approvalId: created.id,
          },
        });

        await inngest.send({
          name: 'approval.requested',
          data: {
            tenant_id: tenantId,
            run_id: runId,
            approval_id: created.id,
          },
        });

        return created;
      });

      const resolution = await step.waitForEvent('wait-approval', {
        event: 'approval.resolved',
        timeout: '72h',
        if: `event.data.approval_id == "${approval.id}"`,
      });

      if (!resolution || resolution.data.decision !== 'approved') {
        await setRunStatus({
          tenantId,
          runId,
          status: 'failed',
          currentStep: 'first_publish_schedule',
          errorSummary: resolution ? 'Approval rejected' : 'Approval timeout',
          outputPayload: {
            steps: {
              planning_create: planning,
              war_room_refine: warRoom,
              campaign_launch: campaigns,
            },
          },
        });
        return { status: 'rejected' };
      }

      await completeStep({
        tenantId,
        runId,
        stepName: 'first_publish_schedule',
        outputPayload: {
          approvalId: approval.id,
          decision: resolution.data.decision,
        },
      });
    }

    await setRunStatus({
      tenantId,
      runId,
      status: 'completed',
      currentStep: null,
      outputPayload: {
        steps: {
          planning_create: planning,
          war_room_refine: warRoom,
          campaign_launch: campaigns,
        },
        summary: {
          brandPlanId: planning.brandPlanId,
          campaignId: campaigns.campaignId,
        },
      },
    });

    return { status: 'complete' };
  }
);
