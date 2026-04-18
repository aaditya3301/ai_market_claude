import { NextResponse } from 'next/server';
import { runAgentGoldenSuite } from '@/lib/eval/agents/suite';

function assertBootstrapToken(req: Request) {
  const token = req.headers.get('x-bootstrap-token') || '';
  const expected = process.env.INTERNAL_BOOTSTRAP_TOKEN || '';
  if (!expected || token !== expected) {
    throw new Error('UNAUTHORIZED');
  }
}

export async function POST(req: Request) {
  try {
    assertBootstrapToken(req);

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenant_id || '').trim();
    const runId = String(body.run_id || '').trim() || undefined;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400 });
    }

    const samplePlan =
      body.sample_plan && typeof body.sample_plan === 'object' && !Array.isArray(body.sample_plan)
        ? body.sample_plan
        : {
            product_name: 'Sleep Wellness Headband',
            target_audience: 'Working professionals with sleep stress',
            strategy_overview: 'Educational content with authority and social proof',
            content_pillars: ['sleep optimization', 'daily routines', 'stress reduction'],
          };

    const summary = await runAgentGoldenSuite({
      tenantId,
      runId,
      samplePlan,
    });

    return NextResponse.json({ success: true, data: summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
