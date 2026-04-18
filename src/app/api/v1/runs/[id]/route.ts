import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { withConnectorRoute } from '@/lib/connector/route';
import { getRunStatus } from '@/lib/runs/service';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withConnectorRoute(req, {
    scope: 'runs:read',
    endpoint: 'v1/runs.read',
    handler: async (auth) => {
      const { id } = await context.params;
      const status = await getRunStatus(auth.tenantId, id);
      if (!status) {
        return NextResponse.json(
          envelopeError('RUN_NOT_FOUND', 'Run not found', undefined, {
            api_version: 'v1',
            step: 'v1/runs.read',
          }),
          { status: 404 }
        );
      }

      return NextResponse.json(
        envelopeSuccess(
          {
            run: status.run,
            steps: status.steps,
          },
          {
            api_version: 'v1',
            step: 'v1/runs.read',
          }
        )
      );
    },
  });
}
