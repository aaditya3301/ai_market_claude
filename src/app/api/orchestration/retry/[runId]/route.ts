import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import {
  getFirstFailedPhase2Step,
  getRunStatusView,
  retryFailedStep,
} from '@/lib/orchestrator';
import {
  isAutomationStepName,
  type AutomationStepName,
} from '@/lib/step-definitions';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

export async function POST(
  req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await context.params;
    const requestId = req.headers.get('x-request-id') || undefined;
    const body = await req.json().catch(() => ({}));

    if (!runId) {
      return NextResponse.json(
        envelopeError('RUN_ID_REQUIRED', 'runId is required', undefined, {
          request_id: requestId,
          step: 'retry',
        }),
        { status: 400 }
      );
    }

    const statusView = await getRunStatusView(runId);
    if (!statusView) {
      return NextResponse.json(
        envelopeError('RUN_NOT_FOUND', 'Automation run not found', undefined, {
          request_id: requestId,
          step: 'retry',
        }),
        { status: 404 }
      );
    }

    if (statusView.run.status !== 'failed') {
      return NextResponse.json(
        envelopeError(
          'RUN_NOT_RETRYABLE',
          `Run must be in failed state to retry. Current status: ${statusView.run.status}`,
          undefined,
          {
            request_id: requestId,
            step: 'retry',
            mode: statusView.run.mode,
          }
        ),
        { status: 409 }
      );
    }

    let stepName: AutomationStepName | null = null;
    const requestedStep = String(body.stepName || '').trim();
    if (requestedStep) {
      if (!isAutomationStepName(requestedStep)) {
        return NextResponse.json(
          envelopeError('STEP_INVALID', `Unknown stepName: ${requestedStep}`, undefined, {
            request_id: requestId,
            step: 'retry',
          }),
          { status: 400 }
        );
      }
      stepName = requestedStep;
    } else {
      stepName = getFirstFailedPhase2Step(statusView.steps);
    }

    if (!stepName) {
      return NextResponse.json(
        envelopeError('STEP_NOT_FOUND', 'No failed phase-2 step found to retry', undefined, {
          request_id: requestId,
          step: 'retry',
        }),
        { status: 409 }
      );
    }

    const execution = await retryFailedStep(runId, LEGACY_TENANT_ID, stepName);

    return NextResponse.json(
      envelopeSuccess(
        {
          runId,
          retriedStep: stepName,
          status: execution.run.status,
          output: execution.run.output_payload,
        },
        {
          request_id: requestId,
          step: 'retry',
          mode: execution.run.mode,
        }
      )
    );
  } catch (error: any) {
    return NextResponse.json(
      envelopeError(
        'ORCHESTRATION_RETRY_FAILED',
        error?.message || 'Failed to retry orchestration step',
        undefined,
        { step: 'retry' }
      ),
      { status: 500 }
    );
  }
}
