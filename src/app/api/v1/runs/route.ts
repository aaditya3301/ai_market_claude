import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { withConnectorRoute } from '@/lib/connector/route';
import { assertGoal, normalizeMode, startRun, listTenantRuns } from '@/lib/runs/service';

export async function POST(req: Request) {
  return withConnectorRoute(req, {
    scope: 'runs:create',
    endpoint: 'v1/runs.create',
    handler: async (auth) => {
      const body = await req.json().catch(() => ({}));
      const goal = assertGoal(String(body.goal || ''));
      const mode = normalizeMode(body.mode);
      const idempotencyKey = String(body.idempotency_key || '').trim() || crypto.randomUUID();

      const inputs =
        body.inputs && typeof body.inputs === 'object' && !Array.isArray(body.inputs)
          ? (body.inputs as Record<string, unknown>)
          : {};

      const brandId = String(body.inputs?.brand_id || body.brand_id || '').trim();
      if (!brandId) {
        return NextResponse.json(
          envelopeError('VALIDATION_FAILED', 'inputs.brand_id is required', {
            field: 'inputs.brand_id',
          }, {
            api_version: 'v1',
            step: 'v1/runs.create',
          }),
          { status: 400 }
        );
      }

      const { run, reused } = await startRun({
        tenantId: auth.tenantId,
        brandId,
        goal,
        mode,
        idempotencyKey,
        inputs: {
          ...inputs,
          brandId,
          tenantId: auth.tenantId,
        },
        callbackUrl: body.callback_url ? String(body.callback_url) : undefined,
      });

      return NextResponse.json(
        envelopeSuccess(
          {
            run_id: run.id,
            status: run.status === 'pending' ? 'queued' : run.status,
            goal,
            mode: run.mode,
            created_at: run.created_at,
            reused,
          },
          {
            api_version: 'v1',
            step: 'v1/runs.create',
          }
        ),
        { status: 202 }
      );
    },
  });
}

export async function GET(req: Request) {
  return withConnectorRoute(req, {
    scope: 'runs:list',
    endpoint: 'v1/runs.list',
    handler: async (auth) => {
      const url = new URL(req.url);
      const limitParam = Number(url.searchParams.get('limit') || '20');
      const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 200)) : 20;

      const runs = await listTenantRuns(auth.tenantId, limit);

      return NextResponse.json(
        envelopeSuccess(
          {
            runs: runs.map((run) => ({
              id: run.id,
              goal: run.goal || 'weekly_planning_cycle',
              mode: run.mode,
              status: run.status,
              created_at: run.created_at,
              updated_at: run.updated_at,
              current_step: run.current_step,
            })),
          },
          {
            api_version: 'v1',
            step: 'v1/runs.list',
          }
        )
      );
    },
  });
}
