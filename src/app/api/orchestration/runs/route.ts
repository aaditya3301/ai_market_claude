import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { listRuns } from '@/lib/run-store';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

export async function GET(req: Request) {
  try {
    const requestId = req.headers.get('x-request-id') || undefined;
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get('limit') || '20');
    const limit = Number.isFinite(limitParam) ? limitParam : 20;

    const runs = await listRuns({ tenantId: LEGACY_TENANT_ID, limit });
    const lightweight = runs.map((run) => ({
      id: run.id,
      brandId: run.brand_id,
      mode: run.mode,
      status: run.status,
      currentStep: run.current_step,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      startedAt: run.started_at,
      endedAt: run.ended_at,
      errorSummary: run.error_summary,
    }));

    return NextResponse.json(
      envelopeSuccess(
        {
          runs: lightweight,
          count: lightweight.length,
        },
        {
          request_id: requestId,
          step: 'runs',
        }
      )
    );
  } catch (error: any) {
    return NextResponse.json(
      envelopeError(
        'ORCHESTRATION_RUNS_FAILED',
        error?.message || 'Failed to list automation runs',
        undefined,
        { step: 'runs' }
      ),
      { status: 500 }
    );
  }
}
