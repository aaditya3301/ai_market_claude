import { NextResponse } from 'next/server';
import { createTenant } from '@/lib/tenancy/service';

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
    const body = await req.json();

    const tenant = await createTenant({
      parentTenantId: String(body.parent_tenant_id || '').trim(),
      parentPlatformId: String(body.parent_platform_id || '').trim(),
      name: String(body.name || '').trim(),
      slug: String(body.slug || '').trim(),
      timezone: body.timezone ? String(body.timezone) : undefined,
      planCode: body.plan_code ? String(body.plan_code) : undefined,
    });

    return NextResponse.json({ success: true, data: tenant });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
