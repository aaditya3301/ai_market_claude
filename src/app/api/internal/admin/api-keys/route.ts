import { NextResponse } from 'next/server';
import { issueApiKey } from '@/lib/tenancy/service';

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
    const scopes = Array.isArray(body.scopes) ? body.scopes.map(String) : [];

    const keyPair = await issueApiKey({
      tenantId: String(body.tenant_id || '').trim(),
      name: String(body.name || 'default').trim(),
      scopes,
      expiresAt: body.expires_at ? String(body.expires_at) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        api_key: keyPair.apiKey,
        secret: keyPair.secret,
        key_id: keyPair.row.id,
        key_prefix: keyPair.row.key_prefix,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
