import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { withConnectorRoute } from '@/lib/connector/route';
import { cancelTenantRun } from '@/lib/runs/service';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withConnectorRoute(req, {
    scope: 'runs:cancel',
    endpoint: 'v1/runs.cancel',
    handler: async (auth) => {
      const { id } = await context.params;

      try {
        const run = await cancelTenantRun(auth.tenantId, id);
        return NextResponse.json(
          envelopeSuccess(
            {
              run_id: run.id,
              status: run.status,
            },
            {
              api_version: 'v1',
              step: 'v1/runs.cancel',
            }
          )
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal error';
        if (message.toLowerCase().includes('no rows')) {
          return NextResponse.json(
            envelopeError('RUN_NOT_FOUND', 'Run not found', undefined, {
              api_version: 'v1',
              step: 'v1/runs.cancel',
            }),
            { status: 404 }
          );
        }
        throw error;
      }
    },
  });
}
