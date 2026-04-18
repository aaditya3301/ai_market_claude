import { NextResponse } from 'next/server';
import { envelopeSuccess } from '@/lib/api-envelope';
import { withConnectorRoute } from '@/lib/connector/route';
import { getTenantById } from '@/lib/tenancy/service';

export async function GET(req: Request) {
  return withConnectorRoute(req, {
    scope: 'tenants:read',
    endpoint: 'v1/tenants.me',
    handler: async (auth) => {
      const tenant = await getTenantById(auth.tenantId);
      return NextResponse.json(
        envelopeSuccess(
          {
            tenant,
          },
          {
            api_version: 'v1',
            step: 'v1/tenants.me',
          }
        )
      );
    },
  });
}
