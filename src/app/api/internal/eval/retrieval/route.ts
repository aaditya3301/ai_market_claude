import { NextResponse } from 'next/server';
import { runRetrievalEvalSuite } from '@/lib/eval/retrieval/suite';

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

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400 });
    }

    const summary = await runRetrievalEvalSuite({ tenantId });
    return NextResponse.json({ success: true, data: summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
