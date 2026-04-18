import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { getRunStatusView } from '@/lib/orchestrator';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function GET(
  req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await context.params;
    const requestId = req.headers.get('x-request-id') || undefined;

    if (!runId) {
      return NextResponse.json(
        envelopeError('RUN_ID_REQUIRED', 'runId is required', undefined, {
          request_id: requestId,
          step: 'outputs',
        }),
        { status: 400 }
      );
    }

    const statusView = await getRunStatusView(runId);
    if (!statusView) {
      return NextResponse.json(
        envelopeError('RUN_NOT_FOUND', 'Automation run not found', undefined, {
          request_id: requestId,
          step: 'outputs',
        }),
        { status: 404 }
      );
    }

    const steps = statusView.steps.map((step) => ({
      stepName: step.step_name,
      status: step.status,
      output: asRecord(step.output_payload),
      error: step.error_detail,
      startedAt: step.started_at,
      endedAt: step.ended_at,
    }));

    return NextResponse.json(
      envelopeSuccess(
        {
          runId: statusView.run.id,
          runStatus: statusView.run.status,
          output: asRecord(statusView.run.output_payload),
          steps,
        },
        {
          request_id: requestId,
          step: 'outputs',
          mode: statusView.run.mode,
        }
      )
    );
  } catch (error: any) {
    return NextResponse.json(
      envelopeError(
        'ORCHESTRATION_OUTPUTS_FAILED',
        error?.message || 'Failed to fetch run outputs',
        undefined,
        { step: 'outputs' }
      ),
      { status: 500 }
    );
  }
}
