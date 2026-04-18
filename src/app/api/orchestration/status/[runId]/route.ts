import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { getRunStatusView } from '@/lib/orchestrator';

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
          step: 'status',
        }),
        { status: 400 }
      );
    }

    const statusView = await getRunStatusView(runId);
    if (!statusView) {
      return NextResponse.json(
        envelopeError('RUN_NOT_FOUND', 'Automation run not found', undefined, {
          request_id: requestId,
          step: 'status',
        }),
        { status: 404 }
      );
    }

    return NextResponse.json(
      envelopeSuccess(
        {
          run: statusView.run,
          steps: statusView.steps,
        },
        {
          request_id: requestId,
          step: 'status',
          mode: statusView.run.mode,
        }
      )
    );
  } catch (error: any) {
    return NextResponse.json(
      envelopeError(
        'ORCHESTRATION_STATUS_FAILED',
        error?.message || 'Failed to fetch run status',
        undefined,
        { step: 'status' }
      ),
      { status: 500 }
    );
  }
}
