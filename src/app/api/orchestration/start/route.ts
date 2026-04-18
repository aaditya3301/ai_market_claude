import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { getRuntimeConfig, type AutomationMode } from '@/lib/runtime-config';
import { startRun } from '@/lib/runs/service';
import { assertNoImplicitAutomationBrand, getAutomationBrandId } from '@/lib/utils';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

export const maxDuration = 300;

function normalizeMode(mode: unknown, fallback: AutomationMode): AutomationMode {
  const value = String(mode || fallback).toLowerCase();
  if (value === 'full' || value === 'guided' || value === 'simulation') {
    return value;
  }
  return fallback;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requestId = req.headers.get('x-request-id') || undefined;

    const brandId = getAutomationBrandId(body.brandId as string | undefined);
    assertNoImplicitAutomationBrand(brandId);

    const defaultMode = getRuntimeConfig().automationMode;
    const mode = normalizeMode(body.mode, defaultMode);
    const idempotencyKey =
      String(body.idempotencyKey || req.headers.get('x-idempotency-key') || '').trim() ||
      crypto.randomUUID();
    const { run, reused } = await startRun({
      tenantId: LEGACY_TENANT_ID,
      brandId,
      goal: 'weekly_planning_cycle',
      mode,
      idempotencyKey,
      inputs: {
        ...body,
        brandId,
        tenantId: LEGACY_TENANT_ID,
      },
    });

    return NextResponse.json(
      envelopeSuccess(
        {
          runId: run.id,
          status: run.status === 'pending' ? 'queued' : run.status,
          reused,
          mode,
          output: run.output_payload,
        },
        {
          request_id: requestId,
          step: 'start',
          mode,
        }
      )
    );
  } catch (error: any) {
    return NextResponse.json(
      envelopeError(
        'ORCHESTRATION_START_FAILED',
        error?.message || 'Failed to start automation run',
        undefined,
        { step: 'start' }
      ),
      { status: 500 }
    );
  }
}
